import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, readdir, mkdir, writeFile, symlink, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { AppArguments, CliError } from "@eyeauras/cli-factory";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createTestRuntime } from "./support.js";
import { fileCases, sourceBytes, pngBytes } from "./files-cases.js";
import { safeFile, remotePath } from "../src/file-models.js";
const base = "https://teamcity.test/app/rest",
  service = "ai-cli-factory:teamcity-cli";
const server = setupServer();
test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());
async function fileRuntime(testContext: test.TestContext, input = "", parent = tmpdir()) {
  // Normalize only the newly created test root, never an untrusted profile child.
  const root = await realpath(await mkdtemp(join(parent, "teamcity-files-test-")));
  const runtime = await createTestRuntime(testContext, { input });
  const appArguments = new AppArguments({
    AppName: "teamcity-cli",
    Environment: {
      AppDomainDirectory: root,
      ApplicationExecutablePath: join(root, "cli.js"),
      EnvironmentLocalAppData: root,
      EnvironmentAppData: root,
      ProcessId: 1,
    },
  });
  runtime.runtime.appArguments = appArguments;
  return {
    root,
    runtime,
    appArguments,
    cli: (() => {
      const cli = runtime.createCli();
      const run = cli.run.bind(cli);
      const execute = cli.execute.bind(cli);
      cli.run = (argv, invocation) => run(argv, { ...invocation, cwd: root });
      // execute captures cwd synchronously, before starting asynchronous command work.
      cli.execute = (argv, signal) => {
        const previous = process.cwd();
        try { process.chdir(root); return execute(argv, signal); }
        finally { process.chdir(previous); }
      };
      return cli;
    })(),
    cleanup: async () => {
      await runtime.dispose();
      assert.equal(await realpath(root), root);
      assert.equal(dirname(root), await realpath(parent));
      await rm(root, { recursive: true, force: true });
    },
  };
}

test("file metadata keeps signed API size and avatar size semantics reach remote validation", async testContext => {
  const t = await fileRuntime(testContext);
  let calls = 0;
  try {
    server.use(http.get("*", ({ request }) => {
      calls++;
      const path = new URL(request.url).pathname;
      if (path.endsWith("/metadata/file")) return HttpResponse.json({ name: "file", size: -1 });
      assert.equal(path, "/app/rest/avatars/id:3/0/avatar.png");
      return HttpResponse.text("synthetic-private-response", { status: 400 });
    }));
    assert.deepEqual(await t.cli.execute(["server", "files", "metadata", "custom.future", "file"]), { name: "file", size: -1 });
    const result = await t.runtime.run(t.cli, ["users", "avatar", "download", "3", "--size", "0", "--output", "avatar.png", "--json"]);
    assert.equal(result.exitCode, 1);
    assert.equal(JSON.parse(result.stderr).error.code, "http.rejected");
    assert.ok(!result.stderr.includes("synthetic-private-response"));
    assert.equal(calls, 2);
  } finally {
    await t.cleanup();
  }
});
for (const c of fileCases)
  test(`S10 contract: ${c.method} ${c.path}`, async (testContext) => {
    const t = await fileRuntime(testContext);
    let calls = 0;
    try {
      for (const [key, value] of Object.entries(c.storedSecrets ?? {}))
        await t.runtime.secretStore.set(service, "default:" + key, value);
      server.use(
        http.all(/^https:\/\/teamcity\.test\/app\/rest\//, async ({ request }) => {
          calls++;
          const url = new URL(request.url);
          assert.equal(request.method, c.method);
          assert.equal(url.pathname, "/app/rest" + c.path);
          assert.deepEqual(Object.fromEntries(url.searchParams), c.query ?? {});
          assert.equal(request.headers.get("Authorization"), "Bearer fixture-token");
          assert.equal(
            request.headers.get("Accept"),
            c.bytes
              ? c.media === "application/octet-stream" || c.media === "application/zip"
                ? "*/*"
                : c.media
              : (c.media ?? "application/json"),
          );
          assert.equal(
            request.headers.get("Content-Type"),
            c.body === undefined ? null : "text/plain",
          );
          assert.equal(await request.text(), c.body ?? "");
          return c.bytes
            ? new HttpResponse(c.bytes as never, { headers: { "Content-Type": c.media! } })
            : c.media
              ? HttpResponse.text(String(c.response))
              : HttpResponse.json(c.response as never);
        }),
      );
      if (c.permission) {
        await assert.rejects(t.cli.execute(c.argv), /Permission 'Credentials'/);
        assert.equal(calls, 0);
        await t.cli.execute(["permissions", "grant", c.permission]);
      }
      assert.equal(await t.cli.run([...c.argv, "--json"]), 0, t.runtime.stderr());
      const result = JSON.parse(t.runtime.stdout());
      if (c.bytes) {
        const name = c.argv[c.argv.indexOf("--output") + 1]!;
        assert.deepEqual(result, {
          path: join(t.root, name),
          bytes: c.bytes.length,
          sha256: createHash("sha256").update(c.bytes).digest("hex"),
          mediaType: c.media,
        });
        assert.deepEqual(new Uint8Array(await readFile(result.path)), c.bytes);
        assert.deepEqual((await readdir(t.root)).filter(name => name.startsWith(".download-")), []);
      } else assert.deepEqual(result, c.expected);
      if (c.storedKey)
        assert.equal(
          await t.runtime.secretStore.get(service, "default:" + c.storedKey),
          c.storedValue,
        );
      assert.equal(calls, 1);
    } finally {
      await t.cleanup();
    }
  });

