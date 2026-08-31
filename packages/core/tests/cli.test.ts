import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import test from "node:test";
import {
  AppArguments,
  command,
  createCli,
  MemorySecretStore,
  Permission,
  tokenAuth,
  ProfileStore,
} from "../src/index.js";

async function profileFixture(t: test.TestContext, name = "example-cli") {
  const root = await mkdtemp(join(tmpdir(), "core-cli-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const appArguments = new AppArguments({
    AppName: name,
    Environment: {
      EnvironmentAppData: root,
      EnvironmentLocalAppData: root,
      AppDomainDirectory: root,
      ApplicationExecutablePath: join(root, "bin.js"),
      ProcessId: process.pid,
    },
  });
  const profiles = new ProfileStore({
    applicationId: name,
    appArguments,
    defaults: { url: "https://example.test" },
  });
  return { appArguments, profiles };
}

function capture(): { stream: Writable; text: () => string } {
  let value = "";
  return {
    stream: new Writable({
      write(chunk, _encoding, callback) {
        value += chunk.toString();
        callback();
      },
    }),
    text: () => value,
  };
}

test("running the root command without arguments shows help successfully", async (t) => {
  const { appArguments, profiles } = await profileFixture(t);
  const stdout = capture();
  const stderr = capture();
  const cli = createCli({
    name: "example-cli",
    description: "Example",
    commands: [command("ping", "Ping", async () => ({ ok: true }))],
    runtime: {
      input: Readable.from([]),
      output: stdout.stream,
      error: stderr.stream,
      appArguments,
      profileStore: profiles,
      secretStore: new MemorySecretStore(),
    },
  });

  assert.equal(await cli.run([]), 0);
  assert.match(stdout.text(), /Usage: example-cli/);
  assert.match(stdout.text(), /ping/);
  assert.equal(stderr.text(), "");
  assert.deepEqual(await cli.execute([]), { help: stdout.text().trimEnd() });
});

test("profile commands create, update, select, and safely delete profiles", async (context) => {
  const secrets = new MemorySecretStore();
  const dataRoot = await mkdtemp(join(tmpdir(), "cli-factory-profile-data-"));
  context.after(() => rm(dataRoot, { recursive: true, force: true }));
  const appArguments = new AppArguments({
    AppName: "profile-cli",
    Profile: "default",
    Environment: {
      AppDomainDirectory: join(dataRoot, "app"),
      ApplicationExecutablePath: join(dataRoot, "app", "profile-cli.js"),
      EnvironmentLocalAppData: join(dataRoot, "local"),
      EnvironmentAppData: join(dataRoot, "roaming"),
      ProcessId: 42,
    },
  });
  const profiles = new ProfileStore({
    applicationId: "profile-cli",
    appArguments,
    defaults: { url: "https://example.test" },
  });
  const cli = createCli({
    name: "profile-cli",
    description: "Profile example",
    profile: {
      defaults: { url: "https://default.test" },
      fields: [
        { name: "url", flags: "--url <url>", description: "Service URL" },
      ],
    },
    auth: tokenAuth({ env: "PROFILE_TOKEN" }),
    commands: [],
    runtime: {
      input: Readable.from([]),
      output: capture().stream,
      error: capture().stream,
      appArguments,
      profileStore: profiles,
      secretStore: secrets,
    },
  });

  await assert.rejects(
    cli.execute(["profile", "create", "default"]),
    /already exists/,
  );
  await assert.rejects(
    cli.execute(["profile", "set", "missing"]),
    /does not exist/,
  );
  assert.deepEqual(
    await cli.execute([
      "profile",
      "create",
      "uat",
      "--url",
      "https://uat.test",
    ]),
    { name: "uat", values: { url: "https://uat.test" } },
  );
  await cli.execute([
    "profile",
    "create",
    "retired",
    "--url",
    "https://retired.test",
  ]);
  const retiredDataDirectory =
    appArguments.WithProfile("retired").AppDataDirectory;
  await mkdir(retiredDataDirectory, { recursive: true });
  await writeFile(
    join(retiredDataDirectory, "integration-state.json"),
    "{}",
    "utf8",
  );
  await secrets.set(
    "ai-cli-factory:profile-cli",
    "retired:token",
    "retired-secret",
  );
  assert.deepEqual(await cli.execute(["profile", "delete", "retired"]), {
    deleted: "retired",
    default: "default",
  });
  assert.equal(
    await secrets.get("ai-cli-factory:profile-cli", "retired:token"),
    undefined,
  );
  await assert.rejects(stat(retiredDataDirectory), { code: "ENOENT" });

  await assert.rejects(
    cli.execute(["profile", "delete", "default"]),
    /set-default/,
  );
  await cli.execute(["profile", "set-default", "uat"]);
  await cli.execute(["profile", "set", "uat", "--url", "https://new-uat.test"]);
  assert.deepEqual(await cli.execute(["profile", "list"]), [
    { default: false, name: "default", url: "https://example.test" },
    { default: true, name: "uat", url: "https://new-uat.test" },
  ]);
  assert.deepEqual(await cli.execute(["profile", "delete", "default"]), {
    deleted: "default",
    default: "uat",
  });
  await assert.rejects(
    cli.execute(["profile", "delete", "uat"]),
    /only profile/,
  );
});

