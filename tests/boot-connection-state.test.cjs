const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(feed){
 const clock={now:Date.parse('2026-10-26T00:00:00Z')};class ClockDate extends Date{constructor(...xs){super(...(xs.length?xs:[clock.now]))}static now(){return clock.now}}
 const titles={title:{textContent:''},message:{textContent:''},button:{style:{}}},badge={textContent:'SSOT WAIT',title:'GVIZ_TIMEOUT'},nodes=new Map();
 const shield={querySelector:s=>s.includes('Title')?titles.title:s.includes('Text')?titles.message:titles.button,remove(){nodes.delete('ctUiBootShieldV14')}};
 nodes.set('ctUiBootShieldV14',shield);nodes.set('ctEncryptedLiveBadge',badge);
 const scripts=[{src:'lineage-guard.js'},{src:'live-bridge.js'}],listeners={};let pulse;
 const document={scripts,head:{appendChild:s=>scripts.push(s)},getElementById:id=>nodes.get(id),createElement:()=>({}),addEventListener:(name,fn)=>listeners[name]=fn};
 const window={__JJOONI_UI_RELEASE:'fixture',__JJOONI_FEED_CONNECTION:feed,__JJOONI_ENTRY_DIAGNOSTICS:{phase:'CONNECTING_ACCOUNTS'}};
 vm.runInNewContext(fs.readFileSync('boot-coordinator-v33.js','utf8'),{window,document,Date:ClockDate,console,setInterval:fn=>(pulse=fn,1),clearInterval(){},setTimeout(){},encodeURIComponent,location:{reload(){}}});
 return {window,clock,scripts,badge,titles,pulse,listeners};
}
test('initial WAIT and stale tooltip never flash an auth/read failure before recovery',()=>{
 const f=fixture();f.clock.now+=3000;f.pulse();assert.doesNotMatch(f.titles.message.textContent,/실패/);assert.equal(f.titles.button.style.display,'none');assert.match(f.titles.message.textContent,/다시 시도/);
 f.window.__JJOONI_CANONICAL_SSOT={};f.window.__JJOONI_LIVE_PAYLOAD={};f.window.__JJOONI_LINEAGE_GUARD={version:'2.0',policy:'verified'};f.listeners['jjooni:live-applied']();
 assert.equal(f.window.__JJOONI_BOOT_COORDINATOR_V33.last_diag,null);assert.equal(f.window.__JJOONI_ENTRY_DIAGNOSTICS.phase,'LOADING_UI');assert.equal(f.scripts.length,3);
});
test('transport retry has bounded grace but real source validation failures remain visible immediately',()=>{
 const f=fixture({state:'RETRYING',last_error:'GVIZ_FAIL'});f.clock.now+=3000;f.pulse();assert.equal(f.window.__JJOONI_BOOT_COORDINATOR_V33.last_paint_failed,false);
 f.clock.now+=30000;f.pulse();assert.equal(f.window.__JJOONI_BOOT_COORDINATOR_V33.last_paint_failed,true);assert.match(f.titles.message.textContent,/지연/);
 const invalid=fixture({state:'BLOCKED',last_error:'ENVELOPE_SCHEMA_MISMATCH'});invalid.clock.now+=1000;invalid.pulse();assert.equal(invalid.window.__JJOONI_BOOT_COORDINATOR_V33.last_paint_failed,true);assert.equal(invalid.scripts.length,2);
});
test('a loaded lineage file without an actual guard policy cannot unlock UI',()=>{
 const f=fixture({state:'READY'});f.window.__JJOONI_CANONICAL_SSOT={};f.window.__JJOONI_LIVE_PAYLOAD={};f.window.__JJOONI_LINEAGE_GUARD={version:'2.0'};f.clock.now+=3000;f.pulse();assert.equal(f.scripts.length,2);assert.equal(f.window.__JJOONI_LIVE_READY,undefined);
});