const download = [
  "builds",
  "artifacts",
  "download",
  "7",
  "docs/example.bin",
  "--output",
  "example.bin",
];
test("file runtime canonicalizes its owned root through a platform directory alias", async (testContext) => {
  const parent = await realpath(await mkdtemp(join(tmpdir(), "teamcity-root-test-")));
  let t: Awaited<ReturnType<typeof fileRuntime>> | undefined;
  try {
    const actual = join(parent, "actual"),
      alias = join(parent, "alias");
    await mkdir(actual);
    await symlink(actual, alias, process.platform === "win32" ? "junction" : "dir");
    t = await fileRuntime(testContext, "", alias);
    assert.equal(t.root, await realpath(t.root));
    server.use(
      http.get(base + "/builds/id:7/artifacts/files/docs/example.bin", () =>
        new HttpResponse(sourceBytes as never),
      ),
    );
    const result = (await t.cli.execute(download)) as { path: string };
    assert.equal(result.path, join(t.root, "example.bin"));
    assert.deepEqual(new Uint8Array(await readFile(result.path)), sourceBytes);
  } finally {
    await t?.cleanup();
    await rm(parent, { recursive: true, force: true });
  }
});

test("whole-file downloads reject HTTP 206 without publishing or retrying partial content", async (testContext) => {
  for (const withRange of [false, true]) {
    const t = await fileRuntime(testContext);
    let calls = 0;
    try {
      server.use(
        http.get(base + "/builds/id:7/artifacts/files/docs/example.bin", ({ request }) => {
          calls++;
          assert.equal(request.headers.get("Range"), null);
          return new HttpResponse(new Uint8Array([1, 2, 3]), {
            status: 206,
            headers: {
              "Content-Length": "3",
              ...(withRange ? { "Content-Range": "bytes 0-2/100" } : {}),
            },
          });
        }),
      );
      assert.equal(await t.cli.run([...download, "--json"]), 1);
      assert.equal(t.runtime.stdout(), "");
      assert.match(t.runtime.stderr(), /no destination was published/);
      assert.equal(calls, 1, "partial downloads must not be retried automatically");
      assert.deepEqual((await readdir(t.root)).filter(name => !name.startsWith(".download-") && name !== "outside"), []);
      assert.deepEqual((await readdir(t.root)).filter(name => name.startsWith(".download-")), []);
    } finally {
      await t.cleanup();
    }
  }
});

