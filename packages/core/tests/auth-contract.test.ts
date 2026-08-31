import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import { inspect } from "node:util";
import test, { type TestContext } from "node:test";
import {
  AppArguments,
  command,
  createCli,
  MemorySecretStore,
  Permission,
  ProfileStore,
  tokenAuth,
  type TokenValidationContext,
} from "../src/index.js";

const variable = "FACTORY_AUTH_CONTRACT_TEST_TOKEN";
const service = "ai-cli-factory:auth-contract-cli";
const oldUrl = "https://old.example.test";
const newUrl = "https://new.example.test";

function environment(t: TestContext, value?: string): void {
  const previous = process.env[variable];
  if (value === undefined) delete process.env[variable];
  else process.env[variable] = value;
  t.after(() => {
    if (previous === undefined) delete process.env[variable];
    else process.env[variable] = previous;
  });
}

async function harness(t: TestContext, options: {
  input?: string;
  tty?: boolean;
  validate?: (context: TokenValidationContext) => unknown;
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), "cli-auth-contract-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const appArguments = new AppArguments({
    AppName: "auth-contract-cli",
    Environment: {
      AppDomainDirectory: directory,
      ApplicationExecutablePath: join(directory, "auth-contract-cli.js"),
      EnvironmentAppData: join(directory, "roaming"),
      EnvironmentLocalAppData: join(directory, "local"),
      ProcessId: 1,
    },
  });
  let stdout = "";
  let stderr = "";
  const rawModes: boolean[] = [];
  const input = Object.assign(Readable.from([options.input ?? "synthetic-prompt\n"]), {
    isTTY: options.tty ?? false,
    setRawMode: (enabled: boolean) => { rawModes.push(enabled); },
  });
  const output = Object.assign(new Writable({
    write(chunk, _encoding, done) { stdout += chunk.toString(); done(); },
  }), { isTTY: options.tty ?? false });
  const error = Object.assign(new Writable({
    write(chunk, _encoding, done) { stderr += chunk.toString(); done(); },
  }), { isTTY: options.tty ?? false });
  const profile = {
    defaults: { url: oldUrl },
    fields: [{ name: "url", flags: "--url <url>", description: "Service URL", required: true }],
    validate(values: Record<string, unknown>) {
      if (typeof values.url !== "string" || !values.url.startsWith("https://")) {
        throw new Error("Service URL must use HTTPS.");
      }
    },
  };
  const profiles = new ProfileStore({ applicationId: "auth-contract-cli", appArguments, ...profile });
  await profiles.create("other", { url: "https://other.example.test" });
  await profiles.setPermissions("default", ["ReadOnly", "Update"]);
  const secrets = new MemorySecretStore();
  await secrets.set(service, "default:token", "synthetic-existing");
  await secrets.set(service, "other:token", "synthetic-other");
  const validated: TokenValidationContext[] = [];
  const cli = createCli({
    name: "auth-contract-cli",
    description: "Authentication contract fixture",
    profile,
    permissions: {},
    auth: tokenAuth({
      env: variable,
      async validate(context) {
        validated.push(context);
        return options.validate?.(context) ?? { id: "fixture-user" };
      },
    }),
    commands: [command("inspect", "Inspect", (_input, context) => context.profile, {
      permission: Permission.ReadOnly,
    })],
    runtime: { appArguments, profileStore: profiles, secretStore: secrets, input, output, error },
  });
  return {
    cli, profiles, secrets, input, output, error, rawModes, validated,
    stdout: () => stdout, stderr: () => stderr,
  };
}

async function assertOtherProfileUnchanged(h: Awaited<ReturnType<typeof harness>>): Promise<void> {
  assert.equal((await h.profiles.list()).active, "default");
  assert.deepEqual(await h.profiles.getPermissions("default"), ["ReadOnly", "Update"]);
  assert.equal((await h.profiles.get("other")).values.url, "https://other.example.test");
  assert.equal(await h.secrets.get(service, "other:token"), "synthetic-other");
}

test("configure and login use stdin, then environment, then masked terminal input", async (t) => {
  environment(t);
  for (const command of [["profile", "configure", "default"], ["auth", "login"]]) {
    for (const source of ["stdin", "environment", "prompt"]) {
      if (source === "prompt") delete process.env[variable];
      else process.env[variable] = "synthetic-environment";
      const h = await harness(t, { tty: true, input: "synthetic-stdin\n" });
      const expected = source === "stdin" ? "synthetic-stdin"
        : source === "environment" ? "synthetic-environment" : "synthetic-stdin";
      assert.equal(await h.cli.run([...command, ...(source === "stdin" ? ["--token-stdin"] : [])]), 0);
      assert.equal(h.validated.length, 1);
      assert.equal(h.validated[0]!.token, expected);
      assert.equal(await h.secrets.get(service, "default:token"), expected);
      assert.deepEqual(h.rawModes, source === "prompt" ? [true, false] : []);
      assert.doesNotMatch(h.stdout() + h.stderr(), /synthetic-/);
      await assertOtherProfileUnchanged(h);
    }
  }
});

