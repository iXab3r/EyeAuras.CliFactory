import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import {
  command, createCli, Permission,
  type CommandContext, type CommandDefinition, type CommandInput,
} from "@eyeauras/cli-factory";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { TeamCityClient } from "../src/client.js";
import { clientLeaf, type ClientLeaf } from "../src/command-support.js";
import { createTestRuntime } from "./support.js";

// Compiled, never invoked. An unused @ts-expect-error fails the workspace build.
function wrapperInferenceChecks(
  clientFor: (context: CommandContext) => Promise<TeamCityClient>,
  dynamic: string,
  union: "show <id>" | "show <other>",
  template: `show <id${number}>`,
) {
  const leaf = clientLeaf(clientFor);
  const required = leaf("show <job-id> <stepID>", "Show", Permission.ReadOnly, (client, { args, options }) => {
    const job: string = args["job-id"];
    const step: string = args.stepID;
    // @ts-expect-error A typo is not a declared positional name.
    args.stepId;
    // @ts-expect-error The wrapper must not broaden an unknown hyphenated name.
    args["jobID"];
    // @ts-expect-error Positional inference leaves options broad.
    const fields: string = options.fields;
    return client.getStep(job, step);
  });
  leaf("list", "No arguments", Permission.ReadOnly, (_client, { args }) => {
    // @ts-expect-error No-argument literals have no positional properties.
    args.id;
  });
  const annotated = (_client: TeamCityClient, { args }: CommandInput) => {
    // @ts-expect-error An explicit broad callback annotation still owns its input type.
    const id: string = args.id;
    return args.id;
  };
  const definitions: readonly CommandDefinition[] = [
    required, leaf("show <id>", "Broad annotation", Permission.ReadOnly, annotated),
  ];
  command("steps", "Compose existing definitions", definitions);
  function composed(wrapped: ClientLeaf) {
    return wrapped("show <id>", "Forwarded wrapper", Permission.ReadOnly, (client, { args }) => {
      const id: string = args.id;
      // @ts-expect-error Passing ClientLeaf to another builder retains typo checking.
      args.other;
      return client.getVcsRoot(id);
    });
  }
  composed(leaf);
  leaf(dynamic, "Dynamic", Permission.ReadOnly, (_client, { args }) => {
    args.arbitrary;
    // @ts-expect-error Dynamic names cannot promise a string ID.
    const id: string = args.id;
  });
  leaf(union, "Union", Permission.ReadOnly, (_client, { args }) => {
    args.arbitrary;
    // @ts-expect-error A union falls back for the whole declaration.
    const id: string = args.id;
  });
  leaf(template, "Template", Permission.ReadOnly, (_client, { args }) => {
    args.arbitrary;
    // @ts-expect-error A partly literal template is not an exact declaration.
    const id: string = args.id42;
  });
  leaf("show <id> <id>", "Duplicate", Permission.ReadOnly, (_client, { args }) => {
    args.arbitrary;
    // @ts-expect-error Duplicate names invalidate the whole declaration.
    const id: string = args.id;
  });
  leaf("show <id> [child]", "Optional", Permission.ReadOnly, (_client, { args }) => {
    args.arbitrary;
    // @ts-expect-error Do not partially infer the earlier required ID.
    const id: string = args.id;
  });
  leaf("show <id> <children...>", "Variadic", Permission.ReadOnly, (_client, { args }) => {
    args.arbitrary;
    // @ts-expect-error Variadic syntax invalidates even the required ID.
    const id: string = args.id;
  });
  leaf("show  <id>", "Whitespace", Permission.ReadOnly, (_client, { args }) => {
    args.arbitrary;
    // @ts-expect-error Repeated spaces are outside the inferred grammar.
    const id: string = args.id;
  });
  leaf("show <résumé>", "Unsupported name", Permission.ReadOnly, (_client, { args }) => {
    args.arbitrary;
    // @ts-expect-error Unsupported characters retain the broad input type.
    const id: string = args["résumé"];
  });
}

const server = setupServer();
test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());

test("literal TeamCity wrapper preserves both argument strings through execute, JSON and persistent RPC", async (t) => {
  const f = await createTestRuntime(t);
  const cli = f.createCli();
  const step = { id: "007 /?#%é", name: "Fixture step", type: "fixtureRunner", disabled: false };
  const expected = { ...step, properties: [] };
  let requests = 0;
  server.use(http.get("https://teamcity.test/app/rest/*", ({ request }) => {
    requests++;
    const url = new URL(request.url);
    assert.equal(url.pathname, "/app/rest/buildTypes/id:Fixture_Job/steps/007%20%2F%3F%23%25%C3%A9");
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      fields: "id,name,type,disabled,inherited,properties(property(name,value,inherited,type(rawValue)))",
    });
    assert.equal(request.headers.get("authorization"), "Bearer fixture-token");
    return HttpResponse.json(step);
  }));
  const argv = ["jobs", "steps", "show", "Fixture_Job", step.id];
  assert.deepEqual(await cli.execute(argv), expected);
  assert.equal(await cli.run([...argv, "--json"]), 0);
  assert.deepEqual(JSON.parse(f.stdout()), expected);
  f.resetOutput();
  const frames = [argv.slice(0, -1), argv].map((args, index) => JSON.stringify({
    jsonrpc: "2.0", id: index + 1, method: "cli.execute", params: { argv: args },
  })).join("\n") + "\n";
  assert.equal(await cli.run(["--json-rpc"], { input: Readable.from([frames]) }), 0);
  const replies = f.stdout().trim().split("\n").map(line => JSON.parse(line));
  assert.equal(replies.length, 2);
  assert.match(replies[0].error.message, /missing required argument 'step-id'/);
  assert.deepEqual(replies[1].result, expected);
  assert.equal(requests, 3);
  assert.equal(f.stderr(), "");
});

test("wrapper fallback syntax keeps optional and variadic runtime values and binds only after parsing", async (t) => {
  const f = await createTestRuntime(t);
  let bindings = 0;
  const leaf = clientLeaf(async () => {
    bindings++;
    return new TeamCityClient({ baseUrl: "https://teamcity.test", guest: true });
  });
  const cli = f.createApplication(runtime => createCli({
    name: "teamcity-cli", description: "Wrapper parsing fixture", permissions: {}, runtime,
    commands: [
      leaf("show <id> <child>", "Required", Permission.ReadOnly, (_client, { args }) => args),
      leaf("optional <id> [child]", "Optional", Permission.ReadOnly, (_client, { args }) => args),
      leaf("many <id> [children...]", "Variadic", Permission.ReadOnly, (_client, { args }) => args),
      leaf("change <id>", "Update", Permission.Update, (_client, { args }) => args),
    ],
  }));
  await assert.rejects(cli.execute(["show", "007"]), /missing required argument 'child'/);
  await assert.rejects(cli.execute(["change", "007"]), /Permission 'Update' is disabled/);
  assert.equal(bindings, 0);
  assert.deepEqual(await cli.execute(["optional", "007"]), { id: "007", child: undefined });
  assert.deepEqual(await cli.execute(["optional", "007", "child"]), { id: "007", child: "child" });
  assert.deepEqual(await cli.execute(["many", "007", "first", "second"]), {
    id: "007", children: ["first", "second"],
  });
  assert.equal(bindings, 3);
});