test("download transport failures keep HTTP status semantics and remove private staging", async (testContext) => {
  for (const kind of ["status", "length", "stream"] as const) {
    const t = await fileRuntime(testContext);
    try {
      server.use(
        http.get(base + "/builds/id:7/artifacts/files/docs/example.bin", () => {
          if (kind === "status") {
            return new HttpResponse("private response", { status: 503 });
          }
          if (kind === "length") {
            return new HttpResponse(sourceBytes as never, {
              headers: { "Content-Length": "invalid" },
            });
          }
          return new HttpResponse(new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(sourceBytes.subarray(0, 2));
              controller.error(new Error("private stream failure"));
            },
          }));
        }),
      );
      await assert.rejects(t.cli.execute(download), (error: unknown) => {
        assert.ok(error instanceof CliError);
        // A refused file keeps TeamCity's HTTP code; a broken transfer is Core's download error.
        assert.equal(error.code, kind === "status" ? "http.serverError" : "download.failed");
        assert.match(
          error.message,
          kind === "status" ? /TeamCity request failed with HTTP 503/ : /Download failed/,
        );
        assert.doesNotMatch(error.message, /private|invalid/);
        return true;
      });
      assert.deepEqual((await readdir(t.root)).filter(name => !name.startsWith(".download-") && name !== "outside"), []);
      assert.deepEqual((await readdir(t.root)).filter(name => name.startsWith(".download-")), []);
    } finally {
      await t.cleanup();
    }
  }
});

