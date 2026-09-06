(function(){
'use strict';
if(window.__JJOONI_TABLET_ACCOUNTS_V8)return;
window.__JJOONI_TABLET_ACCOUNTS_V8={state:'BOOTING',version:'8.1'};
const IDS=['TOSS','ISA','PENSION','IRP','AI','TRIPOD'];
const LABEL={TOSS:'Toss',ISA:'ISA',PENSION:'연금저축',IRP:'IRP',AI:'AI BOT',TRIPOD:'TRI-POD'};
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const z=v=>n(v)==null?0:n(v);
const qs=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const wide=()=>innerWidth>=768;
const C=()=>window.__JJOONI_CANONICAL_SSOT||{};
const L=()=>window.__JJOONI_LIVE_PAYLOAD||{};
const won=v=>'₩'+Math.round(Math.abs(Number(v)||0)).toLocaleString('ko-KR');
const signed=v=>{const x=Number(v)||0;return (x>=0?'+':'-')+won(x)};
const pct=v=>n(v)==null?'—':(Number(v)>=0?'+':'')+Number(v).toFixed(2)+'%';
const cls=v=>Number(v)>0?'gain':Number(v)<0?'loss':'neutral';
function trustKind(raw){const s=String(raw||'').toUpperCase();if(s.includes('BROKER')||s.includes('ACTUAL')||s==='FULL'||s==='LIVE')return '증권사 확인';if(s.includes('MODEL')||s.includes('MODELED')||s.includes('MTM')||s.includes('ACCOUNTING')||s.includes('PARTIAL'))return '계산값';return '참고값'}
function fx(){return n(window.__JJOONI_FX_KRW_PER_USD)||n((((L().accounts||{}).AI)||{}).fx_krw_per_usd)||1}
function style(){if(qs('#ctTabletAccountsV8Style'))return;const s=document.createElement('style');s.id='ctTabletAccountsV8Style';s.textContent=`
@media(min-width:768px){
 #panel-accounts>#ctDesktopAccountsV8{display:block!important}#panel-accounts>:not(#ctDesktopAccountsV8){display:none!important}
 #ctDesktopAccountsV8{font-family:system-ui,-apple-system,'Noto Sans KR',sans-serif;color:#172033}.ctA8Head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin:8px 0 12px}.ctA8Title{font-size:22px;font-weight:900}.ctA8Sub{font-size:10px;color:#667085;margin-top:3px}.ctA8Total{text-align:right;font-size:11px;font-weight:900}.ctA8Grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.ctA8Card{background:#fff;border:1px solid #e5eaf0;border-radius:14px;padding:12px;min-width:0}.ctA8Name{font-size:12px;font-weight:900}.ctA8Nav{font-size:18px;font-weight:900;margin-top:4px}.ctA8Rows{margin-top:9px;border-top:1px solid #edf1f5;padding-top:6px}.ctA8Line{display:flex;justify-content:space-between;gap:8px;padding:4px 0;font-size:9px;color:#667085}.ctA8Line b{color:#172033}.ctA8Source{margin-top:7px;font-size:8px;color:#98a2b3}.gain{color:#d92d20!important}.loss{color:#175cd3!important}.neutral{color:#667085!important}
}
@media(min-width:768px) and (max-width:1050px){.ctA8Grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;document.head.appendChild(s)}
function render(){if(!wide())return;const panel=qs('#panel-accounts'),c=C();if(!panel||!c.accounts)return;style();let root=qs('#ctDesktopAccountsV8',panel);if(!root){root=document.createElement('div');root.id='ctDesktopAccountsV8';panel.prepend(root)}const cards=IDS.map(id=>{const a=c.accounts[id]||{},cash=z(a.cash_krw)+z(a.cash_usd)*fx(),source=trustKind(a.quality||a.source);return `<div class="ctA8Card"><div class="ctA8Name">${LABEL[id]}</div><div class="ctA8Nav">${n(a.nav)!=null?won(a.nav):'—'}</div><div class="ctA8Rows"><div class="ctA8Line"><span>오늘 투자손익</span><b class="${cls(a.today_pnl)}">${n(a.today_pnl)!=null?signed(a.today_pnl):'산정 대기'}</b></div><div class="ctA8Line"><span>오늘 수익률</span><b>${pct(a.today_return)}</b></div><div class="ctA8Line"><span>누적손익</span><b class="${cls(a.pnl)}">${n(a.pnl)!=null?signed(a.pnl):'산정 대기'}</b></div><div class="ctA8Line"><span>누적수익률</span><b>${pct(a.return_pct)}</b></div><div class="ctA8Line"><span>예수금/현금</span><b>${cash?won(cash):'—'}</b></div><div class="ctA8Line"><span>보유종목</span><b>${(a.positions||[]).length}개</b></div></div><div class="ctA8Source">${source} · 기준 ${String(c.observed_at||'').replace('T',' ').slice(5,16)}</div></div>`}).join('');const html=`<div class="ctA8Head"><div><div class="ctA8Title">계좌별 성과</div><div class="ctA8Sub">6계좌 동일 Canonical SSOT 기준 · 값이 없으면 0원이 아니라 산정 대기로 표시</div></div><div class="ctA8Total">총자산 ${won(c.total&&c.total.nav)}<br>오늘 ${signed(c.total&&c.total.today_pnl)}</div></div><div class="ctA8Grid">${cards}</div>`;if(root.innerHTML!==html)root.innerHTML=html;window.__JJOONI_TABLET_ACCOUNTS_V8={state:'ACTIVE',version:'8.1',card_count:IDS.length}}
setTimeout(render,0);setTimeout(render,700);setInterval(()=>{if(!document.hidden)render()},900);window.addEventListener('resize',render);try{new MutationObserver(()=>{if(wide())requestAnimationFrame(render)}).observe(document.documentElement,{subtree:true,childList:true})}catch(_){}
})();
