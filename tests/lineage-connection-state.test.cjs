const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(){
 const clock={now:Date.parse('2026-10-26T00:00:00Z')},nodes={title:{},message:{},button:{style:{}}},badge={dataset:{},style:{}},listeners={},timers=[];let removed=false;
 const shield={querySelector:q=>q.includes('Title')?nodes.title:q.includes('Text')?nodes.message:nodes.button,remove(){removed=true}};
 const document={getElementById:id=>id==='ctSsotSafetyShield'?shield:badge,addEventListener:(name,fn)=>listeners[name]=fn};
 const window={__JJOONI_FEED_CONNECTION:{state:'CONNECTING'}};
 let source=fs.readFileSync('lineage-guard.js','utf8');source=source.slice(source.indexOf('function ensureShield(){'),source.lastIndexOf('})();'));
 vm.runInNewContext('(function(){const started=Date.now();function disableLegacyPoller(){return true};'+source+'})();',{window,document,Date:{now:()=>clock.now},setInterval:fn=>(timers.push(fn),timers.length),clearInterval(){},location:{reload(){}}});
 return {window,clock,nodes,badge,listeners,tick:()=>timers[1](),removed:()=>removed};
}
test('late first feed stays masked with delay guidance, then recovers after the polling deadline',()=>{
 const f=fixture();f.clock.now+=26000;f.tick();assert.match(f.nodes.title.textContent,/지연/);assert.doesNotMatch(f.nodes.title.textContent,/없음/);assert.equal(f.badge.dataset.ctConnectionState,'RETRYING');assert.equal(f.removed(),false);assert.equal(f.window.__JJOONI_LIVE_READY,undefined);
 f.window.__JJOONI_CANONICAL_SSOT={};f.window.__JJOONI_LIVE_PAYLOAD={};f.listeners['jjooni:live-applied']();assert.equal(f.removed(),true);assert.equal(f.window.__JJOONI_LIVE_READY,true);assert.equal(f.badge.dataset.ctConnectionState,undefined);
});
test('genuine feed validation failure immediately retains the safety mask',()=>{
 const f=fixture();f.window.__JJOONI_FEED_CONNECTION.state='BLOCKED';f.tick();assert.equal(f.badge.dataset.ctConnectionState,'BLOCKED');assert.equal(f.removed(),false);assert.match(f.nodes.message.textContent,/검증/);
});
