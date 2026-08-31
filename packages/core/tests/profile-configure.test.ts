import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import test, { type TestContext } from "node:test";
import {
  AppArguments,
  command,
  createCli,
  MemorySecretStore,
  tokenAuth,
  type CliRuntime,
} from "../src/index.js";

interface Harness {
  runtime: CliRuntime;
  secrets: MemorySecretStore;
  stdout(): string;
  stderr(): string;
}

async function harness(
  context: TestContext,
  options: { input?: string; tty?: boolean; appName?: string } = {},
): Promise<Harness> {
  const root = await mkdtemp(join(tmpdir(), "cli-factory-configure-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const input = Readable.from([options.input ?? ""]) as Readable & {
    isTTY?: boolean;
    setRawMode?: (enabled: boolean) => void;
  };
  let stdout = "";
  let stderr = "";
  const output = new Writable({
    write(chunk, _encoding, callback) {
      stdout += chunk.toString();
      callback();
    },
  }) as Writable & { isTTY?: boolean };
  const error = new Writable({
    write(chunk, _encoding, callback) {
      stderr += chunk.toString();
      callback();
    },
  }) as Writable & { isTTY?: boolean };
  if (options.tty === true) {
    input.isTTY = true;
    input.setRawMode = () => undefined;
    output.isTTY = true;
    error.isTTY = true;
  }
  const appName = options.appName ?? "setup-cli";
  const secrets = new MemorySecretStore();
  return {
    runtime: {
      input,
      output,
      error,
      secretStore: secrets,
      appArguments: new AppArguments({
        AppName: appName,
        Profile: "default",
        Environment: {
          AppDomainDirectory: join(root, "app"),
          ApplicationExecutablePath: join(root, "app", `${appName}.js`),
          EnvironmentLocalAppData: join(root, "local"),
          EnvironmentAppData: join(root, "roaming"),
          ProcessId: 42,
        },
      }),
    },
    secrets,
    stdout: () => stdout,
    stderr: () => stderr,
  };
}

function definition(runtime: CliRuntime, options: { auth?: boolean } = {}) {
  return createCli({
    name: "setup-cli",
    description: "Setup example",
    profile: {
      fields: [
        {
          name: "url",
          flags: "--url <url>",
          description: "Service URL",
          required: true,
        },
      ],
      validate(values) {
        if (values.url !== undefined && !String(values.url).startsWith("https://")) {
          throw new Error("Service URL must use HTTPS.");
        }
      },
    },
    ...(options.auth === true
      ? {
          auth: tokenAuth({
            async validate({ profile, token }) {
              return { url: profile.values.url, tokenLength: token.length };
            },
          }),
        }
      : {}),
    commands: [
      command("inspect", "Inspect configuration", async (_input, context) => ({
        profile: context.profile.name,
        url: context.profile.values.url,
      })),
    ],
    runtime,
  });
}

test("generic profile configure onboarding", async (context) => {
  await context.test("non-interactive service commands fail before the handler", async (t) => {
    const testHarness = await harness(t);
    let calls = 0;
    const cli = createCli({
      name: "setup-cli",
      description: "Setup example",
      profile: {
        fields: [
          {
            name: "url",
            flags: "--url <url>",
            description: "Service URL",
            required: true,
          },
        ],
      },
      commands: [
        command("run", "Run", async () => {
          calls += 1;
        }),
      ],
      runtime: testHarness.runtime,
    });

    assert.equal(await cli.run(["run"]), 1);
    assert.equal(calls, 0);
    assert.match(testHarness.stderr(), /profile configure default --url/);
  });

  await context.test("explicit flags configure the virtual default profile", async (t) => {
    const testHarness = await harness(t);
    const cli = definition(testHarness.runtime);

    assert.equal(
      await cli.run([
        "profile",
        "configure",
        "default",
        "--url",
        "https://configured.test",
        "--json",
      ]),
      0,
    );
    assert.deepEqual(JSON.parse(testHarness.stdout()), {
      configured: true,
      profile: "default",
      authenticated: true,
      identity: null,
    });
    assert.deepEqual(await cli.execute(["inspect"]), {
      profile: "default",
      url: "https://configured.test",
    });
  });

  await context.test("an ordinary TTY command enters configuration mode", async (t) => {
    const testHarness = await harness(t, {
      input: "https://prompted.test\n",
      tty: true,
    });
    const cli = definition(testHarness.runtime);

    assert.equal(await cli.run(["inspect"]), 0);
    assert.match(testHarness.stderr(), /Service URL:/);
    assert.match(testHarness.stdout(), /https:\/\/prompted\.test/);
  });

  await context.test("an ordinary TTY root command configures instead of showing help", async (t) => {
    const testHarness = await harness(t, {
      input: "https://root-prompted.test\n",
      tty: true,
    });
    const cli = definition(testHarness.runtime);

    assert.equal(await cli.run([]), 0);
    assert.match(testHarness.stderr(), /Service URL:/);
    assert.deepEqual(await cli.execute(["inspect"]), {
      profile: "default",
      url: "https://root-prompted.test",
    });
  });

  await context.test("profile configure reuses token validation and secure storage", async (t) => {
    const testHarness = await harness(t, { input: "login-token" });
    const cli = definition(testHarness.runtime, { auth: true });

    assert.equal(
      await cli.run([
        "profile",
        "configure",
        "--url",
        "https://authenticated.test",
        "--token-stdin",
        "--json",
      ]),
      0,
    );
    assert.equal(
      await testHarness.secrets.get("ai-cli-factory:setup-cli", "default:token"),
      "login-token",
    );
    assert.equal(testHarness.stdout().includes("login-token"), false);
    assert.equal(testHarness.stderr().includes("login-token"), false);
  });

  await context.test("an ordinary TTY can complete authentication before a service command", async (t) => {
    const testHarness = await harness(t, {
      input: "interactive-token\n",
      tty: true,
    });
    const cli = createCli({
      name: "setup-cli",
      description: "Setup example",
      profile: {
        defaults: { url: "https://interactive.test" },
        fields: [
          {
            name: "url",
            flags: "--url <url>",
            description: "Service URL",
            required: true,
          },
        ],
      },
      auth: tokenAuth({
        async validate({ token }) {
          return { tokenLength: token.length };
        },
      }),
      commands: [command("inspect", "Inspect configuration", async () => ({ ok: true }))],
      runtime: testHarness.runtime,
    });

    assert.equal(await cli.run(["inspect"]), 0);
    assert.equal(
      await testHarness.secrets.get("ai-cli-factory:setup-cli", "default:token"),
      "interactive-token",
    );
    assert.match(testHarness.stderr(), /Token:/);
    assert.equal(testHarness.stdout().includes("interactive-token"), false);
    assert.equal(testHarness.stderr().includes("interactive-token"), false);
  });

  await context.test("JSON-RPC never prompts for an incomplete profile", async (t) => {
    const request =
      '{"jsonrpc":"2.0","id":1,"method":"cli.execute","params":{"argv":["inspect"]}}\n';
    const testHarness = await harness(t, { input: request });
    const cli = definition(testHarness.runtime);

    assert.equal(await cli.run(["--json-rpc"]), 0);
    const frame = JSON.parse(testHarness.stdout()) as {
      error: { message: string };
    };
    assert.match(frame.error.message, /profile configure default --url/);
    assert.equal(testHarness.stderr(), "");
  });

  await context.test("JSON-RPC never lets auth login consume the protocol stdin", async (t) => {
    const request =
      '{"jsonrpc":"2.0","id":1,"method":"cli.execute","params":{"argv":["auth","login","--token-stdin"]}}\n';
    const testHarness = await harness(t, { input: request });
    const cli = createCli({
      name: "setup-cli",
      description: "Setup example",
      profile: {
        defaults: { url: "https://configured.test" },
        fields: [
          {
            name: "url",
            flags: "--url <url>",
            description: "Service URL",
            required: true,
          },
        ],
      },
      auth: tokenAuth(),
      commands: [],
      runtime: testHarness.runtime,
    });

    assert.equal(await cli.run(["--json-rpc"]), 0);
    const frame = JSON.parse(testHarness.stdout()) as {
      error: { message: string };
    };
    assert.match(frame.error.message, /stdin belongs to the transport/);
    assert.equal(testHarness.stderr(), "");
  });
});

test("required command options fail before onboarding in every execution mode", async (t) => {
  for (const mode of ["tty", "json", "execute", "rpc"] as const) {
    const request = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "cli.execute", params: { argv: ["send"] } });
    const h = await harness(t, { tty: true, input: mode === "rpc" ? request + "\n" : "https://example.test\n" });
    let touched = 0;
    h.secrets.get = async () => { touched++; throw new Error("Unexpected keyring access"); };
    h.runtime.fetch = async () => { touched++; throw new Error("Unexpected fetch"); };
    const cli = createCli({
      name: "setup-cli", description: "Required option example",
      profile: { fields: [{ name: "url", flags: "--url <url>", description: "Service URL", required: true }] },
      auth: tokenAuth(),
      commands: [command("send", "Send", async () => { touched++; }, {
        options: [{ flags: "--body <json>", description: "Required body", required: true }],
      })],
      runtime: h.runtime,
    });
    if (mode === "execute") {
      await assert.rejects(cli.execute(["send"]), /required option/);
    } else if (mode === "rpc") {
      assert.equal(await cli.run(["--json-rpc"]), 0);
      const reply = JSON.parse(h.stdout());
      assert.equal(reply.error.code, -32000);
      assert.match(reply.error.message, /required option/);
    } else {
      assert.equal(await cli.run(["send", ...(mode === "json" ? ["--json"] : [])]), 1);
      assert.equal(h.stdout(), "");
      assert.match(h.stderr(), /required option/);
    }
    assert.equal(touched, 0);
    assert.doesNotMatch(h.stderr(), /Service URL:|Token:/);
  }
});

test("required option metadata preserves defaults and custom parsing", async (t) => {
  const h = await harness(t);
  const cli = createCli({
    name: "setup-cli", description: "Required option default example",
    commands: [command("send", "Send", ({ options }) => options.body, {
      options: [{
        flags: "--body <value>", description: "Value", required: true,
        defaultValue: "default-value", parse: (value) => value.toUpperCase(),
      }],
    })],
    runtime: h.runtime,
  });
  assert.equal(await cli.execute(["send"]), "default-value");
  assert.equal(await cli.execute(["send", "--body", "supplied"]), "SUPPLIED");
});
