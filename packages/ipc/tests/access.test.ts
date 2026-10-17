import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable,Writable} from 'node:stream';
import {status} from '@grpc/grpc-js';
import type {CliHostClient} from '../src/generated/clifactory/CliHost.js';
import {control,runRemote} from '../src/client.js';

const io={input:Readable.from([]),output:new Writable({write(_c,_e,d){d();}}),error:new Writable({write(_c,_e,d){d();}})};
const accessFailure=(error:Error)=>{
 assert.match(error.message,/IPC access was denied/);assert.match(error.message,/owner state is unknown/);
 assert.doesNotMatch(error.message,/synthetic-private|ipc-server stop|no new host/);return true;
};
test('denied IPC cannot be reported as an absent owner or cause redundant owner startup',async()=>{
 for(const failure of [
  {code:status.PERMISSION_DENIED,details:'synthetic-private'},
  {code:status.UNAVAILABLE,details:'No connection established: connect EPERM synthetic-private'},
  {code:status.UNAVAILABLE,details:'No connection established: connect EACCES synthetic-private'},
 ]){
  let calls=0;
  const client={Status(_r:unknown,_o:unknown,done:(error:unknown)=>void){calls++;done(failure);}} as unknown as CliHostClient;
  await assert.rejects(control(client),accessFailure);assert.equal(calls,1);
  calls=0;
  await assert.rejects(runRemote({entryPoint:'synthetic-nonexistent-no-child',build:'fixture',environmentKeys:[]},client,[],io),accessFailure);
  assert.equal(calls,1,'A denied first probe must not enter owner startup polling');
 }
});
test('a genuinely unavailable endpoint still reports not running',async()=>{
 const client={Status(_r:unknown,_o:unknown,done:(error:unknown)=>void){done({code:status.UNAVAILABLE,details:'No connection established: connect ENOENT synthetic-private'});}} as unknown as CliHostClient;
 assert.deepEqual(await control(client),{running:false});
});
test('access lost after an acknowledged stop remains unknown rather than stopped',async()=>{
 let stops=0,probes=0;
 const client={
  Stop(_r:unknown,_o:unknown,done:(error:unknown,result:unknown)=>void){stops++;done(null,{closing:true});},
  Status(_r:unknown,_o:unknown,done:(error:unknown)=>void){probes++;done({code:status.UNAVAILABLE,details:'connect EACCES synthetic-private'});},
 } as unknown as CliHostClient;
 await assert.rejects(control(client,true),error=>{accessFailure(error as Error);assert.doesNotMatch((error as Error).message,/no command was sent/);return true;});
 assert.equal(stops,1);assert.equal(probes,1);
});
