import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import test from "node:test";
import { command, localCommand, createCli, recordView, type ProfileStoreContract, type SecretStore } from "../src/index.js";

function fixture() {
  const forbidden = new Proxy({}, { get: () => () => { throw new Error("Profile/secret access forbidden"); } });
  let text = "", calls = 0;
  const sink = () => new Writable({ write(chunk, _encoding, done) { text += chunk; done(); } });
  const app = createCli({
    name: "metadata-test", version: "1.0.0", description: "Metadata fixture",
    permissions: {}, profile: { fields: [{ name: "url", flags: "--url <url>", description: "Service URL", required: true }] },
    commands: [command("tools", "Inspect tools", [
      localCommand("show <name>", "Describe a tool", ({ args }, context) => {
        calls++;
        assert.deepEqual(Object.keys(context).sort(), ["cwd", "environment", "io", "progress", "signal"]);
        return { name: args.name };
      }, { view: recordView<{name: unknown}>({ fields: [{ label: "Name", value: x => String(x.name) }], next: () => [["tools", "show", "next"]] }) }),
      command("run <input>", "Run a tool", () => { calls++; }, { permission: "Update" }),
    ])],
    builtins: [command("owner-status", "Inspect owner", () => { calls++; })],
    runtime: { input: Readable.from([]), output: sink(), error: sink(),
      profileStore: forbidden as ProfileStoreContract, secretStore: forbidden as SecretStore,
      fetch: async () => { throw new Error("Network forbidden"); } },
  });
  return { app, calls: () => calls, output: () => text };
}

test("nested local metadata executes without profile, keyring or network in every transport", async t => {
  const f = fixture(); t.after(() => f.app.dispose());
  assert.deepEqual(await f.app.execute(["-p", "unavailable", "tools", "show", "native"]), { name: "native" });
  assert.equal(await f.app.run(["tools", "show", "native", "--json"]), 0);
  assert.equal(JSON.parse(f.output()).name, "native");
  assert.equal(await f.app.run(["tools", "show", "native"]), 0);
  assert.match(f.output(), /Next:\n  metadata-test tools show next/);
  assert.doesNotMatch(f.output(), /--profile/);
  let rpc = "";
  const output = new Writable({ write(c, _e, done) { rpc += c; done(); } });
  assert.equal(await f.app.run(["--json-rpc"], { input: Readable.from([JSON.stringify({jsonrpc:"2.0",id:1,method:"cli.execute",params:{argv:["tools","show","rpc"]}})+"\n"]), output }), 0);
  assert.equal(JSON.parse(rpc).result.name, "rpc");
  await assert.rejects(f.app.execute(["tools", "run", "input"]), /Profile\/secret access forbidden/);
});

test("classification uses the same parser and invokes no handler or profile", async t => {
  const f = fixture(); t.after(() => f.app.dispose());
  const local = [[], ["--help"], ["--version"], ["help", "tools"], ["tools"], ["tools", "run", "--help"], ["tools", "show", "native"], ["tools", "show"], ["tools", "invalid"], ["--unknown"], ["owner-status"], ["--json-rpc", "tools"]];
  for (const argv of local) assert.equal(await f.app.classify(argv), "local", argv.join(" "));
  const owner = [["tools","run","input"], ["tools","run","--","--help"], ["--profile","--help","tools","run","input"], ["tools","run","input","--profile=other"], ["profile","show"], ["permissions","grant","Update"], ["--json-rpc"]];
  for (const argv of owner) assert.equal(await f.app.classify(argv), "owner", argv.join(" "));
  assert.equal(f.calls(), 0); assert.equal(f.output(), "");
  const input = Object.assign(Readable.from([]), {isTTY:true});
  const output = Object.assign(new Writable({write(_c,_e,done){done();}}), {isTTY:true});
  assert.equal(await f.app.classify([], {input,output,error:output}), "owner");
});

test("local handlers cannot bypass a gated profile handler", () => {
  for (const extra of [{run:()=>null}, {permission:"Update"}]) {
    assert.throws(() => createCli({name:"invalid",description:"Invalid",commands:[{...localCommand("metadata","Inspect metadata",()=>null),...extra}]}), /cannot declare/);
  }
  assert.throws(() => createCli({name:"invalid",description:"Invalid",permissions:{},commands:[command("service","Inspect service",()=>null)]}), /must declare a permission/);
});
