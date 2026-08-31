import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PassThrough, Readable, Writable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { Server, ServerCredentials, status } from "@grpc/grpc-js";
import { AppArguments, type CliApplication } from "@eyeauras/cli-factory";
import {
  CliHost,
  connect,
  protocol,
  chunkBytes,
  bufferBytes,
} from "../src/protocol.js";
import { hostPaths } from "../src/endpoint.js";
import { relay, serveRun } from "../src/relay.js";
import type { CliHostHandlers } from "../src/generated/clifactory/CliHost.js";

function capture() {
  const stdout: Buffer[] = [],
    stderr: Buffer[] = [];
  return {
    input: Readable.from([]),
    output: new Writable({
      write(chunk, _encoding, done) {
        stdout.push(Buffer.from(chunk));
        done();
      },
    }),
    error: new Writable({
      write(chunk, _encoding, done) {
        stderr.push(Buffer.from(chunk));
        done();
      },
    }),
    stdout: () => Buffer.concat(stdout),
    stderr: () => Buffer.concat(stderr),
  };
}
async function fixture(
  t: test.TestContext,
  run: CliApplication["run"],
  handler?: CliHostHandlers["Run"],
) {
  const root = await mkdtemp(join(tmpdir(), "ipc-relay-"));
  const app = new AppArguments({
    AppName: "relay",
    Environment: {
      EnvironmentAppData: root,
      EnvironmentLocalAppData: root,
      AppDomainDirectory: root,
      ApplicationExecutablePath: join(root, "fixture"),
      ProcessId: process.pid,
    },
  });
  const paths = hostPaths(app);
  // Test endpoint only: the production host performs private-directory and endpoint protection.
  const endpoint =
    process.platform === "win32"
      ? paths.endpoint
      : "unix:" + join(root, "relay.sock");
  const application: CliApplication = {
    run,
    execute: async () => undefined,
    dispose: async () => {},
  };
  const server = new Server();
  const handlers: CliHostHandlers = {
    Run:
      handler ??
      ((call) =>
        serveRun(call, {
          application,
          build: "test",
          environmentKeys: ["ALLOWED"],
          admitted: () => true,
          started() {},
          completed() {},
        })),
    Status(_call, callback) {
      callback(null, { pid: process.pid, build: "test", closing: false });
    },
    Stop(_call, callback) {
      callback(null, { pid: process.pid, build: "test", closing: true });
    },
  };
  server.addService(CliHost.service, handlers);
  await new Promise<void>((resolve, reject) =>
    server.bindAsync(endpoint, ServerCredentials.createInsecure(), (error) =>
      error ? reject(error) : resolve(),
    ),
  );
  const client = connect(endpoint);
  t.after(async () => {
    client.close();
    server.forceShutdown();
    await rm(root, { recursive: true, force: true });
  });
  return client;
}

