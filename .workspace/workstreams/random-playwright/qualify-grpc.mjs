import { Server, credentials, ServerCredentials, loadPackageDefinition } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { randomUUID } from 'node:crypto';
import { privateEndpoint } from '../../../packages/core/dist/src/private-storage.js';
const definition = loadPackageDefinition(loadSync('packages/ipc/proto/cli-host.proto', {oneofs:true}));
const service = definition.clifactory.CliHost;
const endpoint = process.platform === 'win32' ? 'unix:////./pipe/clifactory-qualify-' + randomUUID() : 'unix:/tmp/clifactory-qualify-' + randomUUID();
const server = new Server();
server.addService(service.service, {run(call) {
 call.on('error',()=>{});
 call.on('data',message=> {if(message.stdin) call.write({stdout:message.stdin});});
 call.on('end',()=>{call.write({exit:{code:0}});call.end();});
}});
try {
 await new Promise((resolve,reject)=>server.bindAsync(endpoint,ServerCredentials.createInsecure(),e=>e?reject(e):resolve()));
 await privateEndpoint(process.platform === 'win32' ? '\\\\.\\pipe\\' + endpoint.split('/').at(-1) : endpoint.slice(5));
 console.log(JSON.stringify({listening:true,endpoint}));
 await Promise.all([1,2].map(async n=>{
 const client = new service(endpoint,credentials.createInsecure());
 try {await new Promise((resolve,reject)=>{
 const call=client.run({deadline:Date.now()+5000});const bytes=[];let exit;
 call.on('data',frame=>{if(frame.stdout)bytes.push(frame.stdout);if(frame.exit)exit=frame.exit.code??0;});
 call.on('error',reject);call.on('end',()=>Buffer.concat(bytes).equals(Buffer.from([n,0,255]))&&exit===0?resolve():reject(new Error('relay mismatch')));
 call.write({start:{argv:[],protocol:'1'}});call.write({stdin:Buffer.from([n,0,255])});call.end();
 });}finally{client.close();}
 }));
 console.log(JSON.stringify({concurrentClients:2,binaryRoundTrip:true}));
 if(process.env.CLI_QUALIFY_HOLD) await new Promise(r=>setTimeout(r,15000));
}finally{server.forceShutdown();}
