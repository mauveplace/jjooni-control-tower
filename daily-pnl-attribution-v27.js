(function(){
'use strict';
if(window.__JJOONI_DAILY_PNL_ATTR_V27?.booted)return;
const S={booted:true,state:'BOOTING',version:'27.2',account:null,known:0,total:0,bridge:null,return_conflicts:0,updated_at:null};
window.__JJOONI_DAILY_PNL_ATTR_V27=S;
const IDS=['TOSS','ISA','PENSION','IRP','AI','TRIPOD'];
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
const won=v=>n(v)==null?'—':(Number(v)>=0?'+':'-')+'₩'+Math.round(Math.abs(Number(v))).toLocaleString('ko-KR');
const usd=v=>n(v)==null?'—':(Number(v)>=0?'+':'-')+'$'+Math.abs(Number(v)).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const pct=v=>n(v)==null?'—':(Number(v)>=0?'+':'')+Number(v).toFixed(2)+'%';
const qty=v=>n(v)==null?'—':Number(v).toLocaleString('ko-KR',{maximumFractionDigits:4})+'주';
const C=()=>window.__JJOONI_CANONICAL_SSOT||{};
function accountId(m){const t=norm(m?.querySelector('h1,h2,h3,.modalTitle,.title')?.textContent||m?.textContent).toUpperCase();if(t.includes('AI BOT'))return'AI';if(t.includes('TRI-POD')||t.includes('TRIPOD'))return'TRIPOD';if(t.includes('연금'))return'PENSION';if(/\bISA\b/.test(t))return'ISA';if(/\bIRP\b/.test(t))return'IRP';if(t.includes('TOSS'))return'TOSS';return null}
function positions(id){const a=C().accounts?.[id]||{};return window.JjooniMetrics?.positions?window.JjooniMetrics.positions(a):(a.positions||[]).filter(p=>!['CASH','CASH_EQUIVALENT','WATCHLIST'].includes(String(p?.record_type||'POSITION').toUpperCase()))}
function currency(p){return window.JjooniMetrics?.currency?.(p)||String(p?.currency||(String(p?.market||'').toUpperCase()==='US'?'USD':'KRW')).toUpperCase()}
const RETURN_KEYS=['daily_return','daily_return_pct','day_return','day_return_pct','today_return','today_return_pct'];
function signConflict(day,ret){const d=n(day),r=n(ret);return d!=null&&r!=null&&Math.abs(d)>0.01&&Math.abs(r)>0.0001&&Math.sign(d)!==Math.sign(r)}
function hasReturnConflict(p,day){for(const k of RETURN_KEYS){const x=n(p?.[k]);if(x!=null&&signConflict(day,x))return true}return false}
function dayReturn(p,a,day){
 for(const k of RETURN_KEYS){
  const x=n(p?.[k]);
  if(x==null)continue;
  // Broker/source percentage is not authoritative when its direction conflicts
  // with the canonical position P&L. Never display a negative return beside a
  // positive day P&L (or vice versa); fall through to a same-position identity.
  if(signConflict(day,x))continue;
  return x;
 }
 const v=window.JjooniMetrics?.valueKrw?.(p,a);
 if(day!=null&&v!=null&&v-day>0)return day/(v-day)*100;
 return null;
}
function nativeDayUsd(p,a,dayKrw){
 if(currency(p)!=='USD')return null;
 const direct=n(p?.day_pnl);if(direct!=null)return direct;
 const q=n(p?.qty??p?.quantity),cur=n(p?.current_price??p?.price),prev=n(p?.prev_close);
 if(q!=null&&cur>0&&prev>0)return q*(cur-prev);
 const f=window.JjooniMetrics?.fx?.(a,p)??n(p?.fx??p?.fx_krw_per_usd??a?.fx_krw_per_usd??a?.fx);
 return dayKrw!=null&&f!=null&&f>0?dayKrw/f:null;
}
function rows(id){const a=C().accounts?.[id]||{};return positions(id).map(p=>{const day=window.JjooniMetrics?.positionDay?.(p,a)??null;return{p,day,nativeUsd:nativeDayUsd(p,a,day),ret:dayReturn(p,a,day),retConflict:hasReturnConflict(p,day),value:window.JjooniMetrics?.valueKrw?.(p,a)??null}}).sort((x,y)=>{if(x.day==null&&y.day==null)return 0;if(x.day==null)return 1;if(y.day==null)return-1;return x.day-y.day})}
function ensureStyle(){if(document.getElementById('ctDailyPnlAttrV27Style'))return;const s=document.createElement('style');s.id='ctDailyPnlAttrV27Style';s.textContent=`
#ctDailyPnlAttrV27{margin:12px 0 14px;border:1px solid rgba(92,153,214,.38);border-radius:16px;background:linear-gradient(180deg,#0d2d4a,#0a243c);color:#eef6ff;overflow:hidden;box-shadow:0 12px 34px rgba(2,16,32,.18)}
.ctDp27Head{padding:14px 16px 10px}.ctDp27Title{font:950 18px/1.25 system-ui,-apple-system,'Noto Sans KR',sans-serif;letter-spacing:-.02em}.ctDp27Sub{margin-top:5px;font:700 10px/1.45 system-ui;color:#9fb6ce}.ctDp27Summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid rgba(255,255,255,.09);border-bottom:1px solid rgba(255,255,255,.09)}.ctDp27Sum{padding:10px 12px;border-right:1px solid rgba(255,255,255,.08)}.ctDp27Sum:last-child{border-right:0}.ctDp27Lab{font:800 9px/1.25 system-ui;color:#8fa8c1}.ctDp27Val{margin-top:4px;font:950 15px/1.15 system-ui}.ctDp27Pos{color:#ff7588}.ctDp27Neg{color:#69a9ff}.ctDp27Muted{color:#9fb0c3}.ctDp27Section{padding:9px 16px 0;font:900 11px/1.4 system-ui;color:#dcecff}.ctDp27Row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:11px 16px;border-top:1px solid rgba(255,255,255,.08);align-items:center}.ctDp27Name{min-width:0;font:900 12px/1.35 system-ui;overflow-wrap:anywhere}.ctDp27Meta{margin-top:3px;font:650 9px/1.35 system-ui;color:#88a2bd}.ctDp27Warn{color:#f4c75f}.ctDp27Right{text-align:right;white-space:nowrap}.ctDp27Money{font:950 14px/1.2 system-ui}.ctDp27KrwEq{margin-left:4px;font:750 10px/1.2 system-ui;color:#9fb6ce}.ctDp27Ret{margin-top:3px;font:800 9px/1.2 system-ui}.ctDp27Foot{padding:10px 16px 13px;border-top:1px solid rgba(255,255,255,.08);font:700 9px/1.5 system-ui;color:#8fa8c1}.ctDp27Missing{padding:13px 16px;color:#9fb0c3;font:750 10px/1.5 system-ui;border-top:1px solid rgba(255,255,255,.08)}
@media(max-width:767px){#ctDailyPnlAttrV27{width:100%;max-width:100%;min-width:0;margin:10px 0 12px}.ctDp27Head{padding:13px 13px 9px}.ctDp27Title{font-size:17px}.ctDp27Summary{grid-template-columns:1fr 1fr}.ctDp27Sum{padding:9px 10px}.ctDp27Sum:nth-child(2){border-right:0}.ctDp27Sum:nth-child(-n+2){border-bottom:1px solid rgba(255,255,255,.08)}.ctDp27Val{font-size:14px}.ctDp27Row{padding:10px 13px;gap:8px}.ctDp27Name{font-size:12px}.ctDp27Money{font-size:14px}.ctDp27KrwEq{display:block;margin:3px 0 0;font-size:9px}}
`;(document.head||document.documentElement).appendChild(s)}
function hideLegacy(m){const titles=['종목별 주가·환율 기여도','종목 기준 당일 가격효과','종목 기준 정규장 가격효과'];m.querySelectorAll('h1,h2,h3,h4,.label').forEach(h=>{const t=norm(h.textContent);if(!titles.some(x=>t.includes(x)))return;let box=h.closest('section,.card,.v2Card,[class*="Card"],[class*="card"]');if(!box||box===m)box=h.parentElement;if(box&&box!==m&&box.id!=='ctDailyPnlAttrV27'){box.dataset.ctV27LegacyHidden='1';box.style.display='none'}})}
function cls(v){return n(v)==null?'ctDp27Muted':Number(v)>0?'ctDp27Pos':Number(v)<0?'ctDp27Neg':'ctDp27Muted'}
function moneyHtml(x){if(x.day==null)return'당일 기준 미제공';if(x.nativeUsd!=null)return `${usd(x.nativeUsd)} <span class="ctDp27KrwEq">(원화 ${won(x.day)})</span>`;return won(x.day)}
function rowHtml(x){const p=x.p,name=norm(p.name||p.ticker||p.symbol||'종목'),ticker=String(p.ticker||p.symbol||''),q=p.qty??p.quantity,kind=String(p.record_type||'POSITION').toUpperCase();const unavailable=x.day==null,quality=x.retConflict?' <span class="ctDp27Warn">· 원천 수익률 부호충돌→손익기준 재산식</span>':'';return `<div class="ctDp27Row" data-v27-day-pnl="${x.day??''}" data-v27-return-conflict="${x.retConflict?'1':'0'}"><div><div class="ctDp27Name">${esc(name)}</div><div class="ctDp27Meta">${esc(ticker)} · ${qty(q)}${kind==='FUND'?' · 펀드':''}${quality}</div></div><div class="ctDp27Right"><div class="ctDp27Money ${cls(x.day)}">${moneyHtml(x)}</div><div class="ctDp27Ret ${cls(x.ret)}">${unavailable?'':pct(x.ret)}</div></div></div>`}
function insertPoint(m){return m.querySelector('.accountHeroPrimary,.v2HeroGrid,.v2AccountGrid,.accountHero,.hero')||m.querySelector('h1,h2,h3')}
function render(){const m=document.getElementById('accountDrillModal');if(!m)return;const id=accountId(m);if(!IDS.includes(id))return;ensureStyle();hideLegacy(m);const a=C().accounts?.[id]||{},xs=rows(id),known=xs.filter(x=>x.day!=null),loss=known.filter(x=>x.day<0),gain=known.filter(x=>x.day>0),knownSum=known.reduce((s,x)=>s+x.day,0),acct=n(a.today_pnl),bridge=acct!=null&&known.length?acct-knownSum:null,total=xs.length,returnConflicts=xs.filter(x=>x.retConflict).length;let root=m.querySelector('#ctDailyPnlAttrV27');if(!root){root=document.createElement('section');root.id='ctDailyPnlAttrV27';const anchor=insertPoint(m);if(anchor&&anchor!==m)anchor.insertAdjacentElement('afterend',root);else m.prepend(root)}const basis=C().generated_kst||C().observed_at||window.__JJOONI_LIVE_PAYLOAD?.generated_kst||'';const lossRows=loss.map(rowHtml).join(''),gainRows=gain.map(rowHtml).join(''),zeroRows=known.filter(x=>x.day===0).map(rowHtml).join(''),missingRows=xs.filter(x=>x.day==null).map(rowHtml).join('');const conflictNote=returnConflicts?` · 수익률 부호충돌 ${returnConflicts}건 재산식`:'';const body=`<div class="ctDp27Head"><div class="ctDp27Title">오늘 종목별 손익 · 많이 빠진 순</div><div class="ctDp27Sub">현재 보유종목 기준 · 계좌손익과 대사 · ${esc(basis||'기준시각 확인 중')}${conflictNote}</div></div><div class="ctDp27Summary"><div class="ctDp27Sum"><div class="ctDp27Lab">계좌 오늘손익</div><div class="ctDp27Val ${cls(acct)}">${acct==null?'산정 대기':won(acct)}</div></div><div class="ctDp27Sum"><div class="ctDp27Lab">보유종목 확인합계</div><div class="ctDp27Val ${cls(known.length?knownSum:null)}">${known.length?won(knownSum):'산정 대기'}</div></div><div class="ctDp27Sum"><div class="ctDp27Lab">매매·수수료·미확인 Bridge</div><div class="ctDp27Val ${cls(bridge)}">${bridge==null?'산정 대기':won(bridge)}</div></div><div class="ctDp27Sum"><div class="ctDp27Lab">손실 / 이익 종목</div><div class="ctDp27Val">${loss.length} / ${gain.length}</div></div></div>${lossRows?'<div class="ctDp27Section">▼ 오늘 빠진 종목</div>'+lossRows:'<div class="ctDp27Missing">현재 확인된 손실 종목이 없습니다.</div>'}${gainRows?'<div class="ctDp27Section">▲ 오늘 오른 종목</div>'+gainRows:''}${zeroRows?'<div class="ctDp27Section">― 보합</div>'+zeroRows:''}${missingRows?'<div class="ctDp27Section">기준 미제공</div>'+missingRows:''}<div class="ctDp27Foot">보유종목 손익은 Canonical positionDay 기준입니다. 미국 종목은 네이티브 USD 당일손익을 먼저 표시하고 원화 환산액을 괄호 안에 병기합니다. 원천 daily_return의 부호가 Canonical 당일손익과 충돌하면 그 수익률은 버리고 동일 포지션 손익/평가액 identity로 재산식합니다. 계좌 합계·대사·Bridge는 기존처럼 KRW 기준을 유지합니다. 계좌 오늘손익과의 차이는 당일 매도·매수, 실현손익, 수수료, 펀드/미확인 종목 등 현재 보유종목만으로 설명되지 않는 항목을 Bridge로 분리합니다. 0원으로 임의 대체하지 않습니다.</div>`;if(root.innerHTML!==body)root.innerHTML=body;S.state='ACTIVE';S.account=id;S.known=known.length;S.total=total;S.bridge=bridge;S.return_conflicts=returnConflicts;S.updated_at=new Date().toISOString()}
function burst(){[0,70,180,360,700,1200].forEach(ms=>setTimeout(render,ms))}
function wrap(){const fn=window.openAccountDrilldown;if(typeof fn!=='function'||fn.__jjooniDailyPnlV27)return;const w=function(){const r=fn.apply(this,arguments);burst();return r};w.__jjooniDailyPnlV27=true;w.__originalDailyPnlV27=fn;window.openAccountDrilldown=w}
ensureStyle();render();wrap();[250,700,1600].forEach(ms=>setTimeout(()=>{wrap();render()},ms));document.addEventListener('jjooni:live-applied',()=>{wrap();setTimeout(render,60);setTimeout(render,500)});document.addEventListener('click',e=>{if(e.target?.closest?.('[data-account-drill],.ctAcct,.ctP8Card,.ctA8Card'))burst()},{capture:true});
})();