test("bidi bytes, separate stderr, EOF, caller metadata and nonzero Exit are lossless", async (t) => {
  const binary = Buffer.from([0, 255, 226, 152, 131, 13, 10]);
  const client = await fixture(t, async (argv, invocation) => {
    assert.deepEqual(argv, ["example"]);
    assert.equal(invocation?.cwd, "synthetic-cwd");
    assert.equal(invocation?.environment?.ALLOWED, "synthetic-value");
    for await (const chunk of invocation!.input!) {
      invocation!.output!.write(chunk);
      invocation!.error!.write(chunk);
    }
    return 17;
  });
  const io = {
    ...capture(),
    input: Readable.from([...binary].map((byte) => Buffer.from([byte]))),
  };
  assert.equal(
    await relay(client, ["example"], "test", io, {
      cwd: "synthetic-cwd",
      environment: { ALLOWED: "synthetic-value" },
    }),
    17,
  );
  assert.deepEqual(io.stdout(), binary);
  assert.deepEqual(io.stderr(), binary);
});
test("completion does not wait for stdin EOF or destroy the caller's input", async (t) => {
  const client = await fixture(t, async () => 0),
    input = new PassThrough(),
    io = { ...capture(), input };
  assert.equal(await relay(client, [], "test", io), 0);
  assert.equal(input.destroyed, false);
  input.destroy();
});
test("slow reader propagates backpressure and preserves a stream larger than buffer capacity", async (t) => {
  let peak = 0;
  const client = await fixture(t, async (_argv, invocation) => {
    for (let i = 0; i < 160; i++) {
      const output = invocation!.output!;
      await new Promise<void>((resolve, reject) =>
        output.write(Buffer.alloc(chunkBytes, i % 256), (error) =>
          error ? reject(error) : resolve(),
        ),
      );
      peak = Math.max(peak, output.writableLength);
    }
    return 0;
  });
  let total = 0,
    index = 0;
  const io = {
    ...capture(),
    output: new Writable({
      highWaterMark: chunkBytes,
      write(chunk, _encoding, done) {
        for (const byte of chunk)
          assert.equal(byte, Math.floor(index++ / chunkBytes) % 256);
        total += chunk.length;
        setImmediate(done);
      },
    }),
  };
  assert.equal(await relay(client, [], "test", io), 0);
  assert.equal(total, 160 * chunkBytes);
  assert.ok(peak <= bufferBytes);
});
test("ignoring output backpressure trips a bound; cancellation interrupts a stuck caller sink", async (t) => {
  const overflowing = await fixture(t, async (_argv, invocation) => {
    invocation!.output!.write(Buffer.alloc(bufferBytes + 1));
    return 0;
  });
  await assert.rejects(relay(overflowing, [], "test", capture()), /No replay/);
  const client = await fixture(t, async (_argv, invocation) => {
    invocation!.output!.write("one");
    return 0;
  });
  const abort = new AbortController();
  const io = {
    ...capture(),
    output: new Writable({
      write() {
        abort.abort();
      },
    }),
  };
  await assert.rejects(
    relay(client, [], "test", io, { signal: abort.signal }),
    /cancelled/,
  );
  assert.equal(io.output.destroyed, false);
  io.output.destroy();
});
for (const sink of ["output", "error"] as const) {
  test(`${sink} write errors reject only their invocation without an uncaught stream error`, async (t) => {
    const client = await fixture(t, async (_argv, invocation) => {
      invocation![sink]!.write("synthetic output");
      return 0;
    });
    for (const asynchronous of [false, true]) {
      const io = capture();
      io[sink] = new Writable({
        write(_chunk, _encoding, done) {
          const fail = () => done(new Error("synthetic sink failure"));
          if (asynchronous) setImmediate(fail);
          else fail();
        },
      });
      await assert.rejects(relay(client, [], "test", io), /No replay/);
      assert.equal(io[sink].listenerCount("error"), 0);
      assert.equal(await relay(client, [], "test", capture()), 0);
    }
  });
}

test("already cancelled or closed-output invocations never enter the application", async (t) => {
  let entered = 0;
  const client = await fixture(t, async () => {
    entered++;
    return 0;
  });
  for (const kind of ["cancel", "output", "error"] as const) {
    const io = capture();
    const abort = new AbortController();
    if (kind === "cancel") abort.abort();
    else {
      io[kind].destroy();
      await new Promise<void>((resolve) => io[kind].once("close", resolve));
    }
    await assert.rejects(
      relay(client, [], "test", io, { signal: abort.signal }),
      /cancelled|No replay/,
    );
    for (const stream of [io.output, io.error])
      for (const event of ["error", "close", "finish"])
        assert.equal(stream.listenerCount(event), 0);
  }
  assert.equal(entered, 0);
  assert.equal(await relay(client, [], "test", capture()), 0);
  assert.equal(entered, 1);
});

test("a pending sink write can fail after cancellation without an uncaught error", async (t) => {
  const client = await fixture(t, async (_argv, invocation) => {
    invocation!.output!.write("synthetic output");
    return 0;
  });
  let writeEntered!: () => void;
  let complete!: (error?: Error | null) => void;
  const entered = new Promise<void>((resolve) => {
    writeEntered = resolve;
  });
  const io = capture();
  io.output = new Writable({
    write(_c, _e, done) {
      complete = done;
      writeEntered();
    },
  });
  const abort = new AbortController();
  const result = relay(client, [], "test", io, { signal: abort.signal });
  void result.catch(() => {});
  await entered;
  abort.abort();
  await assert.rejects(result, /cancelled/);
  assert.equal(io.output.destroyed, false);
  complete(new Error("synthetic delayed sink failure"));
  await new Promise<void>((resolve) => io.output.once("close", resolve));
  assert.equal(io.output.listenerCount("error"), 0);
  assert.equal(await relay(client, [], "test", capture()), 0);
});

