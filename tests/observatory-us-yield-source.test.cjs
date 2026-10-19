const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('market-observatory/latest-board-v1.js','utf8');
function run(series){
 const ctx={DATA:{series}};vm.createContext(ctx);
 const items=source.slice(source.indexOf('const ITEMS='),source.indexOf('];',source.indexOf('const ITEMS='))+2);
 const funcs=source.slice(source.indexOf('function seriesOf('),source.indexOf('function arrow('));
 const fmt=source.match(/const fmt=[^\n]+/)[0];
 vm.runInContext(items+"\nconst COMPARES={D1:{mode:'prev'}};let compareKey='D1';\n"+fmt+'\n'+funcs+'\nthis.read=k=>{const item=ITEMS.find(i=>i.k===k),s=stat(item);return{value:s?.value,text:s?fmt(s.value,item.digits):null,change:s?.change}};',ctx);return ctx;
}
test('market 10-year raw 5.144 survives selection, comparison and display beside official 5.15',()=>{
 const c=run({US10Y:[{date:'2026-10-16',value:5.098},{date:'2026-10-19',value:5.144}],US10Y_OFFICIAL:[{date:'2026-10-16',value:5.09},{date:'2026-10-19',value:5.15}]});
 const result=c.read('US10Y_OFFICIAL');assert.equal(result.value,5.144);assert.equal(result.text,'5.144');assert(Math.abs(result.change-4.6)<1e-10);
});
test('30-year market precision is preserved and missing market data cannot masquerade as official',()=>{
 const c=run({US30Y:[{date:'2026-10-19',value:5.472}],US30Y_OFFICIAL:[{date:'2026-10-19',value:5.48}],US10Y_OFFICIAL:[{date:'2026-10-19',value:5.15}]});
 assert.equal(c.read('US30Y_OFFICIAL').text,'5.472');assert.equal(c.read('US10Y_OFFICIAL').text,null);
});
