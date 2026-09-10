const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('verified boot uses the lineage guard object that lineage-guard actually exports',()=>{
  const boot=read('boot-coordinator-v33.js');
  const fast=read('fast-refresh-v32.js');
  const guard=read('lineage-guard.js');
  assert.match(guard,/__JJOONI_LINEAGE_GUARD/);
  assert.match(boot,/__JJOONI_LINEAGE_GUARD/);
  assert.match(fast,/__JJOONI_LINEAGE_GUARD/);
  assert.doesNotMatch(boot,/__LINEAGE_GUARD_ACTIVE/);
  assert.doesNotMatch(fast,/__LINEAGE_GUARD_ACTIVE/);
});

test('boot can render existing verified SSOT before FAST refresh is required',()=>{
  const boot=read('boot-coordinator-v33.js');
  assert.match(boot,/function factsReady\(\)/);
  assert.match(boot,/function verifiedReady\(\)\{return factsReady\(\)&&lineageReady\(\)\}/);
  assert.match(boot,/if\(S\.pulses>8\)/);
});
