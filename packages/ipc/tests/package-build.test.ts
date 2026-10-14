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