test("S10 all gates and generated help run before network, keyring input or filesystem creation", async (testContext) => {
  const t = await fileRuntime(testContext);
  let calls = 0;
  try {
    await t.runtime.profileStore.setPermissions("default", []);
    server.use(
      http.all("*", () => {
        calls++;
        return new HttpResponse(null, { status: 500 });
      }),
    );
    for (const c of fileCases) {
      await assert.rejects(t.cli.execute(c.argv), /Permission/);
      assert.equal(await t.cli.run([...c.argv, "--help"]), 0);
    }
    assert.equal(calls, 0);
    assert.deepEqual(await readdir(t.root), []);
  } finally {
    await t.cleanup();
  }
});
test("S10 rejects traversal and absolute paths, devices, unsafe areas and missing output before HTTP", async (testContext) => {
  const t = await fileRuntime(testContext);
  let calls = 0;
  try {
    server.use(
      http.all("*", () => {
        calls++;
        return HttpResponse.json({});
      }),
    );
    for (const path of [
      "../secret",
      "x/../y",
      "/secret",
      "x//y",
      ".",
    ]) {
      assert.throws(() => remotePath(path));
      await assert.rejects(t.cli.execute([...download.slice(0, 4), path, ...download.slice(5)]));
    }
    for (const name of ["C:\\other.bin", "CON", "nul.bin", "file.", "a:b"]) {
      await assert.rejects(t.cli.execute([...download.slice(0, -1), name]));
    }
    for (const argv of [
      ["jobs", "files", "list", "Build", "--limit", "-1"],
      ["users", "avatar", "download", "3", "--size", "1.5", "--output", "avatar.png"],
      [...download, "--max-bytes", "0"],
    ])
      await assert.rejects(t.cli.execute(argv));
    assert.equal(calls, 0);
  } finally {
    await t.cleanup();
  }
});
test("S10 existing destinations and publication races never overwrite another file", async (testContext) => {
  const t = await fileRuntime(testContext),
    dir = t.root,
    path = join(dir, "example.bin");
  let calls = 0;
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path, "synthetic-existing");
    server.use(
      http.get(base + "/builds/id:7/artifacts/files/docs/example.bin", async () => {
        calls++;
        await writeFile(path, "synthetic-racing-owner", { flag: "wx" });
        return new HttpResponse(sourceBytes as never);
      }),
    );
    await assert.rejects(t.cli.execute(download), /already exists/);
    assert.equal(calls, 0);
    assert.equal(await readFile(path, "utf8"), "synthetic-existing");
    await rm(path);
    await assert.rejects(t.cli.execute(download), /no destination was published/);
    assert.equal(calls, 1);
    assert.equal(await readFile(path, "utf8"), "synthetic-racing-owner");
    assert.deepEqual((await readdir(t.root)).filter(name => name.startsWith(".download-")), []);
  } finally {
    await t.cleanup();
  }
});
test("S10 symlink or junction download/temp directories fail closed without touching target", async (testContext) => {
  for (const name of ["downloads", "temp"]) {
    const t = await fileRuntime(testContext);
    let calls = 0;
    try {
      const outside = join(t.root, "outside");
      await mkdir(outside);
      await mkdir(t.appArguments.AppDataDirectory, { recursive: true });
      await symlink(
        outside,
        join(t.root, name),
        process.platform === "win32" ? "junction" : "dir",
      );
      server.use(
        http.all("*", () => {
          calls++;
          return new HttpResponse(sourceBytes as never);
        }),
      );
      await assert.rejects(t.cli.execute([...download.slice(0, -1), join(name, "example.bin")]), /symlink|junction|declared path/);
      assert.equal(calls, 0);
      assert.deepEqual(await readdir(outside), []);
    } finally {
      await t.cleanup();
    }
  }
});
test("S10 size limits apply to actual streams and all failed staging bytes are removed", async (testContext) => {
  for (const declared of [false, true]) {
    const t = await fileRuntime(testContext);
    try {
      server.use(
        http.get(
          base + "/builds/id:7/artifacts/files/docs/example.bin",
          () =>
            new HttpResponse(
              new ReadableStream({
                start(c) {
                  c.enqueue(new Uint8Array(4));
                  c.enqueue(new Uint8Array(6));
                  c.close();
                },
              }),
              { headers: declared ? { "Content-Length": "10" } : {} },
            ),
        ),
      );
      await assert.rejects(t.cli.execute([...download, "--max-bytes", "8"]), /Download failed/);
      assert.deepEqual((await readdir(t.root)).filter(name => !name.startsWith(".download-") && name !== "outside"), []);
      assert.deepEqual((await readdir(t.root)).filter(name => name.startsWith(".download-")), []);
    } finally {
      await t.cleanup();
    }
  }
});
test("S10 invalid PNG ZIP SVG content/media never becomes a successful file", async (testContext) => {
  const samples = [
    {
      argv: ["users", "avatar", "download", "3", "--output", "x.png"],
      media: "text/html",
      bytes: pngBytes,
    },
    {
      argv: ["users", "avatar", "download", "3", "--output", "x.png"],
      media: "image/png",
      bytes: sourceBytes,
    },
    {
      argv: ["builds", "artifacts", "archive", "7", "docs", "--output", "x.zip"],
      media: "application/zip",
      bytes: sourceBytes,
    },
    {
      argv: ["builds", "icon", "7", "--output", "x.svg"],
      media: "image/svg+xml",
      bytes: new TextEncoder().encode('<!DOCTYPE svg [<!ENTITY x "synthetic">]><svg/>'),
    },
  ];
  for (const c of samples) {
    const t = await fileRuntime(testContext);
    try {
      server.use(
        http.all(
          /^https:\/\/teamcity\.test/,
          () => new HttpResponse(c.bytes as never, { headers: { "Content-Type": c.media } }),
        ),
      );
      await assert.rejects(t.cli.execute(c.argv), /Download failed/);
      assert.deepEqual((await readdir(t.root)).filter(name => !name.startsWith(".download-") && name !== "outside"), []);
      assert.deepEqual((await readdir(t.root)).filter(name => name.startsWith(".download-")), []);
    } finally {
      await t.cleanup();
    }
  }
});
test("S10 empty ordinary files are retained and metadata keeps absent directory size", async (testContext) => {
  const t = await fileRuntime(testContext);
  try {
    server.use(
      http.get(
        base + "/builds/id:7/artifacts/files/docs/example.bin",
        () => new HttpResponse(new Uint8Array(0)),
      ),
    );
    const result = (await t.cli.execute(download)) as { path: string; bytes: number };
    assert.equal(result.bytes, 0);
    assert.equal((await readFile(result.path)).length, 0);
    assert.deepEqual(safeFile({ name: "docs" }), { name: "docs" });
    assert.throws(() => safeFile({ name: "x", size: Number.MAX_SAFE_INTEGER + 1 }));
  } finally {
    await t.cleanup();
  }
});
test("S10 cancellation during a response discards owned staging and suppresses abort reason", async (testContext) => {
  const t = await fileRuntime(testContext),
    controller = new AbortController();
  let pulls = 0;
  try {
    t.runtime.runtime.fetch = async () =>
      new Response(
        new ReadableStream({
          pull(c) {
            pulls++;
            if (pulls === 2) {
              controller.abort(new Error("synthetic-private-abort"));
              return;
            }
            c.enqueue(new Uint8Array(4));
          },
        }),
      );
    const cli = t.runtime.createCli();
    await assert.rejects(
      cli.execute(download, controller.signal),
      (e) =>
        e instanceof Error &&
        !e.message.includes("synthetic-private-abort") &&
        e.cause instanceof Error,
    );
    assert.ok(pulls >= 2);
    assert.deepEqual((await readdir(t.root)).filter(name => name.startsWith(".download-")), []);
    assert.deepEqual((await readdir(t.root)).filter(name => !name.startsWith(".download-") && name !== "outside"), []);
  } finally {
    await t.cleanup();
  }
});
test("S10 artifact redirects succeed without forwarding auth to another origin", async (testContext) => {
  const t = await fileRuntime(testContext);
  let foreign = 0;
  try {
    server.use(
      http.get(
        base + "/builds/id:7/artifacts/files/docs/example.bin",
        () =>
          new HttpResponse(null, {
            status: 302,
            headers: { Location: "https://foreign.test/private?signature=synthetic-secret" },
          }),
      ),
      http.get("https://foreign.test/*", ({ request }) => {
        assert.equal(request.headers.get("authorization"), null);
        foreign++;
        return new HttpResponse(sourceBytes as never);
      }),
    );
    const result = await t.cli.execute(download) as { path: string };
    assert.deepEqual(await readFile(result.path), Buffer.from(sourceBytes));
    assert.equal(foreign, 1);
    assert.doesNotMatch(JSON.stringify(result), /synthetic-secret/);
  } finally {
    await t.cleanup();
  }
});
test("S10 persistent RPC keeps downloaded bytes and paths isolated by active profile", async (testContext) => {
  const commands = [download, [...download, "--profile", "uat"], [...download.slice(0, -1), "uat.bin", "--profile", "uat"]];
  const input =
    commands
      .map((argv, id) =>
        JSON.stringify({ jsonrpc: "2.0", id, method: "cli.execute", params: { argv } }),
      )
      .join("\n") + "\n";
  const t = await fileRuntime(testContext, input);
  let calls = 0;
  try {
    await t.runtime.profileStore.create("uat", { url: "https://uat.test" });
    await t.runtime.secretStore.set(service, "uat:token", "fixture-uat");
    server.use(
      http.get(base + "/builds/id:7/artifacts/files/docs/example.bin", ({ request }) => {
        calls++;
        assert.equal(request.headers.get("Authorization"), "Bearer fixture-token");
        return new HttpResponse(new TextEncoder().encode("synthetic-default-data"));
      }),
      http.get(
        "https://uat.test/app/rest/builds/id:7/artifacts/files/docs/example.bin",
        ({ request }) => {
          calls++;
          assert.equal(request.headers.get("Authorization"), "Bearer fixture-uat");
          return new HttpResponse(new TextEncoder().encode("synthetic-uat-data"));
        },
      ),
    );
    assert.equal(await t.cli.run(["--json-rpc"]), 0);
    const frames = t.runtime
      .stdout()
      .trim()
      .split("\n")
      .map((v) => JSON.parse(v));
    assert.equal(calls, 2);
    assert.match(frames[1].error.message, /exists/);
    assert.notEqual(frames[0].result.path, frames[2].result.path);
    assert.equal(await readFile(frames[0].result.path, "utf8"), "synthetic-default-data");
    assert.equal(await readFile(frames[2].result.path, "utf8"), "synthetic-uat-data");
    assert.doesNotMatch(t.runtime.stdout(), /synthetic-(?:default|uat)-data/);
    assert.equal(frames[2].result.path, join(t.root, "uat.bin"));
  } finally {
    await t.cleanup();
  }
});
test("S10 secure resolution rejects collisions and unresolved expressions and reports store failures", async (testContext) => {
  const t = await fileRuntime(testContext);
  let calls = 0;
  try {
    await t.cli.execute(["permissions", "grant", "Credentials"]);
    await t.runtime.secretStore.set(service, "default:input-secret:resolved", "synthetic-existing");
    server.use(
      http.get(base + "/builds/id:7/resolved/:value", () => {
        calls++;
        return HttpResponse.text("%env.MODE%");
      }),
    );
    const argv = ["builds", "resolve-parameter", "7", "env.MODE", "--store-as", "resolved"];
    await assert.rejects(t.cli.execute(argv), /already exists/);
    assert.equal(calls, 0);
    await t.runtime.secretStore.delete(service, "default:input-secret:resolved");
    await assert.rejects(t.cli.execute(argv), /unresolved/);
    assert.equal(calls, 1);
    assert.equal(
      await t.runtime.secretStore.get(service, "default:input-secret:resolved"),
      undefined,
    );
    server.use(
      http.get(base + "/builds/id:7/resolved/:value", () => {
        calls++;
        return HttpResponse.text("synthetic-resolved-secret");
      }),
    );
    t.runtime.secretStore.set = async () => {
      throw new Error("synthetic-private-store");
    };
    await assert.rejects(
      t.cli.execute(argv),
      /Remote operation succeeded but secure persistence failed/,
    );
    assert.equal(calls, 2);
  } finally {
    await t.cleanup();
  }
});
test("S10 secure-reference aliases are isolated from auth/input aliases and exact text survives", async (testContext) => {
  const t = await fileRuntime(testContext);
  try {
    await t.cli.execute(["permissions", "grant", "Credentials"]);
    await t.runtime.secretStore.set(
      service,
      "default:secure-reference:same",
      "synthetic-reference",
    );
    await t.runtime.secretStore.set(service, "default:input-secret:same", "synthetic-input");
    server.use(
      http.get(base + "/projects/id:Example/secure/values/synthetic-reference", () =>
        HttpResponse.text(" synthetic-secret-with-whitespace "),
      ),
    );
    assert.deepEqual(
      await t.cli.execute([
        "projects",
        "secure",
        "resolve",
        "Example",
        "--reference",
        "same",
        "--store-as",
        "target",
      ]),
      { alias: "target", stored: true },
    );
    assert.equal(
      await t.runtime.secretStore.get(service, "default:input-secret:target"),
      " synthetic-secret-with-whitespace ",
    );
    await t.cli.execute(["projects", "secure", "forget-reference", "same"]);
    assert.equal(
      await t.runtime.secretStore.get(service, "default:secure-reference:same"),
      undefined,
    );
    assert.equal(
      await t.runtime.secretStore.get(service, "default:input-secret:same"),
      "synthetic-input",
    );
    assert.equal(await t.runtime.secretStore.get(service, "default:token"), "fixture-token");
  } finally {
    await t.cleanup();
  }
});

