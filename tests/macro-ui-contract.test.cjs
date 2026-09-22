const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('market-observatory/official-macro-v1.js','utf8');
// Run the actual formatter and interpretation functions without booting a DOM.
const numeric=source.match(/const n=v=>\{[^\n]+/)[0];
const surprise=source.slice(source.indexOf('function surpriseRead('),source.indexOf('function inject('));
const context={};vm.createContext(context);
vm.runInContext(numeric+'\nconst guideFor=()=>({high:"high",low:"low"});\n'+surprise+'\nthis.read=surpriseRead;this.number=n;',context);
test('missing consensus is not coerced into a zero surprise benchmark',()=>{
 assert.equal(context.number(null),null);
 assert.equal(context.number(''),null);
 assert.equal(context.number(0),0);
 assert.match(context.read('KR_GDP',{release:{actual:.6,consensus:null}}),/대기/);
});
test('official projections never receive an actual surprise interpretation',()=>{
 assert.match(context.read('US_SEP_DOT_PLOT',{value_role:'official_forecast',release:{forecast:4.1,actual:null,consensus:3.8}}),/공식기관 전망/);
});