test("explicit empty stdin and transport stdin refusal never fall through to environment or stored tokens", async (t) => {
  environment(t, "synthetic-environment");
  for (const command of [["profile", "configure", "default"], ["auth", "login"]]) {
    const h = await harness(t, { input: " \n", tty: true });
    assert.equal(await h.cli.run([...command, "--token-stdin", "--json"]), 1);
    assert.match(h.stderr(), /profile configure default --token-stdin/);
    await assert.rejects(h.cli.execute([...command, "--token-stdin"]), /stdin belongs to the transport/);
    assert.equal(h.validated.length, 0);
    assert.equal(await h.secrets.get(service, "default:token"), "synthetic-existing");
    assert.deepEqual(h.rawModes, []);
  }
});

test("JSON, programmatic, RPC and redirected streams never prompt or reuse stored tokens", async (t) => {
  environment(t);
  for (const command of [["profile", "configure", "default"], ["auth", "login"]]) {
    for (const mode of ["json", "execute", "rpc", "input", "output", "error"]) {
      const frames = [command, ["profile", "show"]].map((argv, id) => JSON.stringify({
        jsonrpc: "2.0", id, method: "cli.execute", params: { argv },
      })).join("\n") + "\n";
      const h = await harness(t, { tty: true, ...(mode === "rpc" ? { input: frames } : {}) });
      h.input.setRawMode = () => { assert.fail("A noninteractive command reached a prompt"); };
      if (mode === "input") h.input.isTTY = false;
      if (mode === "output") h.output.isTTY = false;
      if (mode === "error") h.error.isTTY = false;
      if (mode === "execute") {
        await assert.rejects(h.cli.execute(command), /profile configure default --token-stdin/);
      } else if (mode === "rpc") {
        assert.equal(await h.cli.run(["--json-rpc"]), 0);
        const replies = h.stdout().trim().split("\n").map((line) => JSON.parse(line));
        assert.equal(replies.length, 2);
        assert.match(replies[0].error.message, /profile configure default --token-stdin/);
        assert.equal(replies[1].result.values.url, oldUrl);
        assert.equal(h.stderr(), "");
      } else {
        assert.equal(await h.cli.run([...command, ...(mode === "json" ? ["--json"] : [])]), 1);
        assert.match(h.stderr(), /profile configure default --token-stdin/);
        assert.equal(h.stdout(), "");
      }
      assert.equal(h.validated.length, 0);
      assert.equal(await h.secrets.get(service, "default:token"), "synthetic-existing");
    }
  }
});

test("redirected stdout also prevents root and service onboarding", async (t) => {
  environment(t);
  for (const argv of [[], ["inspect"]]) {
    const h = await harness(t, { tty: true });
    h.output.isTTY = false;
    h.input.setRawMode = () => { assert.fail("Redirected stdout reached onboarding"); };
    await h.secrets.delete(service, "default:token");
    await h.cli.run(argv);
    assert.equal(h.validated.length, 0);
    assert.doesNotMatch(h.stderr(), /Token:|Service URL:/);
    assert.equal(await h.secrets.get(service, "default:token"), undefined);
  }
});

test("missing or rejected configure candidates preserve existing profiles and do not create new profiles", async (t) => {
  environment(t);
  for (const name of ["default", "new-profile"]) {
    for (const failure of ["missing", "rejected", "invalid-url"]) {
      if (failure === "missing") delete process.env[variable];
      else process.env[variable] = "synthetic-candidate";
      const h = await harness(t, { validate: () => { throw new Error("Candidate rejected."); } });
      const before = await h.profiles.list();
      const message = failure === "missing" ? /authentication is missing/
        : failure === "rejected" ? /Candidate rejected/ : /must use HTTPS/;
      await assert.rejects(h.cli.execute([
        "profile", "configure", name, "--url", failure === "invalid-url" ? "http://invalid.test" : newUrl,
      ]), message);
      assert.deepEqual(await h.profiles.list(), before);
      assert.equal(h.validated.length, failure === "rejected" ? 1 : 0);
      assert.equal(await h.secrets.get(service, "default:token"), "synthetic-existing");
      assert.equal(await h.secrets.get(service, "new-profile:token"), undefined);
      await assertOtherProfileUnchanged(h);
    }
  }
});

