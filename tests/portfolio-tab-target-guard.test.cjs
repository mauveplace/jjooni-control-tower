const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('portfolio-tab-target-guard-v1.js','utf8');
function node(name){
 const set=new Set();
 return {name,dataset:{tab:name},classList:{toggle:(k,on)=>on?set.add(k):set.delete(k),contains:k=>set.has(k),remove:k=>set.delete(k)},style:{getPropertyPriority:()=>'',removeProperty:()=>{}},has:k=>set.has(k)};
}
function setup(){
 const portfolio=node('portfolio'),tripod=node('tripod'),p=node('panel-portfolio'),t=node('panel-tripod');
 const listeners={},timers=[],storage={},events=[];
 const brand={textContent:'Overview'},location={hash:'#overview'};
 const document={getElementById:id=>({'panel-portfolio':p,'panel-tripod':t,'ctMoreMenu':null,'ctMoreTab':null,'ctMoreBackdropV4':null}[id]||null),
  querySelector:sel=>sel==='.tabs .tab[data-tab="portfolio"]'?portfolio:sel==='.top .brand'?brand:null,
  querySelectorAll:sel=>sel==='.tabPanel[id^="panel-"]'?[p,t]:sel==='.tabs .tab[data-tab]'?[portfolio,tripod]:[]};
 const root={document,location,history:{state:null,replaceState:(_state,_title,hash)=>{location.hash=hash}},sessionStorage:{setItem:(k,v)=>{storage[k]=v}},setTimeout:(fn,ms)=>timers.push({fn,ms}),
 addEventListener:(type,fn,capture)=>{(listeners[type]??=[]).push(fn);events.push({type,capture})}};
 const context={window:root};
 vm.createContext(context);vm.runInContext(src,context);
 const target=tab=>({closest:sel=>sel.includes('.tabs .tab')?tab:null});
 const event=tab=>({target:target(tab),defaultPrevented:false,stopped:false,immediate:false,
   preventDefault(){this.defaultPrevented=true},stopPropagation(){this.stopped=true},stopImmediatePropagation(){this.immediate=true}});
 return {root,brand,portfolio,tripod,p,t,listeners,timers,storage,event,events};
}
test('portfolio click forces matching panel and cancels legacy mismatched tab handlers',()=>{
 const a=setup();a.t.classList.toggle('on',true);a.tripod.classList.toggle('on',true);
 const e=a.event(a.portfolio);a.listeners.click[0](e);
 assert(e.defaultPrevented&&e.stopped&&e.immediate);
 assert(a.p.has('on'));assert(!a.t.has('on'));
 assert(a.portfolio.has('on'));assert(!a.tripod.has('on'));
 assert.equal(a.storage.jjooni_ct_active_tab_v1,'portfolio');
 assert.equal(a.root.__JJOONI_PORTFOLIO_TAB_GUARD_V1.last_target,'portfolio');
});
test('TRI-POD intentional click retains normal legacy navigation',()=>{
 const a=setup();const e=a.event(a.tripod);a.listeners.click[0](e);
 assert.equal(e.stopped,false);assert.equal(e.defaultPrevented,false);
 assert(!a.p.has('on'));
});
test('switching away cancels outstanding portfolio repair timers',()=>{
 const a=setup();a.listeners.click[0](a.event(a.portfolio));
 a.p.classList.toggle('on',false);a.t.classList.toggle('on',true);
 a.listeners.pointerdown[0](a.event(a.tripod));
 for(const timer of a.timers)timer.fn();
 assert(!a.p.has('on'));assert(a.t.has('on'));
});
test('guard is anchored in post-decrypt bootstrap',()=>{
 const html=fs.readFileSync('index.html','utf8');
 assert.match(html,/CT_POSTFIX=.*portfolio-tab-target-guard-v1[.]js[?]v=1[.]1/);
 assert.match(html,/CT_LIVE_BOOT=/);
});

test('portfolio capture keeps title and URL consistent with the visible panel',()=>{
 const a=setup();a.listeners.click[0](a.event(a.portfolio));
 assert.equal(a.brand.textContent,'보유분석');assert.equal(a.root.location.hash,'#portfolio');
 a.listeners.pointerdown[0](a.event(a.tripod));a.root.location.hash='#tripod';a.brand.textContent='TRI-POD';
 for(const timer of a.timers)timer.fn();
 assert.equal(a.brand.textContent,'TRI-POD');assert.equal(a.root.location.hash,'#tripod');
});
