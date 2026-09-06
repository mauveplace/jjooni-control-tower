(function(){
'use strict';
if(window.__JJOONI_METRIC_DRILL_V11)return;

const IDS=['TOSS','ISA','PENSION','IRP','AI','TRIPOD'];
const LABEL={TOSS:'Toss',ISA:'ISA',PENSION:'연금저축',IRP:'IRP',AI:'AI BOT',TRIPOD:'TRI-POD'};
const ACCOUNT_ROUTES=new Set(['정규장 투자성과','순입출금','현재 NAV','오늘 수익률','전체 영향도','주식 평가액','예수금','📈 보유종목 가격효과','💱 보유종목 환율효과','🧩 당일매매·비용 Bridge','정규장 P&L','정규장 수익률','보유종목','KR','US','Best','Worst']);
const state={boundAccount:0,boundTab:0,disabled:0,headlineCorrections:0,last:null};
const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qa=(s,r=document)=>{try{return Array.from(r.querySelectorAll(s))}catch(_){return []}};
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const z=v=>n(v)==null?0:n(v);
const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
const C=()=>window.__JJOONI_CANONICAL_SSOT||{};
const L=()=>window.__JJOONI_LIVE_PAYLOAD||{};
const fx=()=>n(window.__JJOONI_FX_KRW_PER_USD)||n(L().accounts?.AI?.fx_krw_per_usd)||n(L().accounts?.TRIPOD?.fx)||1350;
const won=v=>'₩'+Math.round(Math.abs(Number(v)||0)).toLocaleString('ko-KR');
const signed=v=>{const x=Number(v)||0;return (x>=0?'+':'-')+won(x)};
const pct=(v,d=2)=>n(v)==null?'—':(Number(v)>=0?'+':'')+Number(v).toFixed(d)+'%';
const qtyText=v=>{const x=n(v);return x==null?'—':x.toLocaleString('ko-KR',{maximumFractionDigits:4})+'주'};
const money=v=>n(v)==null?'—':signed(v);
const sideCurrency=p=>String(p?.currency||((String(p?.market||'').toUpperCase()==='US')?'USD':'KRW')).toUpperCase();
const vis=e=>!!(e&&(e.offsetWidth||e.offsetHeight||e.getClientRects().length));

function accountIdFromModal(){
 const m=q('#accountDrillModal');if(!m||!vis(m))return null;
 const t=norm(q('h1,h2,h3,.modalTitle,.title',m)?.textContent).toUpperCase();
 if(t.includes('AI BOT'))return'AI';if(t.includes('TRI-POD')||t.includes('TRIPOD'))return'TRIPOD';if(t.includes('연금'))return'PENSION';if(/\bISA\b/.test(t))return'ISA';if(/\bIRP\b/.test(t))return'IRP';if(t.includes('TOSS'))return'TOSS';
 // Fallback: infer from unique NAV shown in the modal.
 const txt=norm(m.textContent),c=C();for(const id of IDS){const nav=n(c.accounts?.[id]?.nav);if(nav!=null&&txt.includes(won(nav)))return id}
 return null;
}
function positions(id){return (C().accounts?.[id]?.positions||[]).filter(x=>String(x?.record_type||'POSITION').toUpperCase()==='POSITION')}
function positionValueKrw(p){
 for(const k of ['market_value_krw','evaluation_amount_krw','eval_amount_krw','valuation_krw','evlu_amt_krw']){const x=n(p?.[k]);if(x!=null)return x}
 for(const k of ['market_value','evaluation_amount','eval_amount','valuation','evlu_amt','evaluation_value']){const x=n(p?.[k]);if(x!=null)return sideCurrency(p)==='USD'?x*fx():x}
 const qq=Math.abs(z(p?.qty??p?.quantity??p?.held_qty??p?.balance_qty)),px=n(p?.current_price??p?.price??p?.last_price);if(qq&&px!=null)return sideCurrency(p)==='USD'?qq*px*fx():qq*px;
 return null;
}
function accountSnapshot(id){
 const a=C().accounts?.[id]||{},ps=positions(id),vals=ps.map(positionValueKrw).filter(x=>x!=null),posValue=vals.length?vals.reduce((s,x)=>s+x,0):null;
 const cashKrw=n(a.cash_krw)||0,cashUsd=n(a.cash_usd)||0,cashTotal=cashKrw+cashUsd*fx();
 const nav=n(a.nav),pnl=n(a.today_pnl),ret=n(a.today_return),cum=n(a.pnl),cumRet=n(a.return_pct),flow=n(a.net_flow);
 return {id,a,ps,posValue,cashKrw,cashUsd,cashTotal,nav,pnl,ret,cum,cumRet,flow};
}
function topContributionRows(id){
 try{
  const m=typeof window.buildRegularSessionMetrics==='function'?window.buildRegularSessionMetrics():null,ps=(m?.positions||[]).filter(p=>String(p.account||p.account_type||'').toUpperCase()===id&&n(p.regular_pnl)!=null).sort((a,b)=>Math.abs(n(b.regular_pnl))-Math.abs(n(a.regular_pnl))).slice(0,10);
  return ps.map((p,i)=>[`${i+1}. ${p.name||p.ticker||'보유종목'}`,`${money(p.regular_pnl)} · ${qtyText(p.qty)}`]);
 }catch(_){return []}
}
function accountRows(id,label){
 const s=accountSnapshot(id),a=s.a,source=norm(a.quality||a.source||'Canonical SSOT')||'Canonical SSOT';
 if(label==='현재 NAV')return [['Canonical NAV',s.nav==null?'산정 대기':won(s.nav)],['보유자산 평가액',s.posValue==null?'산정 대기':won(s.posValue)],['KRW 예수금',won(s.cashKrw)],['USD 예수금',s.cashUsd?'$'+s.cashUsd.toLocaleString('en-US',{maximumFractionDigits:2}):'$0'],['적용 환율',s.cashUsd?fx().toLocaleString('ko-KR')+'원/USD':'해당 없음'],['데이터 근거',source]];
 if(label==='정규장 투자성과'||label==='정규장 P&L')return [['오늘 투자손익',s.pnl==null?'산정 대기':money(s.pnl)],['오늘 수익률',s.ret==null?'산정 대기':pct(s.ret)],['산정 근거',source],...topContributionRows(id)];
 if(label==='오늘 수익률'||label==='정규장 수익률')return [['오늘 수익률',s.ret==null?'산정 대기':pct(s.ret)],['오늘 투자손익',s.pnl==null?'산정 대기':money(s.pnl)],['현재 NAV',s.nav==null?'산정 대기':won(s.nav)],['산정 근거',source]];
 if(label==='순입출금')return [['오늘 순입출금',s.flow==null?'확인값 없음':money(s.flow)],['현재 NAV',s.nav==null?'산정 대기':won(s.nav)],['분류','투자손익과 별도 Flow로 관리'],['데이터 근거',source]];
 if(label==='전체 영향도'){
   const total=n(C().total?.nav),impact=s.pnl!=null&&total?100*s.pnl/total:null;return [['계좌 오늘손익',s.pnl==null?'산정 대기':money(s.pnl)],['전체 6계좌 NAV',total==null?'산정 대기':won(total)],['산식',impact==null?'산정 대기':`${money(s.pnl)} ÷ ${won(total)} × 100`],['포트폴리오 영향도',impact==null?'산정 대기':(impact>=0?'+':'')+impact.toFixed(3)+'%p']];
 }
 if(label==='주식 평가액')return [['보유자산 평가액',s.posValue==null?'산정 대기':won(s.posValue)],['보유종목 수',s.ps.length+'개'],['계산 기준','Canonical 보유수량 × 현재가 · USD는 KRW 환산'],...s.ps.slice(0,12).map((p,i)=>[`${i+1}. ${p.name||p.ticker||'종목'}`,positionValueKrw(p)==null?'가격 미확인':won(positionValueKrw(p))])];
 if(label==='예수금')return [['KRW 예수금',won(s.cashKrw)],['USD 예수금',s.cashUsd?'$'+s.cashUsd.toLocaleString('en-US',{maximumFractionDigits:2}):'$0'],['USD 원화환산',s.cashUsd?won(s.cashUsd*fx()):'₩0'],['합산 현금',won(s.cashTotal)],['적용 환율',s.cashUsd?fx().toLocaleString('ko-KR')+'원/USD':'해당 없음']];
 if(label==='보유종목'||label==='KR'||label==='US'){
   const target=label==='KR'?s.ps.filter(p=>sideCurrency(p)!=='USD'):label==='US'?s.ps.filter(p=>sideCurrency(p)==='USD'):s.ps;
   return [['대상',label==='보유종목'?'전체 보유종목':label+' 시장'],['종목 수',target.length+'개'],...target.map((p,i)=>[`${i+1}. ${p.name||p.ticker||'종목'}`,`${qtyText(p.qty??p.quantity)} · ${positionValueKrw(p)==null?'평가액 산정 대기':won(positionValueKrw(p))}`])];
 }
 if(label==='📈 보유종목 가격효과'||label==='💱 보유종목 환율효과'||label==='🧩 당일매매·비용 Bridge'){
   const key=label.includes('가격효과')?'price_effect_krw':label.includes('환율효과')?'fx_effect_krw':'trade_cost_bridge_krw',v=n(a[key]);
   return [['현재 상태',v==null?'세부 구성값 산정 대기':money(v)],['오늘 계좌손익',s.pnl==null?'산정 대기':money(s.pnl)],['주의','구성값이 원천 데이터에 없으면 0원으로 간주하지 않습니다.'],['데이터 근거',source]];
 }
 return null;
}
function setCardValue(el,text){const v=q('.value,.v2Value,[class*="Value"],[class*="value"]',el);if(v&&text&&norm(v.textContent)!==text){v.textContent=text;state.headlineCorrections++}}
function correctAccountHeadline(el,id,label){
 const s=accountSnapshot(id);
 if(label==='주식 평가액'&&s.posValue!=null)setCardValue(el,won(s.posValue));
 if(label==='현재 NAV'&&s.nav!=null)setCardValue(el,won(s.nav));
 if((label==='정규장 투자성과'||label==='정규장 P&L')&&s.pnl!=null)setCardValue(el,money(s.pnl));
 if((label==='오늘 수익률'||label==='정규장 수익률')&&s.ret!=null)setCardValue(el,pct(s.ret));
 if(label==='예수금')setCardValue(el,won(s.cashTotal));
 if(label==='순입출금'&&s.flow!=null)setCardValue(el,money(s.flow));
 if(label==='전체 영향도'){
   const total=n(C().total?.nav),imp=s.pnl!=null&&total?100*s.pnl/total:null;if(imp!=null)setCardValue(el,(imp>=0?'+':'')+imp.toFixed(3)+'%p');
 }
 for(const k of ['📈 보유종목 가격효과','💱 보유종목 환율효과','🧩 당일매매·비용 Bridge'])if(label===k){const key=k.includes('가격효과')?'price_effect_krw':k.includes('환율효과')?'fx_effect_krw':'trade_cost_bridge_krw';if(n(s.a[key])==null)setCardValue(el,'산정 대기')}
}
function openAccount(el){
 const id=el.dataset.metricAccountV11||accountIdFromModal(),label=el.dataset.metricLabelV11||norm(q('.label',el)?.textContent),value=norm(q('.value,.v2Value,[class*="Value"],[class*="value"]',el)?.textContent)||norm(el.textContent);
 if(!id||!label||typeof window.openMetricInfo!=='function')return;
 const rows=accountRows(id,label);if(!rows)return;
 window.openMetricInfo(label,value,rows);state.last={scope:'account',account:id,label,value};publish();
}
function disable(el,reason){
 delete el.dataset.autoDrill;el.dataset.noAutoDrill='1';el.dataset.metricDisabledV11=reason||'NO_DEDICATED_DETAIL';el.removeAttribute('role');el.removeAttribute('tabindex');el.style.cursor='default';state.disabled++;
}
function bindAccounts(){
 const m=q('#accountDrillModal');if(!m||!vis(m))return;const id=accountIdFromModal();if(!id)return;
 qa('.v2Kpi',m).forEach(el=>{
   if(el.dataset.tradeMetricDetail)return; // V9 is authoritative for the four recent-trade metrics.
   const label=norm(q('.label',el)?.textContent);if(!label)return;
   if(el.dataset.noAutoDrill==='1'&&!el.dataset.autoDrill&&!ACCOUNT_ROUTES.has(label))return; // preserve Best/Worst custom transaction handlers.
   if(!el.dataset.autoDrill&&!ACCOUNT_ROUTES.has(label))return;
   delete el.dataset.autoDrill;el.dataset.noAutoDrill='1';
   if((label==='Best'||label==='Worst')&&norm(q('.value',el)?.textContent)==='—'){disable(el,'EMPTY_BEST_WORST');return}
   if(!ACCOUNT_ROUTES.has(label)){disable(el,'UNSUPPORTED_ACCOUNT_METRIC');return}
   el.dataset.metricDrillV11='account';el.dataset.metricAccountV11=id;el.dataset.metricLabelV11=label;el.style.cursor='pointer';correctAccountHeadline(el,id,label);state.boundAccount++;
 });
}
function humanSnapshot(){
 const ids=['TOSS','ISA','PENSION','IRP'],as=ids.map(accountSnapshot),nav=as.reduce((s,x)=>s+z(x.nav),0),pnl=as.reduce((s,x)=>s+z(x.cum),0),day=as.reduce((s,x)=>s+z(x.pnl),0),base=nav-pnl,ret=base?100*pnl/base:null;return {ids,as,nav,pnl,day,ret};
}
function allSnapshot(){const as=IDS.map(accountSnapshot),nav=n(C().total?.nav)??as.reduce((s,x)=>s+z(x.nav),0),pnl=as.reduce((s,x)=>s+z(x.cum),0),base=nav-pnl,ret=base?100*pnl/base:null;return {as,nav,pnl,ret}}
function tripodPos(){return positions('TRIPOD').find(p=>String(p.ticker||p.symbol||'').toUpperCase().replace(/\.(KS|KQ)$/,'')==='TQQQ')||positions('TRIPOD')[0]||null}
function mainRoute(text,panel){
 const t=norm(text);
 if(/Source|Observed/i.test(t)||panel.includes('quality'))return {kind:'disable',reason:'TECHNICAL_METADATA'};
 if(t.startsWith('전체 6계좌 NAV'))return {kind:'total-nav'};
 if(t.startsWith('총 누적손익'))return {kind:'total-pnl'};
 if(t.startsWith('총 수익률'))return {kind:'total-return'};
 if(t.startsWith('Human MDD'))return {kind:'disable',reason:'HISTORY_REQUIRED'};
 if(t.startsWith('현재 보유 TQQQ'))return {kind:'tripod-qty'};
 if(t.startsWith('평균단가'))return {kind:'tripod-avg'};
 if(t.startsWith('현재가'))return {kind:'tripod-price'};
 if(t.startsWith('평가손익'))return {kind:'tripod-pnl'};
 if(t.startsWith('수익률')&&!t.startsWith('정규장'))return {kind:'tripod-return'};
 if(t.startsWith('송팀장 목표'))return {kind:'disable',reason:'STRATEGY_REFERENCE'};
 if(t.startsWith('Human 정규장 P&L'))return {kind:'human-day'};
 if(t.startsWith('장외변동'))return {kind:'disable',reason:'NO_CANONICAL_COMPONENT'};
 if(t.startsWith('현재 Human NAV'))return {kind:'human-nav'};
 if(t.startsWith('정규장 수익률'))return {kind:'human-day-return'};
 if(t.startsWith('누적수익률'))return {kind:'human-return'};
 if(t.startsWith('현재 Drawdown')||t.startsWith('최대 MDD'))return {kind:'disable',reason:'HISTORY_REQUIRED'};
 if(t.startsWith('보유종목 상승 기여')||t.startsWith('보유종목 하락 기여'))return {kind:'contribution'};
 if(/^Human\s/.test(t)&&/%/.test(t))return {kind:'human-return'};
 if(t.startsWith('AI Bot'))return {kind:'ai-return'};
 if(t.startsWith('AI α'))return {kind:'disable',reason:'BENCHMARK_CONTEXT_REQUIRED'};
 if(t.startsWith('AI NAV')||(/^NAV\s/.test(t)&&panel.includes('ai')))return {kind:'ai-nav'};
 if(t.startsWith('AI MDD')||(/^MDD\s/.test(t)&&panel.includes('ai')))return {kind:'disable',reason:'HISTORY_REQUIRED'};
 if(t.startsWith('AI 체결'))return {kind:'ai-trades'};
 if(/^Return\s/.test(t)&&panel.includes('ai'))return {kind:'ai-return'};
 return {kind:'disable',reason:'NO_DEDICATED_DETAIL'};
}
function mainRows(kind){
 const H=humanSnapshot(),A=allSnapshot(),ai=accountSnapshot('AI'),tp=tripodPos();
 if(kind==='total-nav')return [['Canonical 6계좌 NAV',won(A.nav)],...A.as.map(x=>[LABEL[x.id],x.nav==null?'산정 대기':won(x.nav)])];
 if(kind==='total-pnl')return [['6계좌 누적손익',money(A.pnl)],...A.as.map(x=>[LABEL[x.id],x.cum==null?'산정 대기':money(x.cum)])];
 if(kind==='total-return')return [['6계좌 누적수익률',pct(A.ret)],['누적손익',money(A.pnl)],['현재 NAV',won(A.nav)],['산식','누적손익 ÷ (현재 NAV − 누적손익)']];
 if(kind==='human-nav')return [['Human 4계좌 NAV',won(H.nav)],...H.as.map(x=>[LABEL[x.id],x.nav==null?'산정 대기':won(x.nav)])];
 if(kind==='human-day')return [['Human 오늘 투자손익',money(H.day)],...H.as.map(x=>[LABEL[x.id],x.pnl==null?'산정 대기':money(x.pnl)])];
 if(kind==='human-day-return'){const r=H.nav?100*H.day/H.nav:null;return [['Human 정규장 수익률',r==null?'산정 대기':pct(r)],['Human 오늘손익',money(H.day)],['Human 현재 NAV',won(H.nav)],['표시 기준','오늘손익 ÷ 현재 NAV']];}
 if(kind==='human-return')return [['Human 누적수익률',H.ret==null?'산정 대기':pct(H.ret)],['Human 누적손익',money(H.pnl)],['Human 현재 NAV',won(H.nav)],['산식','누적손익 ÷ (현재 NAV − 누적손익)']];
 if(kind==='ai-nav')return accountRows('AI','현재 NAV');
 if(kind==='ai-return')return [['AI BOT 누적수익률',ai.cumRet==null?'산정 대기':pct(ai.cumRet)],['누적손익',ai.cum==null?'산정 대기':money(ai.cum)],['현재 NAV',ai.nav==null?'산정 대기':won(ai.nav)]];
 if(kind==='ai-trades'){let tr=[];try{if(typeof D!=='undefined')tr=D.ai?.trades_31d||D.ai?.latest?.trades||[]}catch(_){}return [['최근 AI 체결',tr.length+'건'],...tr.slice(0,15).map((x,i)=>[`${i+1}. ${x.name||x.ticker||'거래'}`,`${norm(x.side)} · ${qtyText(x.qty)} · ${n(x.price)==null?'가격 미확인':n(x.price).toLocaleString('ko-KR')}`])];}
 if(kind==='contribution')return [['Human 오늘손익',money(H.day)],['상승/하락 기여','보유종목별 정규장 P&L 합산'],...['TOSS','ISA','PENSION','IRP'].flatMap(id=>topContributionRows(id).slice(0,4).map(r=>[LABEL[id]+' · '+r[0],r[1]]))];
 if(kind.startsWith('tripod-')){
   if(!tp)return [['TRI-POD 보유','현재 보유종목 없음']];const qq=Math.abs(z(tp.qty??tp.quantity)),avg=n(tp.avg_price??tp.average_price),cur=n(tp.current_price??tp.price),val=positionValueKrw(tp),pnl=n(tp.unrealized_pnl_krw??tp.pnl_krw)??(avg!=null&&cur!=null?((cur-avg)*qq*fx()):null),ret=avg&&cur?100*(cur/avg-1):null;
   return [['종목',tp.name||tp.ticker||'TQQQ'],['보유수량',qtyText(qq)],['평균단가',avg==null?'산정 대기':'$'+avg.toLocaleString('en-US',{maximumFractionDigits:4})],['현재가',cur==null?'산정 대기':'$'+cur.toLocaleString('en-US',{maximumFractionDigits:4})],['평가액',val==null?'산정 대기':won(val)],['평가손익',pnl==null?'산정 대기':money(pnl)],['수익률',ret==null?'산정 대기':pct(ret)]];
 }
 return null;
}
function patchMainHeadline(el,kind){
 const H=humanSnapshot(),A=allSnapshot(),ai=accountSnapshot('AI'),tp=tripodPos();let value=null;
 if(kind==='total-nav')value=won(A.nav);if(kind==='total-pnl')value=money(A.pnl);if(kind==='total-return')value=pct(A.ret);
 if(kind==='human-nav')value=won(H.nav);if(kind==='human-day')value=money(H.day);if(kind==='human-return')value=pct(H.ret);
 if(kind==='human-day-return')value=H.nav?pct(100*H.day/H.nav):null;if(kind==='ai-nav'&&ai.nav!=null)value=won(ai.nav);if(kind==='ai-return'&&ai.cumRet!=null)value=pct(ai.cumRet);
 if(kind==='ai-trades'){let tr=[];try{if(typeof D!=='undefined')tr=D.ai?.trades_31d||D.ai?.latest?.trades||[]}catch(_){}value=tr.length+'건'}
 if(tp){const qq=Math.abs(z(tp.qty??tp.quantity)),avg=n(tp.avg_price??tp.average_price),cur=n(tp.current_price??tp.price),pnl=n(tp.unrealized_pnl_krw??tp.pnl_krw)??(avg!=null&&cur!=null?((cur-avg)*qq*fx()):null),ret=avg&&cur?100*(cur/avg-1):null;if(kind==='tripod-qty')value=qtyText(qq);if(kind==='tripod-avg'&&avg!=null)value='$'+avg.toLocaleString('en-US',{maximumFractionDigits:4});if(kind==='tripod-price'&&cur!=null)value='$'+cur.toLocaleString('en-US',{maximumFractionDigits:4});if(kind==='tripod-pnl'&&pnl!=null)value=money(pnl);if(kind==='tripod-return'&&ret!=null)value=pct(ret)}
 if(!value)return;const v=q('.value,.v2Value,[class*="Value"],[class*="value"],b',el);if(v&&norm(v.textContent)!==value){v.textContent=value;state.headlineCorrections++}
}
function bindGlobal(){
 qa('[data-auto-drill]').forEach(el=>{
   if(el.closest('#accountDrillModal'))return;
   const panel=el.closest('[id^="panel-"]')?.id||'',route=mainRoute(el.textContent,panel);
   delete el.dataset.autoDrill;el.dataset.noAutoDrill='1';
   if(route.kind==='disable'){disable(el,route.reason);return}
   el.dataset.metricDrillV11='main';el.dataset.metricKindV11=route.kind;el.style.cursor='pointer';patchMainHeadline(el,route.kind);state.boundTab++;
 });
}
function openMain(el){
 const kind=el.dataset.metricKindV11,rows=mainRows(kind);if(!rows||typeof window.openMetricInfo!=='function')return;
 const t=norm(el.textContent),label=t.replace(/[₩$+\-]?\d[\d,.]*(?:%p|%|원|건|주)?[\s\S]*$/,'').trim()||kind,value=norm(q('.value,.v2Value,[class*="Value"],[class*="value"],b',el)?.textContent)||t;
 window.openMetricInfo(label,value,rows);state.last={scope:'main',kind,label,value};publish();
}
function capture(e){
 const el=e.target?.closest?.('[data-metric-drill-v11],[data-metric-disabled-v11]');if(!el)return;
 e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();
 if(el.dataset.metricDisabledV11)return false;
 if(el.dataset.metricDrillV11==='account')openAccount(el);else openMain(el);return false;
}
function publish(){window.__JJOONI_METRIC_DRILL_V11={state:'ACTIVE',version:'11.0',bound_account:state.boundAccount,bound_tab:state.boundTab,disabled:state.disabled,headline_corrections:state.headlineCorrections,last:state.last,generic_auto_remaining:qa('[data-auto-drill]').length}}
function scan(){state.boundAccount=0;state.boundTab=0;state.disabled=0;bindAccounts();bindGlobal();publish()}

document.addEventListener('click',capture,true);
scan();setTimeout(scan,250);setTimeout(scan,900);setInterval(()=>{if(!document.hidden)scan()},1200);
try{new MutationObserver(()=>queueMicrotask(scan)).observe(document.documentElement,{subtree:true,childList:true})}catch(_){}
window.__JJOONI_METRIC_DRILL_V11={state:'BOOTING',version:'11.0'};
})();