test("invalid profile names fail before credential access or candidate validation", async (t) => {
  environment(t, "synthetic-candidate");
  const h = await harness(t);
  h.secrets.get = async () => { assert.fail("Invalid profile name read credentials"); };
  h.secrets.set = async () => { assert.fail("Invalid profile name wrote credentials"); };
  h.secrets.delete = async () => { assert.fail("Invalid profile name deleted credentials"); };
  for (const name of ["../invalid", "profiles.json", "a".repeat(65)]) {
    await assert.rejects(h.cli.execute(["profile", "configure", name, "--url", newUrl]), /Profile name/);
  }
  assert.equal(h.validated.length, 0);
});

test("configure storage failures cannot leave an old credential bound to a new endpoint", async (t) => {
  environment(t, "synthetic-candidate");
  for (const failure of ["delete", "profile", "secret"]) {
    const h = await harness(t, { validate: async () => {
      assert.equal((await h.profiles.get()).values.url, oldUrl);
      assert.equal(await h.secrets.get(service, "default:token"), "synthetic-existing");
    } });
    if (failure === "delete") h.secrets.delete = async () => { throw new Error("Cannot delete synthetic-existing."); };
    if (failure === "profile") h.profiles.set = async () => { throw new Error("Synthetic profile failure."); };
    if (failure === "secret") h.secrets.set = async () => { throw new Error("Cannot store synthetic-candidate."); };
    await assert.rejects(h.cli.execute(["profile", "configure", "default", "--url", newUrl]), (error: Error) => {
      assert.match(error.message, /profile configure default --token-stdin/);
      assert.match(error.message, /Authentication may be incomplete/);
      assert.doesNotMatch(inspect(error) + JSON.stringify(error) + error.stack, /synthetic-/);
      assert.equal(error.cause, undefined);
      return true;
    });
    assert.equal(h.validated.length, 1);
    assert.equal((await h.profiles.get()).values.url, failure === "secret" ? newUrl : oldUrl);
    assert.equal(await h.secrets.get(service, "default:token"), failure === "delete" ? "synthetic-existing" : undefined);
    await assertOtherProfileUnchanged(h);
  }
});


test("backend credential details never escape configure or login failures through CLI, RPC or errors", async (t) => {
  environment(t, "synthetic-candidate");
  for (const command of [["profile", "configure", "default"], ["auth", "login"]]) {
    for (const mode of ["execute", "json", "rpc"]) {
      const frames = [command, ["profile", "show"]].map((argv, id) => JSON.stringify({
        jsonrpc: "2.0", id, method: "cli.execute", params: { argv },
      })).join("\n") + "\n";
      const h = await harness(t, { ...(mode === "rpc" ? { input: frames } : {}) });
      const configure = command[0] === "profile";
      if (configure) {
        h.secrets.delete = async () => { throw new Error("synthetic-existing private-backend-data"); };
      } else {
        h.secrets.set = async () => { throw new Error("synthetic-candidate private-backend-data"); };
      }
      if (mode === "execute") {
        await assert.rejects(h.cli.execute(command), (error: Error) => {
          assert.match(error.message, /OS credential store/);
          assert.doesNotMatch(inspect(error) + JSON.stringify(error) + error.stack, /synthetic-|private-backend/);
          assert.equal(error.cause, undefined);
          return true;
        });
      } else if (mode === "rpc") {
        assert.equal(await h.cli.run(["--json-rpc"]), 0);
        const replies = h.stdout().trim().split("\n").map((line) => JSON.parse(line));
        assert.equal(replies.length, 2);
        assert.match(replies[0].error.message, /OS credential store/);
        assert.equal(replies[1].result.values.url, oldUrl);
        assert.equal(h.stderr(), "");
      } else {
        assert.equal(await h.cli.run([...command, "--json"]), 1);
        assert.equal(h.stdout(), "");
        assert.match(h.stderr(), /OS credential store/);
      }
      assert.doesNotMatch(h.stdout() + h.stderr(), /synthetic-|private-backend/);
      assert.equal(h.validated.length, 1);
      assert.equal((await h.profiles.get()).values.url, oldUrl);
      assert.equal(await h.secrets.get(service, "default:token"), "synthetic-existing");
      await assertOtherProfileUnchanged(h);
    }
  }
});
