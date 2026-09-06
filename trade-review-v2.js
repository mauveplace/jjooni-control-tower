(function(){
'use strict';

const CFG={
  primary:['overview','trades','portfolio','accounts'],
  secondary:['compare','ai','tripod','decisions','quality','watchlist','cost'],
  recentDays:90,
  pendingDays:7
};
const state={
  filter:'open',
  sort:'error',
  expandedTickers:new Set(),
  expandedSleeves:new Set()
};

const qs=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qsa=(s,r=document)=>{try{return Array.from(r.querySelectorAll(s))}catch(_){return []}};
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const z=v=>n(v)==null?0:n(v);
const sym=v=>String(v||'').trim().toUpperCase().replace(/\.(KS|KQ)$/,'');
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmtPct=v=>n(v)==null?'—':(v>=0?'+':'')+(v*100).toFixed(1)+'%';
const fmtPx=(v,currency)=>{if(n(v)==null)return '—';return String(currency||'').toUpperCase()==='USD'?'$'+Number(v).toLocaleString('en-US',{maximumFractionDigits:2}):'₩'+Math.round(v).toLocaleString('ko-KR')};
const fmtMoney=(v,currency)=>{if(n(v)==null)return '—';const sign=v>=0?'+':'-';const a=Math.abs(v);return String(currency||'').toUpperCase()==='USD'?sign+'$'+a.toLocaleString('en-US',{maximumFractionDigits:2}):sign+'₩'+Math.round(a).toLocaleString('ko-KR')};

function parseTs(t){
  const raw=String(t.filled_at_kst||t.trade_date||t.date||'').trim();
  if(!raw)return 0;
  const ms=Date.parse(raw.length<=10?raw+'T00:00:00+09:00':raw);
  return Number.isFinite(ms)?ms:0;
}
function side(t){const s=String(t.side||'').toUpperCase();return s.includes('SELL')||s.includes('매도')?'SELL':s.includes('BUY')||s.includes('매수')?'BUY':'OTHER'}
function account(t){return String(t.account||t.account_type||'UNKNOWN').toUpperCase()}
function sleeve(t){
  const explicit=String(t.strategy_sleeve||t.sleeve||t.strategy||t.book||'').trim();
  if(explicit)return explicit;
  const a=account(t);
  if(a==='TRIPOD')return 'TRI-POD';
  if(a==='AI')return 'AI BOT';
  return a;
}
function labelTicker(t){return String(t.name||t.stock_name||t.ticker||t.symbol||'UNKNOWN').trim()}
function tradePx(t){return n(t.price||t.filled_price||t.avg_price)}
function qty(t){return Math.abs(z(t.qty||t.quantity||t.filled_qty))}
function currency(t){return String(t.currency||((String(t.market||'').toUpperCase()==='US')?'USD':'KRW')).toUpperCase()}
function currentPx(t){return n(t.current_price)}
function daysSince(ms){return ms?Math.floor((Date.now()-ms)/86400000):9999}
function firstNum(obj,keys){for(const k of keys){if(n(obj&&obj[k])!=null)return {value:n(obj[k]),key:k}}return null}
function feeOf(t){const x=firstNum(t,['fee','commission','fee_krw','commission_krw']);return x?x.value:null}
function taxOf(t){const x=firstNum(t,['tax','tax_krw','transaction_tax']);return x?x.value:null}

function realizedPnlInfo(t){
  let x=firstNum(t,['realized_pnl_krw','pnl_realized_krw','realized_profit_krw']);
  if(x)return {value:x.value,currency:'KRW'};
  x=firstNum(t,['realized_pnl','pnl_realized','realized_profit']);
  return x?{value:x.value,currency:currency(t)}:null;
}
function unrealPnlInfo(pos,g){
  let x=firstNum(pos,['unrealized_pnl_krw','pnl_krw','evaluation_pnl_krw']);
  if(x)return {value:x.value,currency:'KRW'};
  x=firstNum(pos,['unrealized_pnl','pnl','evaluation_pnl']);
  if(x)return {value:x.value,currency:g.currency};
  if(g.avg!=null&&g.cur!=null&&g.qOpen>0)return {value:(g.cur-g.avg)*g.qOpen,currency:g.currency};
  return null;
}

function collectTrades(){
  const out=[];
  try{if(window.D&&D.human&&Array.isArray(D.human.trades))out.push(...D.human.trades)}catch(_){}
  try{if(window.D&&D.ai&&D.ai.latest&&Array.isArray(D.ai.latest.trades))out.push(...D.ai.latest.trades.map(x=>({...x,account:x.account||'AI'})))}catch(_){}
  const seen=new Set(),dedup=[];
  out.forEach(t=>{
    const k=[account(t),parseTs(t),sym(t.ticker||t.symbol),side(t),qty(t),tradePx(t)].join('|');
    if(!seen.has(k)){seen.add(k);dedup.push(t)}
  });
  return dedup.sort((a,b)=>parseTs(a)-parseTs(b));
}

function canonicalPositionMap(){
  const m=new Map();
  try{
    const C=window.__JJOONI_CANONICAL_SSOT||{};
    Object.entries(C.accounts||{}).forEach(([acct,a])=>{
      (a.positions||[]).forEach(p=>{
        const ticker=sym(p.ticker||p.symbol);if(!ticker)return;
        const sl=String(p.strategy_sleeve||p.sleeve||'').trim()||acct;
        m.set(ticker+'|'+sl,{...p,account:acct});
        if(!m.has(ticker+'|'+acct))m.set(ticker+'|'+acct,{...p,account:acct});
      });
    });
  }catch(_){}
  return m;
}

function buildSleeves(){
  const trades=collectTrades(),posMap=canonicalPositionMap(),groups=new Map();
  const cutoff=Date.now()-CFG.recentDays*86400000;
  trades.forEach(t=>{
    if(parseTs(t)<cutoff)return;
    const ticker=sym(t.ticker||t.symbol);if(!ticker)return;
    const sl=sleeve(t),k=ticker+'|'+sl;
    if(!groups.has(k))groups.set(k,{
      key:k,ticker,name:labelTicker(t),sleeve:sl,account:account(t),trades:[],buyCount:0,sellCount:0,
      buyQty:0,sellQty:0,buyCost:0,lastTs:0,currency:currency(t),realizedParts:[]
    });
    const g=groups.get(k);g.trades.push(t);g.lastTs=Math.max(g.lastTs,parseTs(t));g.currency=currency(t)||g.currency;
    const q=qty(t),p=tradePx(t);
    if(side(t)==='BUY'){g.buyCount++;g.buyQty+=q;if(p!=null)g.buyCost+=q*p}
    if(side(t)==='SELL'){
      g.sellCount++;g.sellQty+=q;
      const rp=realizedPnlInfo(t);if(rp)g.realizedParts.push(rp);
    }
  });

  const arr=[];
  groups.forEach(g=>{
    const pos=posMap.get(g.key)||posMap.get(g.ticker+'|'+g.account)||null;
    const posQty=firstNum(pos,['qty','quantity','held_qty']);
    const qOpen=posQty?Math.abs(posQty.value):Math.max(0,g.buyQty-g.sellQty);
    const posAvg=firstNum(pos,['avg_price','avg','average_price']);
    const avg=posAvg?posAvg.value:(g.buyQty>0?g.buyCost/g.buyQty:null);
    const posCur=firstNum(pos,['current_price','price','last_price']);
    const fallbackTrade=[...g.trades].reverse().find(x=>currentPx(x)!=null);
    const cur=posCur?posCur.value:currentPx(fallbackTrade||{});
    g.qOpen=qOpen;g.avg=avg;g.cur=cur;
    const avgReturn=avg!=null&&avg>0&&cur!=null?(cur/avg)-1:null;

    const sells=g.trades.filter(t=>side(t)==='SELL'&&tradePx(t)!=null&&currentPx(t)!=null);
    let missed=null,lastSellTs=0;
    if(sells.length){
      let weighted=0,w=0;
      sells.forEach(t=>{
        const r=currentPx(t)/tradePx(t)-1,qq=Math.max(qty(t),1);
        weighted+=r*qq;w+=qq;lastSellTs=Math.max(lastSellTs,parseTs(t));
      });
      missed=w?weighted/w:null;
    }
    const pending=lastSellTs>0&&daysSince(lastSellTs)<CFG.pendingDays;
    const closed=qOpen<=0.0000001&&g.sellCount>0;

    let realized=null,realizedCurrency=null;
    if(g.realizedParts.length){
      const cs=[...new Set(g.realizedParts.map(x=>x.currency))];
      if(cs.length===1){realized=g.realizedParts.reduce((s,x)=>s+x.value,0);realizedCurrency=cs[0]}
    }
    const ui=unrealPnlInfo(pos,g),unreal=ui&&ui.value,unrealCurrency=ui&&ui.currency;
    let totalPnl=null,totalCurrency=null;
    if(realized!=null&&unreal!=null&&realizedCurrency===unrealCurrency){totalPnl=realized+unreal;totalCurrency=realizedCurrency}
    else if(realized!=null&&closed){totalPnl=realized;totalCurrency=realizedCurrency}
    else if(unreal!=null&&!closed){totalPnl=unreal;totalCurrency=unrealCurrency}

    const errorScore=Math.max(Math.abs(avgReturn||0),Math.abs(missed||0));
    arr.push({...g,pos,qOpen,avg,cur,avgReturn,missed,pending,closed,realized,realizedCurrency,unreal,unrealCurrency,totalPnl,totalCurrency,errorScore,lastSellTs});
  });
  return arr;
}

function verdict(g){
  if(g.pending)return {icon:'⋯',text:'평가 중'};
  if(g.closed){
    if(g.missed!=null)return g.missed<=0?{icon:'✓',text:'잘 팔았음'}:{icon:'✕',text:'매도 후 상승'};
    if(g.realized!=null)return g.realized>=0?{icon:'✓',text:'청산 이익'}:{icon:'✕',text:'청산 손실'};
    return {icon:'○',text:'청산 완료'};
  }
  if(g.avgReturn!=null)return g.avgReturn>=0?{icon:'✓',text:'매수 유효'}:{icon:'✕',text:'평단 아래'};
  return {icon:'○',text:'판정 대기'};
}

function buildTickers(){
  const map=new Map();
  buildSleeves().forEach(g=>{
    if(!map.has(g.ticker))map.set(g.ticker,{ticker:g.ticker,name:g.name,sleeves:[],buyCount:0,sellCount:0,lastTs:0,errorScore:0,missedScore:0});
    const t=map.get(g.ticker);t.sleeves.push(g);t.buyCount+=g.buyCount;t.sellCount+=g.sellCount;t.lastTs=Math.max(t.lastTs,g.lastTs);t.errorScore=Math.max(t.errorScore,g.errorScore);t.missedScore=Math.max(t.missedScore,Math.abs(g.missed||0));
  });
  const arr=[];
  map.forEach(t=>{
    t.open=t.sleeves.some(x=>!x.closed);
    t.closed=t.sleeves.every(x=>x.closed);
    t.worst=[...t.sleeves].sort((a,b)=>b.errorScore-a.errorScore)[0]||null;
    const known=t.sleeves.filter(x=>x.totalPnl!=null&&x.totalCurrency);
    const cs=[...new Set(known.map(x=>x.totalCurrency))];
    if(known.length===t.sleeves.length&&cs.length===1){t.totalPnl=known.reduce((s,x)=>s+x.totalPnl,0);t.totalCurrency=cs[0]}else{t.totalPnl=null;t.totalCurrency=null}
    arr.push(t);
  });
  return arr;
}

function filteredTickers(){
  let a=buildTickers().filter(t=>state.filter==='all'||(state.filter==='closed'?t.closed:t.open));
  if(state.sort==='missed')a.sort((x,y)=>y.missedScore-x.missedScore);
  else if(state.sort==='recent')a.sort((x,y)=>y.lastTs-x.lastTs);
  else a.sort((x,y)=>y.errorScore-x.errorScore);
  return a;
}

function ensureStyle(){
  if(qs('#ctTradeReviewV2Style'))return;
  const st=document.createElement('style');st.id='ctTradeReviewV2Style';st.textContent=`
@media(max-width:767px){
 .tabs{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:3px!important;height:56px!important;overflow:visible!important}
 .tabs>.tab[data-tab]{display:none!important;font-size:11px!important;min-width:0!important;width:auto!important;height:48px!important;padding:4px 3px!important}
 .tabs>.tab[data-tab="overview"]{display:flex!important;order:1}.tabs>.tab[data-tab="trades"]{display:flex!important;order:2}.tabs>.tab[data-tab="portfolio"]{display:flex!important;order:3}.tabs>.tab[data-tab="accounts"]{display:flex!important;order:4}#ctMoreTab{display:flex!important;order:5;font-size:11px!important;align-items:center;justify-content:center}
 #ctTradeReviewV2{margin:4px 0 18px}.ctTrHead{margin:4px 0 10px}.ctTrTitle{font-size:18px;font-weight:900;color:#14243a}.ctTrSub{font-size:10px;color:#7d8b9d;margin-top:2px}.ctTrToolbar{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:9px}.ctTrFilters,.ctTrSorts{display:flex;gap:5px;flex-wrap:wrap}.ctTrChip{border:1px solid #d8e1ea;background:#fff;color:#475467;border-radius:999px;padding:7px 9px;font:800 10px/1 system-ui}.ctTrChip.on{background:#0b2f5d;color:#fff;border-color:#0b2f5d}
 .ctTicker{background:#fff;border:1px solid #e5eaf0;border-radius:14px;margin-bottom:8px;overflow:hidden;box-shadow:0 6px 16px rgba(12,31,54,.04)}.ctTickerHead{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:11px;align-items:center;cursor:pointer}.ctTickerName{font-size:14px;font-weight:900;color:#101828}.ctTickerMeta{font-size:9px;color:#7d8b9d;margin-top:3px}.ctTickerRight{text-align:right}.ctTickerScore{font-size:12px;font-weight:900;color:#101828}.ctTickerVerdict{font-size:9px;color:#667085;margin-top:3px}.ctTickerBody{display:none;border-top:1px solid #edf1f5;background:#fbfcfe;padding:7px}.ctTicker.open .ctTickerBody{display:block}
 .ctSleeve{background:#fff;border:1px solid #e8edf2;border-radius:10px;margin-bottom:6px;overflow:hidden}.ctSleeve:last-child{margin-bottom:0}.ctSleeveHead{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:9px 10px;align-items:center;cursor:pointer}.ctSleeveName{font-size:11px;font-weight:900;color:#101828}.ctSleeveMeta{font-size:8px;color:#7d8b9d;margin-top:2px}.ctSleeveRight{text-align:right}.ctSleeveRet{font-size:11px;font-weight:900}.ctSleeveRet.pos{color:#d92d20}.ctSleeveRet.neg{color:#175cd3}.ctSleeveVerdict{font-size:8px;color:#667085;margin-top:2px}.ctSleeveDetail{display:none;border-top:1px solid #edf1f5;background:#fbfcfe;padding:8px 9px}.ctSleeve.open .ctSleeveDetail{display:block}
 .ctTrMetric{display:grid;grid-template-columns:1fr auto;gap:8px;padding:4px 0;font-size:9px;color:#475467}.ctTrMetric b{color:#101828}.ctTrTimeline{margin-top:7px;border-top:1px dashed #dce4ec;padding-top:6px}.ctTrEvent{padding:6px 0;border-bottom:1px solid #f0f3f6}.ctTrEvent:last-child{border-bottom:0}.ctTrEventMain{display:grid;grid-template-columns:48px 38px minmax(0,1fr) auto;gap:5px;font-size:9px;color:#475467}.ctTrEventMain b{color:#101828}.ctTrSide.buy{color:#175cd3;font-weight:900}.ctTrSide.sell{color:#d92d20;font-weight:900}.ctTrEventEval{font-size:8px;color:#667085;margin-top:3px;padding-left:91px}.ctTrEventMeta{font-size:8px;color:#98a2b3;margin-top:2px;padding-left:91px}.ctTrEmpty{background:#fff;border:1px dashed #d0d5dd;border-radius:14px;padding:18px;text-align:center;color:#667085;font-size:11px}
}
`;(document.head||document.documentElement).appendChild(st);
}

function ensureMoreMenu(){
  const tabs=qs('.tabs');if(!tabs)return null;
  let more=qs('#ctMoreTab');
  if(!more){more=document.createElement('button');more.type='button';more.id='ctMoreTab';more.textContent='더보기';more.setAttribute('aria-haspopup','menu');tabs.appendChild(more)}
  let menu=qs('#ctMoreMenu');
  if(!menu){menu=document.createElement('div');menu.id='ctMoreMenu';menu.setAttribute('role','menu');document.body.appendChild(menu)}
  more.onclick=e=>{e.stopPropagation();const open=!menu.classList.contains('open');menu.classList.toggle('open',open);more.setAttribute('aria-expanded',String(open))};
  return {more,menu};
}

function ensureNav(){
  const mm=ensureMoreMenu(),tabs=qs('.tabs');if(!tabs||!mm)return;
  qsa('.tab[data-tab]').forEach(t=>{
    const id=t.dataset.tab;t.style.removeProperty('display');t.style.removeProperty('order');
    if(window.innerWidth<=767){
      t.style.setProperty('display',CFG.primary.includes(id)?'flex':'none','important');
      if(CFG.primary.includes(id))t.style.setProperty('order',String(CFG.primary.indexOf(id)+1),'important');
    }
  });
  const {more,menu}=mm;
  if(window.innerWidth<=767){more.style.setProperty('display','flex','important');more.style.setProperty('order','5','important');more.textContent='더보기'}else{more.style.removeProperty('display');more.style.removeProperty('order')}
  if(menu.dataset.tradeReviewMenu!=='v2'){
    menu.innerHTML='';
    const labels={compare:'성과분석',ai:'AI BOT',tripod:'TRI-POD',decisions:'의사결정',quality:'데이터품질',watchlist:'시황/워치',cost:'COST'};
    CFG.secondary.forEach(id=>{
      const src=qs('.tab[data-tab="'+id+'"]');if(!src)return;
      const b=document.createElement('button');b.type='button';b.dataset.tab=id;b.textContent=labels[id]||src.textContent.trim()||id;
      b.onclick=()=>{src.click();menu.classList.remove('open');more.setAttribute('aria-expanded','false');syncMoreState()};menu.appendChild(b)
    });
    menu.dataset.tradeReviewMenu='v2';
  }
  syncMoreState();
  window.__JJOONI_MOBILE_NAV_V2={state:'ACTIVE',primary:CFG.primary.slice(),secondary:CFG.secondary.slice(),layout:'4_PLUS_MORE'};
}
function syncMoreState(){
  const more=qs('#ctMoreTab'),menu=qs('#ctMoreMenu');if(!more||!menu)return;
  const active=qs('.tab.on[data-tab]'),id=active&&active.dataset.tab||'';
  more.classList.toggle('on',CFG.secondary.includes(id));
  qsa('button[data-tab]',menu).forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
}

function evalEvent(t,g){
  const p=tradePx(t);if(p==null)return '';
  if(side(t)==='BUY'&&g.avg!=null&&g.avg>0){const r=p/g.avg-1;return '평단 대비 '+fmtPct(r)+(r>0?' · 평단 위 매수':' · 평단 아래 매수')}
  if(side(t)==='SELL'&&currentPx(t)!=null){const r=currentPx(t)/p-1;return daysSince(parseTs(t))<CFG.pendingDays?'매도 후 평가 중':'매도 후 '+fmtPct(r)+(r>0?' · 이후 상승':' · 이후 하락')}
  return '';
}
function eventMeta(t){
  const bits=[account(t)];const f=feeOf(t),tx=taxOf(t);if(f!=null)bits.push('수수료 '+fmtPx(f,currency(t)));if(tx!=null)bits.push('세금 '+fmtPx(tx,currency(t)));if(t.current_price_source)bits.push(String(t.current_price_source));return bits.join(' · ')
}

function sleeveHtml(g){
  const v=verdict(g),metric=g.closed?(g.missed!=null?g.missed:null):g.avgReturn,cls=metric==null?'':metric>=0?'pos':'neg',open=state.expandedSleeves.has(g.key);
  const timeline=[...g.trades].sort((a,b)=>parseTs(b)-parseTs(a)).map(t=>{
    const d=new Date(parseTs(t)),ds=Number.isFinite(d.getTime())?String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getDate()).padStart(2,'0'):'—',s=side(t),p=tradePx(t),q=qty(t),ev=evalEvent(t,g),meta=eventMeta(t);
    return `<div class="ctTrEvent"><div class="ctTrEventMain"><span>${ds}</span><span class="ctTrSide ${s==='BUY'?'buy':'sell'}">${s==='BUY'?'매수':s==='SELL'?'매도':'거래'}</span><b>${esc(q)}주</b><span>${fmtPx(p,currency(t))}</span></div>${ev?`<div class="ctTrEventEval">${esc(ev)}</div>`:''}${meta?`<div class="ctTrEventMeta">${esc(meta)}</div>`:''}</div>`;
  }).join('');
  const realized=g.realized!=null?fmtMoney(g.realized,g.realizedCurrency):'—',unreal=g.unreal!=null?fmtMoney(g.unreal,g.unrealCurrency):'—',total=g.totalPnl!=null?fmtMoney(g.totalPnl,g.totalCurrency):'—';
  return `<div class="ctSleeve ${open?'open':''}" data-sleeve="${esc(g.key)}"><div class="ctSleeveHead"><div><div class="ctSleeveName">${esc(g.sleeve)}</div><div class="ctSleeveMeta">${esc(g.account)} · 매수 ${g.buyCount}회 · 매도 ${g.sellCount}회 · ${g.closed?'청산 완료':'진행 중'}</div></div><div class="ctSleeveRight"><div class="ctSleeveRet ${cls}">${metric==null?'—':fmtPct(metric)}</div><div class="ctSleeveVerdict">${v.icon} ${esc(v.text)}</div></div></div><div class="ctSleeveDetail"><div class="ctTrMetric"><span>평균매수가 → 현재가</span><b>${fmtPx(g.avg,g.currency)} → ${fmtPx(g.cur,g.currency)}</b></div><div class="ctTrMetric"><span>평단 대비</span><b>${fmtPct(g.avgReturn)}</b></div><div class="ctTrMetric"><span>매도 후 등락</span><b>${g.pending?'평가 중':fmtPct(g.missed)}</b></div><div class="ctTrMetric"><span>실현손익</span><b>${realized}</b></div><div class="ctTrMetric"><span>평가손익</span><b>${unreal}</b></div><div class="ctTrMetric"><span>실현+평가</span><b>${total}</b></div><div class="ctTrTimeline">${timeline}</div></div></div>`;
}

function render(){
  const panel=qs('#panel-trades');if(!panel)return;
  if(window.innerWidth>767){restoreLegacy(panel);return}
  let root=qs('#ctTradeReviewV2',panel);
  if(!root){root=document.createElement('div');root.id='ctTradeReviewV2';panel.prepend(root)}
  qsa(':scope > *',panel).forEach(e=>{if(e!==root){e.dataset.ctTradeReviewLegacy='1';e.style.setProperty('display','none','important')}});

  const tickers=filteredTickers();
  const cards=tickers.map(t=>{
    const open=state.expandedTickers.has(t.ticker),w=t.worst,v=w?verdict(w):{icon:'○',text:'판정 대기'};
    const score=t.errorScore?fmtPct(t.errorScore):'—',pnl=t.totalPnl!=null?fmtMoney(t.totalPnl,t.totalCurrency):null;
    return `<div class="ctTicker ${open?'open':''}" data-ticker="${esc(t.ticker)}"><div class="ctTickerHead"><div><div class="ctTickerName">${esc(t.name||t.ticker)}</div><div class="ctTickerMeta">${t.sleeves.length}개 전략 · 매수 ${t.buyCount}회 · 매도 ${t.sellCount}회 · ${t.closed?'청산 완료':'진행 중'}</div></div><div class="ctTickerRight"><div class="ctTickerScore">${pnl||('최대오차 '+score)}</div><div class="ctTickerVerdict">${v.icon} ${w?esc(w.sleeve)+' · ':''}${esc(v.text)}</div></div></div><div class="ctTickerBody">${t.sleeves.sort((a,b)=>b.errorScore-a.errorScore).map(sleeveHtml).join('')}</div></div>`;
  }).join('');

  root.innerHTML=`<div class="ctTrHead"><div class="ctTrTitle">매매복기</div><div class="ctTrSub">종목 → 전략/계좌 → 체결 타임라인 · 최근 ${CFG.recentDays}일</div></div><div class="ctTrToolbar"><div class="ctTrFilters"><button class="ctTrChip ${state.filter==='open'?'on':''}" data-filter="open">진행 중</button><button class="ctTrChip ${state.filter==='closed'?'on':''}" data-filter="closed">청산 완료</button><button class="ctTrChip ${state.filter==='all'?'on':''}" data-filter="all">전체</button></div><div class="ctTrSorts"><button class="ctTrChip ${state.sort==='error'?'on':''}" data-sort="error">오차순</button><button class="ctTrChip ${state.sort==='missed'?'on':''}" data-sort="missed">놓친폭</button><button class="ctTrChip ${state.sort==='recent'?'on':''}" data-sort="recent">최근순</button></div></div>${cards||'<div class="ctTrEmpty">표시할 매매복기 데이터가 없습니다.</div>'}`;

  qsa('[data-filter]',root).forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render()});
  qsa('[data-sort]',root).forEach(b=>b.onclick=()=>{state.sort=b.dataset.sort;render()});
  qsa('.ctTickerHead',root).forEach(h=>h.onclick=()=>{const k=h.parentElement.dataset.ticker;if(state.expandedTickers.has(k))state.expandedTickers.delete(k);else state.expandedTickers.add(k);render()});
  qsa('.ctSleeveHead',root).forEach(h=>h.onclick=e=>{e.stopPropagation();const k=h.parentElement.dataset.sleeve;if(state.expandedSleeves.has(k))state.expandedSleeves.delete(k);else state.expandedSleeves.add(k);render()});
  window.__JJOONI_TRADE_REVIEW_V2={state:'ACTIVE',grouping:'ticker>ticker+sleeve>fills',filter:state.filter,sort:state.sort,tickers:tickers.length,sleeves:tickers.reduce((s,t)=>s+t.sleeves.length,0),pending_days:CFG.pendingDays,recent_days:CFG.recentDays};
}

function restoreLegacy(panel){
  const root=qs('#ctTradeReviewV2',panel);if(root)root.remove();
  qsa('[data-ct-trade-review-legacy="1"]',panel).forEach(e=>{e.style.removeProperty('display');delete e.dataset.ctTradeReviewLegacy});
}

function run(){ensureStyle();ensureNav();syncMoreState();const p=qs('#panel-trades');if(p)render()}
setTimeout(run,0);setTimeout(run,800);setTimeout(run,2200);
setInterval(()=>{if(!document.hidden)run()},2000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)run()});
window.addEventListener('resize',run,{passive:true});
})();