test("output failure between writes cancels its Run, preserves peers and detaches caller listeners", async (t) => {
  for (const kind of ["error", "close", "finish"] as const) {
    let enter!: () => void, release!: () => void;
    const entered = new Promise<void>((resolve) => {
      enter = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const client = await fixture(t, async (argv, invocation) => {
      if (argv?.[0] === "ping") return 0;
      enter();
      await new Promise<void>((resolve) => {
        if (invocation!.signal!.aborted) resolve();
        else
          invocation!.signal!.addEventListener("abort", () => resolve(), {
            once: true,
          });
      });
      release();
      return 0;
    });
    const io = { ...capture(), input: new PassThrough() };
    const abort = new AbortController();
    const result = relay(client, [], "test", io, { signal: abort.signal });
    void result.catch(() => {});
    try {
      await entered;
      assert.equal(await relay(client, ["ping"], "test", capture()), 0);
      if (kind === "finish") io.output.end();
      else
        io.output.destroy(
          kind === "error"
            ? new Error("synthetic idle sink failure")
            : undefined,
        );
      await assert.rejects(
        Promise.race([
          result,
          delay(1000).then(() => {
            throw new Error("Output failure left Run active");
          }),
        ]),
        /No replay/,
      );
      await released;
      assert.equal(io.input.destroyed, false);
      assert.equal(io.error.destroyed, false);
      for (const stream of [io.input, io.output, io.error])
        for (const event of ["error", "close", "finish", "data", "end"])
          assert.equal(
            stream.listenerCount(event),
            0,
            `${kind}: leaked ${event}`,
          );
      assert.equal(await relay(client, ["ping"], "test", capture()), 0);
    } finally {
      abort.abort();
      await result.catch(() => {});
      io.input.destroy();
    }
  }
});

test("premature stdin close cancels a waiting Run, including input closed before relay starts", async (t) => {
  for (const beforeStart of [false, true]) {
    let enter!: () => void, release!: () => void;
    const entered = new Promise<void>((resolve) => {
      enter = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const client = await fixture(t, async (argv, invocation) => {
      if (argv?.[0] === "ping") return 0;
      enter();
      try {
        for await (const _chunk of invocation!.input!) {
          /* wait for EOF/cancel */
        }
        return 0;
      } finally {
        release();
      }
    });
    const input = new PassThrough();
    const io = { ...capture(), input };
    const abort = new AbortController();
    if (beforeStart) {
      input.destroy();
      await new Promise<void>((resolve) => input.once("close", resolve));
    }
    const result = relay(client, [], "test", io, { signal: abort.signal });
    void result.catch(() => {});
    try {
      if (!beforeStart) {
        await entered;
        input.destroy();
      }
      await assert.rejects(
        Promise.race([
          result,
          delay(1000).then(() => {
            throw new Error("stdin close left Run active");
          }),
        ]),
        /No replay/,
      );
      if (!beforeStart) await released;
      assert.equal(input.listenerCount("data"), 0);
      assert.equal(input.listenerCount("error"), 0);
      assert.equal(await relay(client, ["ping"], "test", capture()), 0);
    } finally {
      abort.abort();
      await result.catch(() => {});
      input.destroy();
    }
  }
});

test("invalid frame order, incompatible build and unapproved environment are rejected", async (t) => {
  const client = await fixture(t, async (_argv, invocation) => {
    if (!invocation!.signal!.aborted)
      await new Promise<void>((resolve) =>
        invocation!.signal!.addEventListener("abort", () => resolve(), {
          once: true,
        }),
      );
    return 1;
  });
  const first = {
    start: {
      protocol,
      build: "test",
      argv: [],
      cwd: "fixture",
      environment: {},
    },
  };
  for (const [frames, code] of [
    [[], status.INVALID_ARGUMENT],
    [[{ stdin: Buffer.from("before") }], status.INVALID_ARGUMENT],
    [[first, first], status.INVALID_ARGUMENT],
    [
      [{ start: { ...first.start, build: "wrong" } }],
      status.FAILED_PRECONDITION,
    ],
    [
      [{ start: { ...first.start, environment: { UNAPPROVED: "synthetic" } } }],
      status.INVALID_ARGUMENT,
    ],
    [[first, { stdin: Buffer.alloc(chunkBytes + 1) }], status.INVALID_ARGUMENT],
  ] as const) {
    const call = client.Run({ deadline: Date.now() + 3000 });
    const result = new Promise<number>((resolve) =>
      call.on("error", (error) =>
        resolve((error as Error & { code: number }).code),
      ),
    );
    call.on("data", () => {});
    for (const frame of frames) call.write(frame);
    call.end();
    assert.equal(await result, code);
  }
});
test("Exit must be unique, terminal, and followed by OK transport status", async (t) => {
  for (const kind of ["missing", "duplicate", "failed-status"]) {
    const client = await fixture(
      t,
      async () => 0,
      (call) => {
        call.on("error", () => {});
        call.once("data", () => {
          if (kind !== "missing") call.write({ exit: { code: 0 } });
          if (kind === "duplicate") call.write({ exit: { code: 0 } });
          if (kind === "failed-status")
            call.emit(
              "error",
              Object.assign(new Error("synthetic transport failure"), {
                code: status.INTERNAL,
              }),
            );
          else call.end();
        });
        call.resume();
      },
    );
    await assert.rejects(relay(client, [], "test", capture()), /No replay/);
  }
});
