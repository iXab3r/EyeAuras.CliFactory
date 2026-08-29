import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import test from "node:test";
import {
  command,
  createCli,
  MemorySecretStore,
  type Profile,
  type ProfileStoreContract,
} from "../src/index.js";

class MemoryProfiles implements ProfileStoreContract {
  readonly #profiles = new Map<string, Record<string, unknown>>([
    ["default", { url: "https://example.test" }],
  ]);
  #active = "default";

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
    '{"jsonrpc":"2.0","id":3,"method":"cli.execute","params":{"argv":["--help"]}}\n',
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
  assert.match(frames[2]?.result?.help ?? "", /Usage: example-cli/);
  assert.equal(stderr.text(), "");
});