test("one command declaration serves JSON CLI and JSON-RPC execution", async (t) => {
  const stdout = capture();
  const stderr = capture();
  const { appArguments, profiles } = await profileFixture(t);
  await profiles.create("production", { url: "https://production.test" });
  const cli = createCli({
    name: "example-cli",
    description: "Example",
    profile: { defaults: { url: "https://example.test" } },
    commands: [
      command("things", "Things", [
        command("show <id>", "Show one thing", ({ args }, context) => ({
          appDataDirectory: context.appArguments.AppDataDirectory,
          id: args.id,
          profile: context.profile.name,
        })),
      ]),
    ],
    runtime: {
      input: Readable.from([]),
      output: stdout.stream,
      error: stderr.stream,
      appArguments,
      profileStore: profiles,
      secretStore: new MemorySecretStore(),
    },
  });

  assert.equal(await cli.run(["things", "show", "42", "--json"]), 0);
  assert.equal(
    stdout.text(),
    `${JSON.stringify({
      appDataDirectory: appArguments.AppDataDirectory,
      id: "42",
      profile: "default",
    })}\n`,
  );
  assert.equal(stderr.text(), "");
  assert.deepEqual(await cli.execute(["things", "show", "7"]), {
    appDataDirectory: appArguments.AppDataDirectory,
    id: "7",
    profile: "default",
  });
  assert.deepEqual(
    await cli.execute(["--profile", "production", "things", "show", "8"]),
    {
      appDataDirectory: appArguments.WithProfile("production").AppDataDirectory,
      id: "8",
      profile: "production",
    },
  );
});

test("JSON-RPC keeps accepting commands and emits protocol-only stdout", async (t) => {
  const { appArguments, profiles } = await profileFixture(t);
  const stdout = capture();
  const stderr = capture();
  const input = Readable.from([
    '{"jsonrpc":"2.0","id":1,"method":"cli.execute","params":{"argv":["ping"]}}\n',
    '{"jsonrpc":"2.0","id":2,"method":"missing"}\n',
    '{"jsonrpc":"2.0","id":3,"method":"cli.execute","params":{"argv":["ping","--help"]}}\n',
  ]);
  const cli = createCli({
    name: "example-cli",
    description: "Example",
    commands: [command("ping", "Ping", async () => ({ ok: true }))],
    runtime: {
      input,
      output: stdout.stream,
      error: stderr.stream,
      appArguments,
      profileStore: profiles,
      secretStore: new MemorySecretStore(),
    },
  });

  assert.equal(await cli.run(["--json-rpc"]), 0);
  const frames = stdout
    .text()
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.deepEqual(frames.slice(0, 2), [
    { jsonrpc: "2.0", id: 1, result: { ok: true } },
    {
      jsonrpc: "2.0",
      id: 2,
      error: { code: -32601, message: "Method not found" },
    },
  ]);
  assert.equal(frames.length, 3);
  assert.equal(frames[2]?.jsonrpc, "2.0");
  assert.equal(frames[2]?.id, 3);
  assert.match(frames[2]?.result?.help ?? "", /Usage: example-cli ping/);
  assert.equal(stderr.text(), "");
});