test("encoded downloads apply only an explicit decoded-byte budget", async (testContext) => {
  const maxBytes = 64;
  for (const [name, declared, decoded, failure] of [
    ["encoded-ok.bin", 20, new Uint8Array(32), undefined],
    ["encoded-wire.bin", 65, new Uint8Array(32), undefined],
    ["encoded-actual.bin", 20, new Uint8Array(128), "decoded"],
  ] as const) {
    const t = await fileRuntime(testContext);
    try {
      if (failure === "decoded") assert.ok(decoded.byteLength > maxBytes);
      else assert.ok(decoded.byteLength <= maxBytes);
      server.use(http.get(base + "/builds/id:7/artifacts/files/docs/example.bin", () =>
        new HttpResponse(decoded, {
          headers: {
            "Content-Encoding": "synthetic-encoding",
            "Content-Length": String(declared),
            "Content-Type": "application/octet-stream",
          },
        }),
      ));
      const argv = [
        "builds", "artifacts", "download", "7", "docs/example.bin",
        "--output", name, "--max-bytes", String(maxBytes),
      ];
      if (failure === undefined) {
        const result = await t.cli.execute(argv) as { path: string; bytes: number };
        assert.equal(result.bytes, decoded.byteLength);
        assert.deepEqual(new Uint8Array(await readFile(result.path)), decoded);
      } else {
        await assert.rejects(t.cli.execute(argv));
      }
      assert.deepEqual((await readdir(t.root)).filter(name => name.startsWith(".download-")), []);
    } finally {
      await t.cleanup();
    }
  }
});

