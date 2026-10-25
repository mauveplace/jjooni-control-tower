const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {webcrypto}=require('node:crypto');
function fixture(){
 const records=new Map(),clock={now:1000000},location={origin:'https://example.test'};
 const db={close(){},transaction(){const tx={};tx.objectStore=()=>Object.fromEntries(['get','put','delete'].map(method=>[method,(a,b)=>{const q={};setImmediate(()=>{if(method==='get')q.result=structuredClone(records.get(a));if(method==='put')records.set(b,structuredClone(a));if(method==='delete')records.delete(a);q.onsuccess?.();tx.oncomplete?.()});return q}]));return tx}};
 const indexedDB={open(){const q={};setImmediate(()=>{q.result=db;q.onsuccess()});return q}};
 const window={};vm.runInNewContext(fs.readFileSync('device-trust-v1.js','utf8'),{window,indexedDB,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,location,Date:{now:()=>clock.now}});
 return {api:window.JjooniTrustedDevice,records,clock,location};
}
test('approval survives 30 days and a year until explicitly revoked, without plaintext',async()=>{
 const f=fixture();await f.api.remember('test-only-password');const capsule=f.records.get('unlock');assert.equal(capsule.key.extractable,false);assert(!JSON.stringify(capsule).includes('test-only-password'));assert.equal(capsule.expires,undefined);
 f.clock.now+=366*86400000;assert.equal(await f.api.restore(),'test-only-password');await f.api.forget();assert.equal(await f.api.restore(),null);
});
test('valid legacy approvals migrate without requiring another login',async()=>{
 const f=fixture();await f.api.remember('fixture');const legacy=f.records.get('unlock');delete legacy.version;legacy.expires=f.clock.now+86400000;f.records.set('unlock',legacy);
 assert.equal(await f.api.restore(),'fixture');assert.equal(f.records.get('unlock').version,2);assert.equal(f.records.get('unlock').expires,undefined);
 f.clock.now+=366*86400000;assert.equal(await f.api.restore(),'fixture');
});
test('expired legacy, unknown versions, different-origin and tampered approvals fail closed',async()=>{
 const f=fixture();await f.api.remember('fixture');const legacy=f.records.get('unlock');delete legacy.version;legacy.expires=f.clock.now;f.records.set('unlock',legacy);assert.equal(await f.api.restore(),null);
 await f.api.remember('fixture');f.records.get('unlock').version=99;assert.equal(await f.api.restore(),null);
 await f.api.remember('fixture');f.location.origin='https://other.test';assert.equal(await f.api.restore(),null);
 await f.api.remember('fixture');const r=f.records.get('unlock');r.iv[0]^=1;assert.equal(await f.api.restore(),null);
});
