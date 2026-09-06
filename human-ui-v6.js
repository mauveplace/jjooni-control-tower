(function(){
'use strict';
if(window.__JJOONI_HUMAN_UI_V6)return;
window.__JJOONI_HUMAN_UI_V6={state:'BOOTING',version:'6.1'};

const IDS=['TOSS','ISA','PENSION','IRP','AI','TRIPOD'];
const LABEL={TOSS:'Toss',ISA:'ISA',PENSION:'연금저축',IRP:'IRP',AI:'AI BOT',TRIPOD:'TRI-POD'};
const qs=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qsa=(s,r=document)=>{try{return Array.from(r.querySelectorAll(s))}catch(_){return []}};
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const won=v=>'₩'+Math.round(Math.abs(Number(v)||0)).toLocaleString('ko-KR');
const signed=v=>{const x=Number(v)||0;return (x>=0?'+':'-')+won(x)};
const usd=v=>'$'+Math.abs(Number(v)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

function mobile(){return window.matchMedia('(max-width:767px)').matches}
function trustKind(raw){
 const s=String(raw||'').toUpperCase();
 if(s.includes('BROKER')||s.includes('ACTUAL')||s==='FULL'||s==='LIVE')return 'measured';
 if(s.includes('MODEL')||s.includes('MODELED')||s.includes('MTM')||s.includes('ACCOUNTING')||s.includes('PROXY')||s.includes('PARTIAL'))return 'modeled';
 return 'reference';
}
function trustLabel(kind){return kind==='measured'?'증권사 확인':kind==='modeled'?'계산값':'참고값'}
function live(){return window.__JJOONI_LIVE_PAYLOAD||{}}
function canon(){return window.__JJOONI_CANONICAL_SSOT||{}}

function parseKstMs(v){
 const raw=String(v||'').trim();if(!raw)return null;
 let s=raw;
 if(!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(s)&&/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s))s=s.replace(' ','T')+'+09:00';
 const ms=Date.parse(s);return Number.isFinite(ms)?ms:null;
}
function stamp(v){
 const ms=parseKstMs(v);if(ms==null)return '시각 확인 중';
 const p=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date(ms));
 const get=t=>(p.find(x=>x.type===t)||{}).value||'';
 return `${get('month')}/${get('day')} ${get('hour')}:${get('minute')}`;
}
function basisTime(){const L=live();return L.generated_kst||L.source_snapshot_kst||L.observed_at||canon().observed_at||''}
function basisAgeMs(){const ms=parseKstMs(basisTime());return ms==null?null:Math.max(0,Date.now()-ms)}
function ageText(ms){
 if(ms==null)return '경과시간 확인 불가';
 const min=Math.floor(ms/60000);if(min<60)return `${Math.max(0,min)}분 경과`;
 const h=Math.floor(min/60),m=min%60;return m>=30?`${h+1}시간 경과`:`${h}시간 경과`;
}
function nextTime(){const L=live();return L.next_expected_update_kst||''}
function freshnessState(){
 const L=live(),s=String(L.schedule_contract_state||'').toUpperCase(),session=String((L.session||{}).state||'').toUpperCase(),age=basisAgeMs();
 if(age==null)return {kind:'warn',text:'기준시각 확인 필요',age_ms:null};
 if(age>24*60*60*1000)return {kind:'warn',text:'⚠ 데이터 '+ageText(age),age_ms:age};
 if(s==='MISMATCH')return {kind:'warn',text:'수집 일정 확인 필요',age_ms:age};
 if(age>30*60*1000){
   if(session==='CLOSED')return {kind:'closed',text:'장 마감 · '+ageText(age),age_ms:age};
   return {kind:'warn',text:'데이터 '+ageText(age),age_ms:age};
 }
 if(session==='CLOSED')return {kind:'closed',text:'장 마감 기준',age_ms:age};
 const liq=String(((L.price_liquidity_quality||{}).state)||'').toUpperCase();
 if(liq==='THIN')return {kind:'warn',text:'저유동성 구간',age_ms:age};
 return {kind:'good',text:'최신 기준',age_ms:age};
}
function accountCard(id){
 const label=LABEL[id].toLowerCase();return qsa('.ctAcct').find(c=>String(qs('.ctAcctName',c)?.textContent||'').toLowerCase().includes(label))||null;
}
function todayPnl(c){for(const k of ['today_pnl','investment_pnl','market_pnl','session_change']){const x=n(c&&c[k]);if(x!=null)return x}return null}
function humanAccountLine(id,c){
 const kind=trustKind(c.quality||c.source||''),source=trustLabel(kind),basis=stamp(basisTime()),day=todayPnl(c),fresh=freshnessState();
 const bits=[];
 if(id==='TOSS'){
   if(n(c.cash_krw)!=null)bits.push(`예수금 ${won(c.cash_krw)}`);
   if(n(c.cash_usd)!=null)bits.push(`USD ${usd(c.cash_usd)}`);
 }else if(['ISA','PENSION','IRP'].includes(id)){
   if(n(c.cash_krw)!=null)bits.push(`예수금 ${won(c.cash_krw)}`);
 }else if(id==='AI'){
   if(n(c.cash_krw)!=null)bits.push(`예수금 ${won(c.cash_krw)}`);
   if(n(c.cash_usd)!=null)bits.push(`USD ${usd(c.cash_usd)}`);
 }else if(id==='TRIPOD'){
   const a=(live().accounts||{}).TRIPOD||{};
   if(n(a.qty)!=null)bits.push(`TQQQ ${Math.round(a.qty).toLocaleString('ko-KR')}주`);
   if(n(c.current_price)!=null)bits.push(`현재가 ${usd(c.current_price)}`);
 }
 bits.push(source);
 bits.push(`기준 ${basis}`);
 if(fresh.kind!=='good')bits.push(fresh.text);
 bits.push(day==null?'오늘손익 산정 대기':`오늘손익 ${signed(day)}`);
 if(['ISA','PENSION','IRP'].includes(id)&&n(c.net_flow)!=null)bits.push(`순입출금 ${signed(c.net_flow)}`);
 return {html:bits.join(' · '),kind};
}
function ensureStyle(){
 if(qs('#ctHumanUiV6Style'))return;
 const st=document.createElement('style');st.id='ctHumanUiV6Style';st.textContent=`
#ctCanonicalTOSS,#ctCanonicalISA,#ctCanonicalPENSION,#ctCanonicalIRP,#ctCanonicalAI,#ctCanonicalTRIPOD,#ctTossAttributionLine{display:none!important}
.ctHumanAccountLineV6{grid-column:1/-1;font:800 9px/1.45 system-ui,-apple-system,sans-serif;margin-top:4px;padding-top:5px;border-top:1px dashed #e7ebf0;text-align:right;white-space:normal;color:#667085}
.ctHumanAccountLineV6 .measured{color:#087443}.ctHumanAccountLineV6 .modeled{color:#175cd3}.ctHumanAccountLineV6 .reference{color:#b45309}
#ctHeroTrustStripV4{display:none!important}
#ctHeroTrustStripV6{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}
#ctHeroTrustStripV6 button{appearance:none;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:#eef5ff;border-radius:999px;padding:6px 9px;font:850 10px/1 system-ui;cursor:pointer}
#ctHeroTrustStripV6 button.measured:before{content:'● ';}#ctHeroTrustStripV6 button.modeled:before{content:'◐ ';}#ctHeroTrustStripV6 button.reference:before{content:'○ ';}
#ctTrustDetailV6{margin-top:8px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(255,255,255,.06);padding:9px;color:#eef5ff}
#ctTrustDetailV6[hidden]{display:none!important}.ctTrustDetailTitleV6{font-size:11px;font-weight:900}.ctTrustDetailSubV6{font-size:8px;color:#aebfd2;margin-top:2px;line-height:1.35}.ctTrustRowV6{display:grid;grid-template-columns:70px minmax(0,1fr) auto;gap:7px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.08);font-size:9px}.ctTrustRowV6:last-of-type{border-bottom:0}.ctTrustRowV6 b{font-size:10px}.ctTrustSourceV6{color:#c9d6e6}.ctTrustFootV6{font-size:8px;color:#aebfd2;margin-top:7px;line-height:1.4}
#overviewDailyReturn.ctHumanCompletionV6{font-size:10px!important;font-weight:850!important;color:#b7c7da!important;letter-spacing:0!important}
@media(max-width:767px){
 .top{display:flex!important;align-items:center!important;gap:8px!important;overflow:visible!important}
 #ctProducerFreshnessBadge{position:static!important;right:auto!important;left:auto!important;top:auto!important;bottom:auto!important;transform:none!important;margin:0 0 0 auto!important;max-width:calc(100% - 46px)!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;z-index:1!important;box-shadow:none!important;padding:6px 9px!important;font-size:9px!important}
 #ctEncryptedLiveBadge{display:none!important}
 #ctMobileNetSummaryV4 .ctNetValue{position:relative!important;z-index:1!important}
}
`;(document.head||document.documentElement).appendChild(st);
}
function updateAccountCards(){
 const C=canon();if(!C.accounts)return;
 IDS.forEach(id=>{
   const c=C.accounts[id]||{},card=accountCard(id);if(!card)return;
   let line=qs('#ctHuman'+id+'V6',card);if(!line){line=document.createElement('div');line.id='ctHuman'+id+'V6';line.className='ctHumanAccountLineV6';card.appendChild(line)}
   const info=humanAccountLine(id,c),sourceClass=info.kind;
   const parts=info.html.split(' · '),html=parts.map(x=>x===trustLabel(info.kind)?`<span class="${sourceClass}">${x}</span>`:x).join(' · ');
   if(line.innerHTML!==html)line.innerHTML=html;
 });
}
function trustRows(){
 const C=canon(),rows=[];
 IDS.forEach(id=>{const c=(C.accounts||{})[id]||{},kind=trustKind(c.quality||c.source||''),p=todayPnl(c);rows.push({id,label:LABEL[id],kind,pnl:p})});
 return rows;
}
function updateTrust(){
 if(!mobile())return;
 const h=qs('.ctOvPrimary');if(!h)return;
 const rows=trustRows(),counts={measured:0,modeled:0,reference:0},sums={measured:0,modeled:0,reference:0};
 rows.forEach(r=>{counts[r.kind]++;if(r.pnl!=null)sums[r.kind]+=r.pnl});
 let strip=qs('#ctHeroTrustStripV6',h);if(!strip){strip=document.createElement('div');strip.id='ctHeroTrustStripV6';h.appendChild(strip)}
 const buttons=[];
 if(counts.measured)buttons.push(`<button type="button" class="measured" data-trust-v6="measured">증권사 확인 ${counts.measured}계좌</button>`);
 if(counts.modeled)buttons.push(`<button type="button" class="modeled" data-trust-v6="modeled">계산값 ${counts.modeled}계좌</button>`);
 if(counts.reference)buttons.push(`<button type="button" class="reference" data-trust-v6="reference">참고값 ${counts.reference}계좌</button>`);
 const bh=buttons.join('');if(strip.innerHTML!==bh)strip.innerHTML=bh;
 let detail=qs('#ctTrustDetailV6',h);if(!detail){detail=document.createElement('div');detail.id='ctTrustDetailV6';detail.hidden=true;h.appendChild(detail)}
 const body=rows.map(r=>`<div class="ctTrustRowV6"><b>${r.label}</b><span class="ctTrustSourceV6">${trustLabel(r.kind)}</span><span>${r.pnl==null?'산정 대기':signed(r.pnl)}</span></div>`).join('');
 const known=rows.filter(r=>r.pnl!=null).reduce((s,r)=>s+r.pnl,0);
 const dh=`<div class="ctTrustDetailTitleV6">오늘 투자손익 산정 근거</div><div class="ctTrustDetailSubV6">증권사 확인은 증권사가 전달한 값, 계산값은 현재가·전일종가·수량을 이용해 산출한 값입니다.</div>${body}<div class="ctTrustFootV6">증권사 확인 합계 ${signed(sums.measured)} · 계산값 합계 ${signed(sums.modeled)}${counts.reference?' · 참고값 합계 '+signed(sums.reference):''}<br>6계좌 합계 ${signed(known)}</div>`;
 if(detail.innerHTML!==dh)detail.innerHTML=dh;
 if(!strip.dataset.boundV6){strip.dataset.boundV6='1';strip.addEventListener('click',e=>{const b=e.target.closest('button[data-trust-v6]');if(!b)return;detail.hidden=!detail.hidden})}
}
function humanProducerText(){
 const basis=stamp(basisTime()),next=nextTime()?stamp(nextTime()):'',st=freshnessState();
 if(st.kind==='warn')return `${st.text} · 기준 ${basis}`;
 if(st.kind==='closed')return `● ${st.text} · 기준 ${basis}${next?' · 다음 '+next:''}`;
 return `● 최신 · 기준 ${basis}${next?' · 다음 '+next:''}`;
}
function updateProducerBadge(){
 const b=qs('#ctProducerFreshnessBadge');if(!b)return;
 const top=qs('.top');if(mobile()&&top&&b.parentNode!==top)top.appendChild(b);
 const text=humanProducerText();if(b.textContent!==text)b.textContent=text;
 b.title='데이터 경과시간은 generated_kst 기준으로 계산합니다. 브라우저 렌더 시각은 freshness 판정에 쓰지 않습니다.';
}
function updateHeroCompletion(){
 const e=qs('#overviewDailyReturn'),C=canon();if(!e||!C.total)return;
 const missing=(C.total.missing_today||[]).length;
 const text=C.total.today_complete?'합산 완료':missing?`미연결 ${missing}계좌`:'일부 산정';
 if(e.textContent!==text)e.textContent=text;e.classList.add('ctHumanCompletionV6');
}
function scrubKnownCodes(){
 const roots=qsa('.ctAcct');
 roots.forEach(root=>qsa('[title]',root).forEach(e=>{const t=String(e.title||'');if(/\b(REF|MODEL(?:ED)?(?:_LIVE)?|BROKER(?:_LIVE)?|NO_DATA|STALE)\b/i.test(t))e.removeAttribute('title')}));
}
function apply(){
 ensureStyle();updateAccountCards();updateTrust();updateProducerBadge();updateHeroCompletion();scrubKnownCodes();
 const rows=trustRows(),counts={measured:0,modeled:0,reference:0};rows.forEach(r=>counts[r.kind]++);const age=basisAgeMs();
 window.__JJOONI_HUMAN_UI_V6={state:'ACTIVE',version:'6.1',internal_codes_hidden:true,producer_badge_human:true,trust_detail_expandable:true,measured_accounts:counts.measured,modeled_accounts:counts.modeled,reference_accounts:counts.reference,basis_kst:basisTime(),basis_epoch_ms:parseKstMs(basisTime()),data_age_ms:age,data_age_text:ageText(age),freshness_authority:'generated_kst',dynamic_viewport:CSS.supports('height','100dvh')};
}
let scheduled=false;function schedule(){if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;apply()},45)}
document.addEventListener('jjooni:live-applied',schedule);
window.addEventListener('resize',schedule,{passive:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
setTimeout(apply,0);setTimeout(apply,700);setTimeout(apply,1800);
})();
