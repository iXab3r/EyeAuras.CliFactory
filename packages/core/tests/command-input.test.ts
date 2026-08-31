import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import test, { type TestContext } from "node:test";
import {
  AppArguments, command, createCli, MemorySecretStore, Permission,
  type CommandDefinition, type CommandHandler, type CommandInput,
} from "../src/index.js";

// Compiled but not invoked: unused @ts-expect-error directives fail the repository build.
function inferenceChecks(
  dynamic: string,
  union: "read <id>" | "read <other>",
  numberTemplate: `read <${number}>`,
  stringTemplate: `read <${string}>`,
  embeddedTemplate: `read <id${number}>`,
  commandTemplate: `read${number} <id>`,
) {
  const required = command("read <id> <childID>", "Read", ({ args, options }) => {
    const id: string = args.id;
    const child: string = args.childID;
    // @ts-expect-error Undeclared names must fail even without using their values.
    args.child;
    // @ts-expect-error Option inference is deliberately outside this contract.
    const option: string = options.fields;
    return { id, child, option };
  });
  command("list", "No positional arguments", ({ args }) => {
    // @ts-expect-error A no-argument literal has no positional properties.
    args.id;
  });
  const annotated: CommandHandler = ({ args }) => args.id;
  const definitions: readonly CommandDefinition[] = [
    required,
    command("read <id>", "Broad handler annotation", annotated),
    command("read <id>", "Broad input annotation", ({ args }: CommandInput) => args.id),
  ];
  command("resources", "Branch composition", definitions);

  command(dynamic, "Dynamic names stay broad", ({ args }) => {
    args.arbitrary;
    // @ts-expect-error A dynamic name cannot guarantee a string ID.
    const id: string = args.id;
  });
  command(union, "Literal unions stay broad", ({ args }) => {
    args.arbitrary;
    // @ts-expect-error A union must not infer either alternative's required ID.
    const id: string = args.id;
  });
  command(numberTemplate, "Numeric templates stay broad", ({ args }) => {
    args.arbitrary;
    // @ts-expect-error Numeric templates must not manufacture trusted numeric keys.
    const id: string = args["42"];
  });
  command(stringTemplate, "String templates stay broad", ({ args }) => {
    args.arbitrary;
    // @ts-expect-error String templates must not infer Record<string, string>.
    const id: string = args.id;
  });
  command(embeddedTemplate, "Partly literal templates stay broad", ({ args }) => {
    args.arbitrary;
    // @ts-expect-error A literal prefix does not make a template an exact name.
    const id: string = args.id42;
  });
  command(commandTemplate, "Dynamic command tokens stay broad", ({ args }) => {
    args.arbitrary;
    // @ts-expect-error Inference requires the complete literal declaration.
    const id: string = args.id;
  });
  command("read <id> <id>", "Duplicates stay broad", ({ args }) => {
    args.arbitrary;
    // @ts-expect-error Duplicate positional keys are not inferred.
    const id: string = args.id;
  });
  command("read <id> [other]", "Optional tokens invalidate complete inference", ({ args }) => {
    args.arbitrary;
    // @ts-expect-error Do not partially trust the earlier required token.
    const id: string = args.id;
  });
  command("read <ids...>", "Required variadic stays broad", ({ args }) => {
    args.arbitrary;
    // @ts-expect-error Variadic inference is not claimed.
    const ids: string[] = args.ids;
  });
  command("read [ids...]", "Optional variadic stays broad", ({ args }) => {
    args.arbitrary;
    // @ts-expect-error Variadic inference is not claimed.
    const ids: string[] = args.ids;
  });
  command("read  <id>", "Repeated spaces stay broad", ({ args }) => {
    args.arbitrary;
    // @ts-expect-error Only single ASCII spaces are inferred.
    const id: string = args.id;
  });
  command("read\t<id>", "Tabs stay broad", ({ args }) => {
    args.arbitrary;
    // @ts-expect-error Runtime whitespace support is wider than inference.
    const id: string = args.id;
  });
  command("read <id>\u00a0<other>", "Unicode whitespace stays broad", ({ args }) => {
    args.arbitrary;
    // @ts-expect-error A non-ASCII separator invalidates the complete declaration.
    const id: string = args.id;
  });
  command(" read <id> ", "Outer whitespace stays broad", ({ args }) => {
    args.arbitrary;
    // @ts-expect-error Runtime trimming does not imply type-level trimming.
    const id: string = args.id;
  });
  command("read id", "Bare argument syntax stays broad", ({ args }) => {
    args.arbitrary;
    // @ts-expect-error Only explicitly bracketed required tokens are inferred.
    const id: string = args.id;
  });
  command("read <résumé>", "Non-ASCII names stay broad", ({ args }) => {
    args.arbitrary;
    // @ts-expect-error Unsupported names must not be partially inferred.
    const id: string = args["résumé"];
  });
}