test("downloads have no default byte ceiling and accept a caller budget above 64 MiB", async testContext => {
  const t = await fileRuntime(testContext);
  const bytes = new Uint8Array(16 * 1024 * 1024 + 1).fill(37);
  try {
    server.use(http.get(base + "/builds/id:7/artifacts/files/docs/example.bin", () =>
      new HttpResponse(bytes, { headers: { "Content-Length": String(bytes.length) } }),
    ));
    for (const [name, extra] of [["large-default.bin", []], ["large-budget.bin", ["--max-bytes", "67108865"]]] as const) {
      const result = await t.cli.execute([...download.slice(0, -1), name, ...extra]) as { path: string; bytes: number };
      assert.equal(result.bytes, bytes.length);
      assert.deepEqual(new Uint8Array(await readFile(result.path)), bytes);
    }
  } finally {
    await t.cleanup();
  }
});

 test("issue86 source downloads default to invocation cwd and accept output paths", async t => {
  const f = await fileRuntime(t);
  try {
    server.use(http.get("*", () => HttpResponse.text("synthetic-source")));
    await mkdir(join(f.root, "nested"));
    for (const output of [undefined, "nested/relative.ts", join(f.root, "absolute.ts")]) {
      const result = await f.runtime.json(f.cli, ["builds", "source", "101", "src/example.ts", ...(output ? ["--output", output] : [])], { cwd: f.root }) as { path: string };
      assert.equal(result.path, output ? (output.startsWith("/") ? output : join(f.root, output)) : join(f.root, "example.ts"));
      assert.equal(await readFile(result.path, "utf8"), "synthetic-source");
    }
    assert.equal((await f.runtime.run(f.cli, ["builds", "source", "101", "src/example.ts"], { cwd: f.root })).exitCode, 1);
  } finally { await f.cleanup(); }
});

test("download resource kinds choose known filenames without an output option", async t => {
  const cases: [string[], string][] = [
    [["builds", "artifacts", "download", "7", "docs/example.bin"], "example.bin"],
    [["builds", "artifacts", "archive", "7", "docs"], "docs.zip"],
    [["users", "avatar", "download", "3", "--size", "64"], "avatar.png"],
    [["builds", "icon", "7"], "statusIcon.svg"],
  ];
  for (const [argv, name] of cases) {
    const f = await fileRuntime(t);
    try {
      const contract = fileCases.find(c => c.bytes && c.argv.slice(0, argv.length).join(" ") === argv.join(" "))!;
      assert.ok(contract);
      server.use(http.get(base + contract.path, () => new HttpResponse(contract.bytes as never, { headers: { "Content-Type": contract.media! } })));
      const result = await f.runtime.json(f.cli, argv) as { path: string };
      assert.equal(result.path, join(f.root, name));
      assert.deepEqual(new Uint8Array(await readFile(result.path)), contract.bytes);
    } finally { await f.cleanup(); }
  }
});
