const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const prepare=vm.runInNewContext('('+html.match(/function prepareLegacyScript\(source\)\{[\s\S]*?\n\}/)[0]+')');
test('removed BOT/comparison writes cannot interrupt active account rendering',()=>{
 const src=`function render(){
 cmpHuman.textContent='retired';
 cmpAi.className='retired';
 cmpAlpha.textContent='retired';
 aiNav.textContent='retired';
 aiMdd.textContent='retired';
 aiTrades.textContent='retired';
 aiPositions.innerHTML=true ? '<div>retired</div>' : '';
 active.value='CURRENT';
 }
 render();`;
 const ctx={active:{}};vm.runInNewContext(prepare(src),ctx);assert.equal(ctx.active.value,'CURRENT');
 const error=prepare(`function render(){\n currentAccount.value='FAIL';\n}\nrender();`);
 assert.throws(()=>vm.runInNewContext(error,{}),/currentAccount/,'active-screen errors stay visible');
});
test('missing regular-session evidence after opening is unknown rather than PRE',()=>{
 const f=vm.runInNewContext('('+prepare(`function session(krLive,krClose,kr){return {phase:krLive?'LIVE':(krClose?'CLOSE':'PRE')}}`)+')');
 assert.equal(f(false,false,{minuteOfDay:500}).phase,'PRE');
 assert.equal(f(false,false,{minuteOfDay:1170}).phase,'확인필요');
 assert.equal(f(false,true,{minuteOfDay:1170}).phase,'CLOSE');
 assert.equal(f(true,false,{minuteOfDay:600}).phase,'LIVE');
});