async function fixture(t: TestContext, input = "", configured = true) {
  const directory = await mkdtemp(join(tmpdir(), "cli-positional-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let stdout = "";
  let stderr = "";
  let fetches = 0;
  const cli = createCli({
    name: "positional-cli",
    description: "Positional contract fixture",
    permissions: {},
    profile: {
      defaults: configured ? { url: "https://service.example.test" } : {},
      fields: [{ name: "url", flags: "--url <url>", description: "URL", required: true }],
    },
    commands: [
      command("read <id> <child>", "Read", ({ args }) => args, { permission: Permission.ReadOnly }),
      command("optional [id]", "Optional", ({ args }) => args, { permission: Permission.ReadOnly }),
      command("many [ids...]", "Variadic", ({ args }) => args, { permission: Permission.ReadOnly }),
      command("required-many <ids...>", "Required variadic", ({ args }) => args, { permission: Permission.ReadOnly }),
      command(" spaced\t<id> ", "Whitespace", ({ args }) => args, { permission: Permission.ReadOnly }),
      command("change <id>", "Update", (_input, context) => context.fetch("https://service.example.test"), {
        permission: Permission.Update,
      }),
    ],
    runtime: {
      appArguments: new AppArguments({ AppName: "positional-cli", Environment: {
        AppDomainDirectory: join(directory, "executable"),
        ApplicationExecutablePath: join(directory, "executable", "cli.js"),
        EnvironmentAppData: join(directory, "roaming"),
        EnvironmentLocalAppData: join(directory, "local"),
        ProcessId: 1,
      } }),
      input: Readable.from([input]),
      output: new Writable({ write(chunk, _encoding, done) { stdout += chunk.toString(); done(); } }),
      error: new Writable({ write(chunk, _encoding, done) { stderr += chunk.toString(); done(); } }),
      secretStore: new MemorySecretStore(),
      fetch: async () => { fetches++; throw new Error("Unexpected fixture fetch."); },
    },
  });
  return { cli, stdout: () => stdout, stderr: () => stderr, fetches: () => fetches };
}

test("literal required arguments keep their values through execute and JSON rendering", async (t) => {
  const f = await fixture(t);
  const expected = { id: "fixture /?#%é", child: "007" };
  assert.deepEqual(await f.cli.execute(["read", expected.id, expected.child]), expected);
  assert.equal(await f.cli.run(["read", expected.id, expected.child, "--json"]), 0);
  assert.deepEqual(JSON.parse(f.stdout()), expected);
  assert.equal(f.stderr(), "");
  assert.equal(f.fetches(), 0);
});

test("optional, variadic and whitespace fallback declarations keep wider runtime parsing", async (t) => {
  const f = await fixture(t);
  assert.deepEqual(await f.cli.execute(["optional"]), { id: undefined });
  assert.deepEqual(await f.cli.execute(["optional", "fixture-id"]), { id: "fixture-id" });
  assert.deepEqual(await f.cli.execute(["many"]), { ids: [] });
  assert.deepEqual(await f.cli.execute(["many", "a", "b"]), { ids: ["a", "b"] });
  assert.deepEqual(await f.cli.execute(["required-many", "a", "b"]), { ids: ["a", "b"] });
  await assert.rejects(f.cli.execute(["required-many"]), /missing required argument/);
  assert.deepEqual(await f.cli.execute(["spaced", "fixture-id"]), { id: "fixture-id" });
});

test("missing required arguments reject before configuration and Update before fetch", async (t) => {
  const missing = await fixture(t, "", false);
  await assert.rejects(missing.cli.execute(["read", "fixture-id"]), /missing required argument 'child'/);
  assert.equal(await missing.cli.run(["read", "fixture-id", "--json"]), 1);
  assert.match(missing.stderr(), /missing required argument 'child'/);
  assert.doesNotMatch(missing.stderr(), /profile configure/);
  assert.equal(missing.stdout(), "");
  assert.equal(missing.fetches(), 0);
  const configured = await fixture(t);
  await assert.rejects(configured.cli.execute(["change", "fixture-id"]), /Permission 'Update' is disabled/);
  assert.equal(configured.fetches(), 0);
});

test("RPC continues after a positional error and uses the same inferred declaration", async (t) => {
  const input = [["read", "first"], ["read", "first", "second"]].map((argv, index) => JSON.stringify({
    jsonrpc: "2.0", id: index + 1, method: "cli.execute", params: { argv },
  })).join("\n") + "\n";
  const f = await fixture(t, input);
  assert.equal(await f.cli.run(["--json-rpc"]), 0);
  const frames = f.stdout().trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(frames.length, 2);
  assert.match(frames[0].error.message, /missing required argument 'child'/);
  assert.deepEqual(frames[1].result, { id: "first", child: "second" });
  assert.equal(f.stderr(), "");
  assert.equal(f.fetches(), 0);
});