test("permission gates default to read-only and stay isolated by profile", async (t) => {
  const { appArguments, profiles } = await profileFixture(t, "guarded-cli");
  await profiles.create("production", { url: "https://production.test" });
  let writes = 0;
  const cli = createCli({
    name: "guarded-cli",
    description: "Guarded example",
    permissions: {},
    commands: [
      command("read", "Read state", async () => "read", {
        permission: Permission.ReadOnly,
      }),
      command(
        "write",
        "Change state",
        async () => {
          writes += 1;
          return "written";
        },
        {
          permission: Permission.Update,
        },
      ),
    ],
    runtime: {
      input: Readable.from([]),
      output: capture().stream,
      error: capture().stream,
      appArguments,
      profileStore: profiles,
      secretStore: new MemorySecretStore(),
    },
  });

  assert.equal(await cli.execute(["read"]), "read");
  assert.deepEqual(await cli.execute(["permissions", "list"]), [
    {
      name: "ReadOnly",
      enabled: true,
      description: "Read remote state without changing it",
    },
    {
      name: "Update",
      enabled: false,
      description: "Perform operations that may change remote state",
    },
  ]);
  await assert.rejects(
    cli.execute(["write"]),
    /Permission 'Update' is disabled/,
  );
  assert.equal(writes, 0);

  assert.deepEqual(await cli.execute(["permissions", "grant", "Update"]), {
    profile: "default",
    permission: "Update",
    enabled: true,
  });
  assert.equal(await cli.execute(["write"]), "written");
  assert.equal(writes, 1);
  await assert.rejects(
    cli.execute(["--profile", "production", "write"]),
    /Permission 'Update' is disabled for profile 'production'/,
  );
});

test("enabling the permission gate requires every service leaf to declare a category", () => {
  assert.throws(
    () =>
      createCli({
        name: "invalid-cli",
        description: "Invalid example",
        permissions: {},
        commands: [
          command("unsafe", "Missing category", async () => undefined),
        ],
      }),
    /must declare a permission/,
  );
});

test("required options share parsing, defaults, help and JSON-RPC validation", async (t) => {
  const { appArguments, profiles } = await profileFixture(t, "options-cli");
  const stdout = capture();
  let calls = 0;
  const cli = createCli({
    name: "options-cli",
    description: "Required options example",
    commands: [
      command(
        "create",
        "Create a thing",
        ({ options }) => {
          calls += 1;
          return options;
        },
        {
          options: [
            {
              flags: "--name <name>",
              description: "Thing name",
              required: true,
              parse: (v) => v.trim(),
            },
            {
              flags: "--count <count>",
              description: "Count",
              required: true,
              defaultValue: 1,
              parse: Number,
            },
          ],
        },
      ),
    ],
    runtime: {
      input: Readable.from([
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "cli.execute",
          params: { argv: ["create"] },
        }) + "\n",
        JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "cli.execute",
          params: { argv: ["create", "--name", "rpc"] },
        }) + "\n",
      ]),
      output: stdout.stream,
      error: capture().stream,
      appArguments,
      profileStore: profiles,
      secretStore: new MemorySecretStore(),
    },
  });
  await assert.rejects(cli.execute(["create"]), /required option.*--name/);
  assert.equal(calls, 0);
  assert.deepEqual(
    await cli.execute(["create", "--name", " example ", "--count", "2"]),
    {
      name: "example",
      count: 2,
    },
  );
  const help = JSON.stringify(await cli.execute(["create", "--help"]));
  assert.match(help, /--name <name>/);
  assert.match(help, /Thing name \(required\)/);
  assert.equal(await cli.run(["--json-rpc"]), 0);
  const frames = stdout
    .text()
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.match(frames[0].error.message, /required option.*--name/);
  assert.deepEqual(frames[1].result, { name: "rpc", count: 1 });
  assert.equal(calls, 2);
});
