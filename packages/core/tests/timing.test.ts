import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
test('opt-in timing separates requests, retains failed spans and omits private identity text',async t=>{
 const root=await mkdtemp(join(tmpdir(),'factory-timing-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const code=`import {timingRequest,timingSpan,timingSync,timingScope} from ${JSON.stringify(new URL('../src/timing.js',import.meta.url).href)};
 await timingRequest(()=>timingScope('private-profile-and-input',async()=>{await timingSpan('backend.read',async()=>42);timingSync('journal.write',()=>1);}));
 await timingRequest(()=>timingSpan('backend.failure',async()=>{throw Error('private-response');})).catch(()=>{});`;
 const result=await exec(process.execPath,['--input-type=module','-e',code],{env:{...process.env,CLI_FACTORY_TRACE_DIRECTORY:root}});assert.equal(result.stdout,'');assert.equal(result.stderr,'');
 const files=await readdir(root);assert.equal(files.length,1);const text=await readFile(join(root,files[0]!), 'utf8');assert.ok(!text.includes('private-'));
 const rows=text.trim().split('\n').map(line=>JSON.parse(line));assert.equal(new Set(rows.map(r=>r.request)).size,2);assert.ok(rows.some(r=>r.stage==='backend.failure'&&!r.ok));
 for(const row of rows){assert.ok(BigInt(row.durationNs)>=0n);assert.ok(BigInt(row.startNs)>0n);assert.equal(row.schema,1);assert.ok(row.scope===undefined||/^[a-f0-9]{24}$/.test(row.scope));}
 const nested=rows.find(r=>r.stage==='backend.read');const parent=rows.find(r=>r.id===nested.parent);assert.equal(parent.stage,'command.total');
 await exec(process.execPath,['--input-type=module','-e',code],{env:{...process.env,CLI_FACTORY_TRACE_DIRECTORY:''}});assert.equal((await readdir(root)).length,1);
 await exec(process.execPath,['--input-type=module','-e',code],{env:{...process.env,CLI_FACTORY_TRACE_DIRECTORY:join(root,'missing')}});
});
