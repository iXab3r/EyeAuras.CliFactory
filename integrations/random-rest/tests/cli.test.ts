import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createCli } from "@eyeauras/cli-factory";
import { createRandomRestDefinition } from "../src/cli.js";
import { runtimeFor } from "./support.js";

const server = setupServer();
test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());

test("help exposes exactly two service commands and no auth flow", async (context) => {
  const io = await runtimeFor(context);
  const cli = createCli(createRandomRestDefinition(io.runtime));
  assert.equal(await cli.run(["--help"]), 0);
  for (const command of ["integers", "sequence", "profile", "permissions"])
    assert.match(io.stdout(), new RegExp(command));
  assert.doesNotMatch(io.stdout(), /\bauth\b|\bstrings\b/);
});

test("CLI defaults and human/JSON/programmatic output use the same declaration", async (context) => {
  server.use(
    http.get("https://random.test/quota/", () => HttpResponse.text("1000")),
    http.get("https://random.test/integers/", ({ request }) => {
      const query = new URL(request.url).searchParams;
      assert.equal(query.get("num"), "1");
      assert.equal(query.get("min"), "1");
      assert.equal(query.get("max"), "100");
      return HttpResponse.text("42\n");
    }),
    http.get("https://random.test/sequences/", () =>
      HttpResponse.text("10 9 8 7 6 5 4 3 2 1"),
    ),
  );
  const io = await runtimeFor(context);
  const cli = createCli(createRandomRestDefinition(io.runtime));
  assert.equal(await cli.run(["integers", "--json"]), 0);
  assert.deepEqual(JSON.parse(io.stdout()), { values: [42] });
  assert.equal(io.stderr(), "");
  io.reset();
  assert.equal(await cli.run(["integers"]), 0);
  assert.equal(io.stdout(), "values: [42]\n");
  io.reset();
  assert.deepEqual(await cli.execute(["sequence"]), {
    values: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  });
  assert.equal(io.stdout(), "");
});

test("invalid options and revoked permissions never reach the network", async (context) => {
  const io = await runtimeFor(context);
  let calls = 0;
  io.runtime.fetch = async () => {
    calls++;
    throw new Error("Unexpected network");
  };
  const cli = createCli(createRandomRestDefinition(io.runtime));
  for (const argv of [
    ["integers", "--count", "101"],
    ["integers", "--count", "0"],
    ["integers", "--min", "1.5"],
    ["integers", "--max", "Infinity"],
    ["integers", "--count", "2junk"],
    ["integers", "--count", ""],
    ["integers", "--min", "5", "--max", "4"],
    ["sequence", "--max", "101"],
    ["integers", "--min", "7", "--max", "7"],
    ["sequence", "--min", "0", "--max", "0"],
  ]) {
    io.reset();
    assert.equal(await cli.run(argv), 1);
    assert.equal(io.stdout(), "");
  }
  await io.profileStore.setPermissions("default", []);
  io.reset();
  assert.equal(await cli.run(["integers", "--json"]), 1);
  assert.match(io.stderr(), /Permission 'ReadOnly' is disabled/);
  assert.equal(calls, 0);
});

test("profile configuration needs contact but no API key, network or secret store", async (context) => {
  const io = await runtimeFor(context);
  io.runtime.fetch = async () => {
    throw new Error("Configuration must not fetch");
  };
  const cli = createCli(createRandomRestDefinition(io.runtime));
  assert.equal(
    await cli.run([
      "profile",
      "configure",
      "demo",
      "--contact",
      "demo@example.com",
      "--json",
    ]),
    0,
  );
  assert.equal(
    (await io.profileStore.get("demo")).values.contact,
    "demo@example.com",
  );
  assert.equal(
    await io.runtime.secretStore!.get(
      "ai-cli-factory:random-rest-cli",
      "demo:token",
    ),
    undefined,
  );
  await io.profileStore.set("default", { contact: "" });
  io.reset();
  assert.equal(await cli.run(["integers", "--json"]), 1);
  assert.match(io.stderr(), /profile configure default --contact/);
  assert.doesNotMatch(io.stderr(), /token|keyring/);
});

test("JSON-RPC preserves URL/contact/permissions per profile and uses fresh invocation configuration", async (context) => {
  const calls: string[] = [];
  for (const [host, email, value] of [
    ["alpha.test", "alpha@example.com", 1],
    ["beta.test", "beta@example.com", 2],
  ] as const) {
    server.use(
      http.get(`https://${host}/quota/`, ({ request }) => {
        assert.match(
          request.headers.get("user-agent") ?? "",
          new RegExp(email),
        );
        return HttpResponse.text("100");
      }),
      http.get(`https://${host}/integers/`, () => {
        calls.push(host);
        return HttpResponse.text(String(value));
      }),
    );
  }
  const input =
    ["alpha", "beta", "denied"]
      .map((profile, index) =>
        JSON.stringify({
          jsonrpc: "2.0",
          id: index + 1,
          method: "cli.execute",
          params: { argv: ["integers", "--profile", profile] },
        }),
      )
      .join("\n") + "\n";
  const io = await runtimeFor(context, input);
  await io.profileStore.create("alpha", {
    url: "https://alpha.test",
    contact: "alpha@example.com",
  });
  await io.profileStore.create("beta", {
    url: "https://beta.test",
    contact: "beta@example.com",
  });
  await io.profileStore.create("denied", {
    url: "https://alpha.test",
    contact: "alpha@example.com",
  });
  await io.profileStore.setPermissions("denied", []);
  const cli = createCli(createRandomRestDefinition(io.runtime));
  assert.equal(await cli.run(["--json-rpc"]), 0);
  const frames = io
    .stdout()
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.deepEqual(
    frames.map((frame) => frame.id),
    [1, 2, 3],
  );
  assert.deepEqual(frames[0].result, { values: [1] });
  assert.deepEqual(frames[1].result, { values: [2] });
  assert.match(frames[2].error.message, /ReadOnly/);
  await io.profileStore.set("alpha", {
    url: "https://beta.test",
    contact: "beta@example.com",
  });
  assert.deepEqual(await cli.execute(["integers", "--profile", "alpha"]), {
    values: [2],
  });
  assert.deepEqual(calls, ["alpha.test", "beta.test", "beta.test"]);
});

test("cheap clients share quota backoff within a profile and reset only changed profiles", async (context) => {
  const io = await runtimeFor(context);
  let requests = 0;
  io.runtime.fetch = async () => {
    requests++;
    return new Response("-1");
  };
  const cli = createCli(createRandomRestDefinition(io.runtime));
  context.after(() => cli.dispose());
  await io.profileStore.create("other", {
    url: "https://random.test",
    contact: "other@example.com",
  });
  await assert.rejects(cli.execute(["integers"]), /quota is exhausted/);
  await assert.rejects(cli.execute(["sequence"]), /quota is exhausted/);
  assert.equal(requests, 1);
  await assert.rejects(
    cli.execute(["integers", "--profile", "other"]),
    /quota is exhausted/,
  );
  assert.equal(requests, 2);
  await cli.execute([
    "profile",
    "set",
    "default",
    "--contact",
    "changed@example.com",
  ]);
  await assert.rejects(
    cli.execute(["integers", "--profile", "other"]),
    /quota is exhausted/,
  );
  assert.equal(requests, 2);
  await assert.rejects(cli.execute(["integers"]), /quota is exhausted/);
  assert.equal(requests, 3);
});
