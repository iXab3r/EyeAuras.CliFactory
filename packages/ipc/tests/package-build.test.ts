import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writePackageBuildManifest, readPackageBuildManifest } from '../src/package-build.js';

async function fixture(t: {after: (f: () => Promise<void>) => void}) {
  const root = await mkdtemp(join(tmpdir(), 'external-package-'));
  t.after(() => rm(root, {recursive:true, force:true}));
  await mkdir(join(root, 'dist'));
  await writeFile(join(root, 'package.json'), JSON.stringify({name:'synthetic-cli',version:'1.0.0',files:['dist','SKILL.md','.cli-package-build.json']}));
  await writeFile(join(root, 'dist/bin.js'), 'export const answer=42;');
  await writeFile(join(root, 'SKILL.md'), 'Synthetic immutable resource');
  return root;
}
test('package identity survives relocation and detects changed runtime/resource bytes', async t => {
  const root = await fixture(t);
  await writePackageBuildManifest(root);
  const before = await readPackageBuildManifest(join(root,'dist/bin.js'));
  const moved = root+' spaces-Ω';
  await rename(root,moved); t.after(() => rm(moved,{recursive:true,force:true}));
  assert.equal(await readPackageBuildManifest(join(moved,'dist/bin.js')),before);
  await writeFile(join(moved,'SKILL.md'),'Different skill');
  await assert.rejects(readPackageBuildManifest(join(moved,'dist/bin.js')),/stale/);
});
test('missing resources, escaped paths and undeclared marker fail preparation', async t => {
  const root = await fixture(t);
  await rm(join(root,'SKILL.md'));
  await assert.rejects(writePackageBuildManifest(root));
  await writeFile(join(root,'package.json'),JSON.stringify({files:['../elsewhere','.cli-package-build.json']}));
  await assert.rejects(writePackageBuildManifest(root),/outside/);
  await writeFile(join(root,'package.json'),JSON.stringify({files:['dist']}));
  await assert.rejects(writePackageBuildManifest(root),/Include/);
});
test('installed dependency bytes participate in compatibility', async t => {
  const root = await fixture(t);
  const path=join(root,'node_modules/dependency'); await mkdir(path,{recursive:true});
  const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8')); pkg.dependencies={dependency:'1.0.0'};
  await writeFile(join(root,'package.json'),JSON.stringify(pkg));
  await writeFile(join(path,'package.json'),JSON.stringify({name:'dependency',version:'1.0.0',main:'index.js'}));
  await writeFile(join(path,'index.js'),'module.exports = 1;');
  await writePackageBuildManifest(root);
  const before=await readPackageBuildManifest(join(root,'dist/bin.js'));
  await writeFile(join(path,'index.js'),'module.exports = 2;');
  assert.notEqual(await readPackageBuildManifest(join(root,'dist/bin.js')),before);
});
test('artifact paths reject a symlinked ancestor', async t => {
  const root=await fixture(t);const outside=await mkdtemp(join(tmpdir(),'outside-artifact-'));t.after(()=>rm(outside,{recursive:true,force:true}));
  await writeFile(join(outside,'payload.js'),'outside');
  const {symlink}=await import('node:fs/promises');await symlink(outside,join(root,'linked'),'dir');
  await writeFile(join(root,'package.json'),JSON.stringify({files:['linked/payload.js','.cli-package-build.json']}));
  await assert.rejects(writePackageBuildManifest(root),/symlink/);
});
test('required and installed optional peer bytes participate in compatibility',async t=>{
  const root=await fixture(t);const path=join(root,'node_modules/peer');await mkdir(path,{recursive:true});
  const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));pkg.peerDependencies={peer:'1.0.0',absent:'1.0.0'};pkg.peerDependenciesMeta={absent:{optional:true}};
  await writeFile(join(root,'package.json'),JSON.stringify(pkg));await writeFile(join(path,'package.json'),JSON.stringify({name:'peer',version:'1.0.0'}));await writeFile(join(path,'code.js'),'one');
  await writePackageBuildManifest(root);const before=await readPackageBuildManifest(join(root,'dist/bin.js'));await writeFile(join(path,'code.js'),'two');assert.notEqual(await readPackageBuildManifest(join(root,'dist/bin.js')),before);
});
test('swapped dependency resolution contexts change identity',async t=>{
  const root=await fixture(t);const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));pkg.dependencies={a:'1.0.0',b:'1.0.0'};await writeFile(join(root,'package.json'),JSON.stringify(pkg));
  for(const [name,v] of [['a','1'],['b','2']] as const){const path=join(root,'node_modules',name);await mkdir(join(path,'node_modules/c'),{recursive:true});await writeFile(join(path,'package.json'),JSON.stringify({name,version:'1.0.0',dependencies:{c:'*'}}));await writeFile(join(path,'node_modules/c/package.json'),JSON.stringify({name:'c',version:v}));await writeFile(join(path,'node_modules/c/index.js'),v);}
  await writePackageBuildManifest(root);const before=await readPackageBuildManifest(join(root,'dist/bin.js'));const a=join(root,'node_modules/a/node_modules/c'),b=join(root,'node_modules/b/node_modules/c');await rename(a,a+'-tmp');await rename(b,a);await rename(a+'-tmp',b);assert.notEqual(await readPackageBuildManifest(join(root,'dist/bin.js')),before);
});
