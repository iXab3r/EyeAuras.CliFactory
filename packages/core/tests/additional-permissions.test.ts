import assert from "node:assert/strict";
import test from "node:test";
import {Readable,Writable} from "node:stream";
import {command,createCli,type CommandInput} from "../src/index.js";
import {createCliFixture} from "../src/testing.js";

const permissions={categories:[{name:"Delete",description:"Delete synthetic data"}]};

test("additional permissions share the invocation input across CLI, execute and RPC",async t=>{
  const f=await createCliFixture(t,{applicationId:"additional-cli",profiles:[{name:"default",permissions:["ReadOnly","Update"]},{name:"other",permissions:["ReadOnly","Update","Delete"]}]});
  const snapshots=new WeakMap<CommandInput,string>();let prepared=0;
  const settings={permission:"Update",options:[{flags:"--delete",description:"Delete an item"}],
    additionalPermissions:async(input:CommandInput,context:{cwd:string;signal:AbortSignal})=>{assert.ok(context.cwd);context.signal.throwIfAborted();assert.deepEqual(Object.keys(context).sort(),["cwd","signal"]);snapshots.set(input,`snapshot-${++prepared}`);return input.options.delete?["Delete"]:[];}};
  const app=f.createApplication(runtime=>createCli({name:"additional-cli",description:"Fixture",runtime,permissions,commands:[command("apply","Apply input",(input)=>{const snapshot=snapshots.get(input);assert.ok(snapshot);return {snapshot};},settings)]}));
  assert.deepEqual(await f.json(app,["apply"]),{snapshot:"snapshot-1"});
  assert.deepEqual(await app.execute(["apply"]),{snapshot:"snapshot-2"});
  const denied=await f.run(app,["apply","--delete","--json"]);assert.equal(denied.exitCode,1);assert.equal(JSON.parse(denied.stderr).error.code,"permission.denied");assert.equal(JSON.parse(denied.stderr).error.profile,"default");
  const replies=await f.rpc(app,[["apply","--delete","--profile","other"],["apply","--delete"]]) as any[];
  assert.deepEqual(replies[0].result,{snapshot:"snapshot-4"});assert.equal(replies[1].error.code,"permission.denied");
});

test("static admission precedes resolver and help/classification skip preparation",async t=>{
  const f=await createCliFixture(t,{applicationId:"additional-cli",profiles:[{name:"default"}]});let prepared=0;
  const settings={permission:"Update",additionalPermissions:()=>{prepared++;return ["Delete"];}};
  const app=f.createApplication(runtime=>createCli({name:"additional-cli",description:"Fixture",runtime,permissions,commands:[command("apply","Apply input",()=>true,settings)]}));
  assert.equal(await app.classify(["apply"]),"owner");assert.equal((await f.run(app,["apply","--help"])).exitCode,0);
  const denied=await f.run(app,["apply","--json"]);assert.equal(JSON.parse(denied.stderr).error.code,"permission.denied");assert.equal(prepared,0);
});

test("additional denial precedes interactive configuration and authentication effects",async t=>{
  const f=await createCliFixture(t,{applicationId:"additional-cli",profiles:[{name:"default",permissions:["ReadOnly","Update"]}]});let readiness=0,login=0,handled=0;
  const settings={permission:"Update",additionalPermissions:()=>["Delete"]};
  const app=f.createApplication(runtime=>createCli({name:"additional-cli",description:"Fixture",runtime,permissions,
    profile:{fields:[{name:"url",flags:"--url <url>",description:"Service URL",required:true}]},
    auth:{isReady:async()=>{readiness++;return false;},login:async()=>{login++;return {authenticated:true};},status:async()=>({authenticated:false}),logout:async()=>{}},
    commands:[command("apply","Apply input",()=>{handled++;return true;},settings)]}));
  const input=Object.assign(Readable.from(["https://service.example.test/\n"]),{isTTY:true});let stdout="",stderr="";
  const output=Object.assign(new Writable({write(c,_e,done){stdout+=c;done();}}),{isTTY:true});
  const error=Object.assign(new Writable({write(c,_e,done){stderr+=c;done();}}),{isTTY:true});
  const run=await f.run(app,["apply"],{input,output,error});assert.equal(run.exitCode,1);assert.match(stderr,/Permission 'Delete'/);assert.equal(stdout,"");assert.equal(readiness,0);assert.equal(login,0);assert.equal(handled,0);
});

test("exclusive onboarding rechecks admission without repeating input preparation",async t=>{
  const f=await createCliFixture(t,{applicationId:"additional-cli",profiles:[{name:"default",permissions:["ReadOnly","Update","Delete"]}]});let prepared=0;
  const snapshots=new WeakMap<CommandInput,string>();
  const settings={permission:"Update",additionalPermissions:(input:CommandInput)=>{prepared++;snapshots.set(input,"inspected");return ["Delete"];}};
  const app=f.createApplication(runtime=>createCli({name:"additional-cli",description:"Fixture",runtime,permissions,
    profile:{fields:[{name:"url",flags:"--url <url>",description:"Service URL",required:true}]},commands:[command("apply","Apply input",input=>{assert.equal(snapshots.get(input),"inspected");return true;},settings)]}));
  const input=Object.assign(Readable.from(["https://service.example.test/\n"]),{isTTY:true});
  const output=Object.assign(new Writable({write(_c,_e,done){done();}}),{isTTY:true});const error=Object.assign(new Writable({write(_c,_e,done){done();}}),{isTTY:true});
  assert.equal((await f.run(app,["apply"],{input,output,error})).exitCode,0);assert.equal(prepared,1);
});

test("an unknown additional category fails closed before the handler",async t=>{
  const f=await createCliFixture(t,{applicationId:"additional-cli",profiles:[{name:"default",permissions:["Update"]}]});let handled=0;
  const settings={permission:"Update",additionalPermissions:()=>["Undeclared"]};
  const app=f.createApplication(runtime=>createCli({name:"additional-cli",description:"Fixture",runtime,permissions,commands:[command("apply","Apply input",()=>{handled++;return true;},settings)]}));
  const run=await f.run(app,["apply","--json"]);assert.equal(run.exitCode,1);assert.equal(JSON.parse(run.stderr).error.code,"permission.unknown");assert.equal(handled,0);
});
