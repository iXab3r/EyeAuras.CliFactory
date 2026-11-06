import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import test from "node:test";
import { command, createCli, type AuthDefinition } from "../src/index.js";
import { createCliFixture } from "../src/testing.js";

test("built-in configure, login and status share readable identities and unchanged machine values", async (t) => {
  for (const identity of [
    { url: "https://service.example.test/", reachable: true, user: "operator", roles: ["reader", "monitor"] },
    { role: "reader", validation: { mode: "local", providers: ["fixture"] } },
    { mode: "remote", readerStored: true, publisherStored: false },
    null, undefined,
  ]) {
    const fixture = await createCliFixture(t, { applicationId: "auth-output-cli" });
    const auth: AuthDefinition = {
      async login() { return { authenticated: true, identity }; },
      async status() { return { authenticated: identity !== undefined, identity }; },
      async logout() {},
    };
    const app = fixture.createApplication(runtime => createCli({
      name: "auth-output-cli", description: "Inspect auth output", auth,
      profile: { fields: [{ name: "url", flags: "--url <url>", description: "Service URL", required: true }] },
      commands: [command("inspect", "Inspect identity", () => identity)], runtime,
    }));
    const commands = [
      ["profile", "configure", "default", "--url", "https://service.example.test/"],
      ["auth", "login"], ["auth", "status"],
    ];
    const expected = [
      { configured: true, profile: "default", authenticated: true, identity: identity ?? null },
      { authenticated: true, identity: identity ?? null, profile: "default" },
      { authenticated: identity !== undefined, identity, profile: "default" },
    ];
    for (const [index, argv] of commands.entries()) {
      const result = await fixture.run(app, argv);
      assert.equal(result.exitCode, 0, result.stderr);
      assert.match(result.stdout, /profile: default/);
      assert.doesNotMatch(result.stdout, /identity: \{/);
      if (identity != null) {
        assert.match(result.stdout, /identity:\n  /);
        if ("roles" in identity) assert.match(result.stdout, /roles:\n    - reader\n    - monitor/);
      } else assert.match(result.stdout, /identity: \n/);
      assert.deepEqual(await app.execute(argv), expected[index]);
      assert.deepEqual(await fixture.json(app, argv), JSON.parse(JSON.stringify(expected[index])));
    }
    const replies = await fixture.rpc(app, commands) as { result: unknown }[];
    assert.deepEqual(replies.map(reply => reply.result), JSON.parse(JSON.stringify(expected)));
  }
});

test("implicit interactive root onboarding renders its nested identity through the same fallback", async (t) => {
  const fixture = await createCliFixture(t, { applicationId: "onboarding-output-cli" });
  let stdout = "", stderr = "";
  const input = Object.assign(Readable.from(["https://service.example.test/\n"]), { isTTY: true });
  const output = Object.assign(new Writable({
    write(chunk, _encoding, done) { stdout += chunk.toString(); done(); },
  }), { isTTY: true });
  const error = Object.assign(new Writable({
    write(chunk, _encoding, done) { stderr += chunk.toString(); done(); },
  }), { isTTY: true });
  const identity = { user: "operator", roles: ["reader"] };
  const app = fixture.createApplication(runtime => createCli({
    name: "onboarding-output-cli", description: "Configure a service",
    profile: { fields: [{ name: "url", flags: "--url <url>", description: "Service URL", required: true }] },
    auth: {
      async login() { return { authenticated: true, identity }; },
      async status() { return { authenticated: false }; },
      async logout() {},
    },
    commands: [command("inspect", "Inspect configuration", () => identity)], runtime,
  }));
  assert.equal(await app.run([], { input, output, error, environment: {} }), 0, stderr);
  assert.match(stderr, /Service URL:/);
  assert.match(stdout, /configured: true/);
  assert.match(stdout, /identity:\n  user: operator\n  roles:\n    - reader/);
  assert.deepEqual((await fixture.profileStore.get("default")).values, { url: "https://service.example.test/" });
});
