import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import test from "node:test";
import {
  command,
  createCli,
  MemorySecretStore,
  Permission,
  type Profile,
  type ProfileStoreContract,
} from "../src/index.js";

class MemoryProfiles implements ProfileStoreContract {
  readonly #profiles = new Map<string, Record<string, unknown>>([
    ["default", { url: "https://example.test" }],
  ]);
  #active = "default";
  readonly #permissions = new Map<string, readonly string[]>();

  public async get(name = this.#active): Promise<Profile> {
    const values = this.#profiles.get(name);
    if (!values) throw new Error(`Missing profile ${name}`);
    return { name, values };
  }
  public async list() {
    return {
      active: this.#active,
      profiles: [...this.#profiles].map(([name, values]) => ({ name, values })),
    };
  }
  public async set(name: string, values: Record<string, unknown>): Promise<Profile> {
    const merged = { ...(this.#profiles.get(name) ?? {}), ...values };
    this.#profiles.set(name, merged);
    return { name, values: merged };
  }
  public async use(name: string): Promise<Profile> {
    const profile = await this.get(name);
    this.#active = name;
    return profile;
  }
  public async getPermissions(name = this.#active): Promise<readonly string[] | undefined> {
    return this.#permissions.get(name);
  }
  public async setPermissions(
    name: string,
    permissions: readonly string[],
  ): Promise<readonly string[]> {
    const stored = [...permissions];
    this.#permissions.set(name, stored);
    return stored;
  }
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

test("running the root command without arguments shows help successfully", async () => {
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
      profileStore: new MemoryProfiles(),
      secretStore: new MemorySecretStore(),
    },
  });

  assert.equal(await cli.run([]), 0);
  assert.match(stdout.text(), /Usage: example-cli/);
  assert.match(stdout.text(), /ping/);
  assert.equal(stderr.text(), "");
});

test("one command declaration serves JSON CLI and JSON-RPC execution", async () => {
  const stdout = capture();
  const stderr = capture();
  const cli = createCli({
    name: "example-cli",
    description: "Example",
    profile: { defaults: { url: "https://example.test" } },
    commands: [
      command("things", "Things", [
        command("show <id>", "Show one thing", ({ args }, context) => ({
          id: args.id,
          profile: context.profile.name,
        })),
      ]),
    ],
    runtime: {
      input: Readable.from([]),
      output: stdout.stream,
      error: stderr.stream,
      profileStore: new MemoryProfiles(),
      secretStore: new MemorySecretStore(),
    },
  });

  assert.equal(await cli.run(["things", "show", "42", "--json"]), 0);
  assert.equal(stdout.text(), '{"id":"42","profile":"default"}\n');
  assert.equal(stderr.text(), "");
  assert.deepEqual(await cli.execute(["things", "show", "7"]), {
    id: "7",
    profile: "default",
  });
});

test("JSON-RPC keeps accepting commands and emits protocol-only stdout", async () => {
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
      profileStore: new MemoryProfiles(),
      secretStore: new MemorySecretStore(),
    },
  });

  assert.equal(await cli.run(["--json-rpc"]), 0);
  const frames = stdout.text().trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(frames.slice(0, 2), [
    { jsonrpc: "2.0", id: 1, result: { ok: true } },
    { jsonrpc: "2.0", id: 2, error: { code: -32601, message: "Method not found" } },
  ]);
  assert.equal(frames.length, 3);
  assert.equal(frames[2]?.jsonrpc, "2.0");
  assert.equal(frames[2]?.id, 3);
  assert.match(frames[2]?.result?.help ?? "", /Usage: example-cli ping/);
  assert.equal(stderr.text(), "");
});

test("permission gates default to read-only and stay isolated by profile", async () => {
  const profiles = new MemoryProfiles();
  await profiles.set("production", { url: "https://production.test" });
  let writes = 0;
  const cli = createCli({
    name: "guarded-cli",
    description: "Guarded example",
    permissions: {},
    commands: [
      command("read", "Read state", async () => "read", {
        permission: Permission.ReadOnly,
      }),
      command("write", "Change state", async () => {
        writes += 1;
        return "written";
      }, {
        permission: Permission.Update,
      }),
    ],
    runtime: {
      input: Readable.from([]),
      output: capture().stream,
      error: capture().stream,
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
  await assert.rejects(cli.execute(["write"]), /Permission 'Update' is disabled/);
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
        commands: [command("unsafe", "Missing category", async () => undefined)],
      }),
    /must declare a permission/,
  );
});
