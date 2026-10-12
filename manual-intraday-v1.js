(function(root){
'use strict';
const API='https://jjooni-ct-fast-apgynr7pea-du.a.run.app';
const IDS=['TOSS','ISA','PENSION','IRP','TRIPOD'];
const S={version:'1.4',automatic_collection:false,busy:false,charts:new Map(),history:[],selected:'',date:'',message:'',accountDate:'',accountBusy:false,hydratedDate:null,hydrating:false,cacheFailures:new Set()};
const num=v=>v==null||v===''||typeof v==='boolean'?null:Number.isFinite(Number(v))?Number(v):null;
function symbol(v){return String(v||'').trim().toUpperCase().replace(/\.(KS|KQ)$/,'')}
function marketGroup(code){return /^[0-9][A-Z0-9]{5}$/.test(symbol(code))?'KR':'US'}
const SESSION_STYLE={PRE:{label:'프리 / 장전',color:'#fff0d5'},REGULAR:{label:'정규장',color:'#e8f3ff'},AFTER:{label:'애프터 / 장후',color:'#f0e8ff'},OTHER:{label:'기타 시간',color:'#f2f4f7'}};
const clockFormats=new Map(),bandCache=new Map();
function sessionKind(timestamp,zone){let format=clockFormats.get(zone);if(!format){format=new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});clockFormats.set(zone,format)}const parts=format.formatToParts(new Date(timestamp));const minutes=Number(parts.find(p=>p.type==='hour').value)*60+Number(parts.find(p=>p.type==='minute').value);const us=zone==='America/New_York',open=us?570:540,close=us?960:930,pre=us?240:480;if(minutes<pre||minutes>1200)return 'OTHER';if(minutes<open)return 'PRE';if(minutes<close)return 'REGULAR';return 'AFTER'}
function sessionBands(start,end,zone){if(!(end>start))return [];const cacheKey=[start,end,zone].join('|');if(bandCache.has(cacheKey))return bandCache.get(cacheKey);const bands=[];let from=start,kind=sessionKind(start,zone);for(let at=Math.floor(start/60000)*60000+60000;at<end;at+=60000){const next=sessionKind(at,zone);if(next!==kind){bands.push({start:from,end:at,kind});from=at;kind=next}}bands.push({start:from,end,kind});if(bandCache.size>128)bandCache.delete(bandCache.keys().next().value);bandCache.set(cacheKey,bands);return bands}
function positions(c){const out=new Map();for(const id of IDS)for(const p of c?.accounts?.[id]?.positions||[]){const code=symbol(p.ticker||p.symbol);if(!/^[A-Z0-9][A-Z0-9.\-]{0,23}$/.test(code)||String(p.record_type||'POSITION').toUpperCase()!=='POSITION'||!(num(p.qty??p.quantity)>0))continue;const prev=out.get(code)||{symbol:code,name:p.name||p.stock_name||p.security_name||code,accounts:[],market:marketGroup(code)};prev.accounts.push(id);out.set(code,prev)}return [...out.values()]}
function merge(old,rows){return [...new Map([...(old||[]),...(rows||[])].map(r=>[r.timestamp,r])).values()].sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp))}
function needsHistory(chart){return !chart||chart.status!=='EMPTY_SESSION'&&(!chart.candles?.length||chart.backfill_complete!==true)}
if(typeof module==='object'&&module.exports){module.exports={positions,merge,num,needsHistory,marketGroup,sessionKind,sessionBands};return}
if(!root.document)return;
root.__JJOONI_MANUAL_INTRADAY=S;
let largeDialog=null,largeSymbol='',priorOverflow='';
let panel,cacheBusy=false,lastIdentity='',pendingSelection=false;
const canon=()=>root.__JJOONI_CANONICAL_SSOT||{};
function time(v,zone='Asia/Seoul'){try{return new Intl.DateTimeFormat('ko-KR',{timeZone:zone,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch(_){return '—'}}
function kstToday(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-')}
function money(v){return num(v)==null?'—':new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(v)}
async function request(path,body){const pw=sessionStorage.getItem('jjooni_ct_session_pw');if(!pw)throw Error('로그인이 필요합니다');const epoch=Math.floor(Date.now()/30000);const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('ct-fast:'+epoch)));const proof=[...sig].map(v=>v.toString(16).padStart(2,'0')).join('');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);try{const r=await fetch(API+path,{method:'POST',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json','X-CT-Epoch':String(epoch),'X-CT-Proof':proof},body:JSON.stringify(body)});const out=await r.json();if(!r.ok)throw Error(out.error==='ACCOUNT_SOURCE_STALE'?'계좌 원본이 오래되어 기록하지 않았습니다':out.error||('조회 실패 ('+r.status+')'));return out}finally{clearTimeout(timer)}}
function el(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e}
function mount(){if(panel?.isConnected)return true;const host=document.getElementById('panel-portfolio')||document.getElementById('portfolio')||document.getElementById('tab-portfolio')||document.querySelector('[data-panel="portfolio"]')||document.querySelector('#panel-overview');if(!host)return false;panel=el('section',null,'ctManualChart');panel.id='ctManualIntraday';const style=el('style');style.id='ctManualIntradayStyle';style.textContent='.ctManualChart{background:#fff;color:#142b45;border:1px solid #dce5ef;border-radius:16px;padding:18px;margin:12px 0;min-width:0}.ctManualChart .mcHead,.ctManualChart .mcControls{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.ctManualChart h3{margin:0;font-size:18px}.ctManualChart button{padding:10px 14px;border:0;border-radius:9px;background:#1459a6;color:white;cursor:pointer;font-weight:700}.ctManualChart button:disabled{opacity:.5;cursor:wait}.ctManualChart select,.ctManualChart input{padding:9px;border:1px solid #c9d7e6;border-radius:8px;background:white;color:#142b45;max-width:100%;min-width:0}.ctManualChart small,.ctManualChart .mcNote{color:#526779;font-size:12px;line-height:1.6}.ctManualChart canvas{width:100%;height:250px;display:block;touch-action:pan-y;cursor:crosshair}.ctManualChart .mcPlot{position:relative;min-width:0}.ctManualChart .mcTooltip{position:absolute;z-index:4;pointer-events:none;max-width:calc(100% - 12px);padding:8px 10px;border-radius:9px;background:#102c49;color:#fff;font-size:12px;line-height:1.5;box-shadow:0 3px 12px #102c4933;white-space:pre-line}.ctManualChart .mcTooltip[hidden]{display:none}.ctManualChart .mcCards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:12px 0}.ctManualChart .mcMarketTitle{display:flex;gap:8px;align-items:center;margin:20px 0 10px;font-size:17px;font-weight:800}.ctManualChart .mcLegend{display:flex;gap:12px;flex-wrap:wrap;margin:10px 0;font-size:12px;color:#40566f}.ctManualChart .mcLegend span{display:inline-flex;align-items:center;gap:5px}.ctManualChart .mcLegend i{display:inline-block;width:16px;height:12px;border:1px solid #c4cfdb;border-radius:3px}.ctManualChart .mcCard{padding:13px!important;min-height:145px;cursor:pointer}.ctManualChart .mcCard:focus-visible{outline:3px solid #3983d7;outline-offset:2px}.ctManualChart .mcCard:hover{border-color:#7da9d6;box-shadow:0 3px 12px #1459a612}.ctManualChart .mcCard>.mcName{font-size:15px;line-height:1.45;font-weight:800;min-height:43px;overflow-wrap:anywhere}.ctManualChart .mcName{display:block;color:#142b45}.mcLargeDialog{box-sizing:border-box!important;width:min(94vw,1400px)!important;max-width:94vw!important;max-height:92vh;max-height:92dvh;overflow:auto;margin:auto!important;padding:22px!important;border:1px solid #c7d5e5;border-radius:18px;box-shadow:0 20px 90px #07142666}.mcLargeDialog::backdrop{background:rgba(5,20,40,.68)}.mcLargeDialog .mcLargeHeader{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:12px}.mcLargeDialog .mcLargeHeader h3{font-size:22px;line-height:1.4}.mcLargeDialog canvas{height:clamp(280px,55vh,600px)!important;height:clamp(280px,55dvh,600px)!important}.mcLargeDialog .mcLargeMessage{margin:8px 0;font-size:14px;line-height:1.6}.mcLargeDialog .mcLargeControls{display:flex;gap:8px;flex-wrap:wrap}.mcLargeDialog .mcRangeActive{background:#103c69!important}.mcLargeDialog .mcTooltip{font-size:14px!important}@media(max-width:599px){.mcLargeDialog{box-sizing:border-box!important;width:96vw!important;max-width:96vw!important;padding:12px!important}.mcLargeDialog .mcLargeHeader h3{font-size:18px}.mcLargeDialog canvas{height:44dvh!important;min-height:240px}}.ctManualChart .mcCard>.mcNote{font-size:13px;margin:5px 0}.ctManualChart .mcCard canvas{height:80px!important}@media(min-width:1080px){.ctManualChart .mcCards{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(min-width:1400px){.ctManualChart .mcCards{grid-template-columns:repeat(5,minmax(0,1fr))}}@media(max-width:599px){.ctManualChart .mcCards{grid-template-columns:repeat(2,minmax(0,1fr))}}.ctManualChart .mcCard{border:1px solid #e3eaf1;border-radius:10px;padding:9px;min-width:0}.ctManualChart .mcCard canvas{height:60px}.ctManualChart .mcAccountTable{overflow:auto}.ctManualChart table{font-size:12px;width:100%;border-collapse:collapse;white-space:nowrap}.ctManualChart td,.ctManualChart th{text-align:right;padding:7px;border-bottom:1px solid #e8eef5}.ctManualChart td:first-child,.ctManualChart th:first-child{text-align:left}';if(!document.getElementById(style.id))document.head.appendChild(style);host.prepend(panel);render();return true}
function draw(canvas,rows,key,zone,pointsOnly=false){const width=Math.max(1,canvas.getBoundingClientRect().width||300),height=Number(canvas.dataset.height||250),dpr=Math.min(2,devicePixelRatio||1);canvas.width=width*dpr;canvas.height=height*dpr;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.scale(dpr,dpr);const vals=rows.map(r=>({x:Date.parse(r.timestamp),y:num(r[key])})).filter(r=>Number.isFinite(r.x)&&r.y!=null);ctx.font='12px system-ui';ctx.fillStyle='#526779';if(!vals.length){ctx.fillText(canvas.dataset.emptyMessage||'아직 저장된 데이터가 없습니다.',12,30);return}const mini=height<100,pad=mini?5:45,w=width-pad*2,h=height-pad*2;let lo=Math.min(...vals.map(r=>r.y)),hi=Math.max(...vals.map(r=>r.y));if(hi===lo){lo-=Math.max(1,Math.abs(lo)*.001);hi+=Math.max(1,Math.abs(hi)*.001)}const start=vals[0].x,end=vals[vals.length-1].x||start;const x=r=>pad+(end===start?0.5:(r.x-start)/(end-start))*w,y=r=>pad+h-(r.y-lo)/(hi-lo)*h;if(!pointsOnly){const bands=sessionBands(start,end,zone);canvas.dataset.sessionBands=JSON.stringify(bands);for(const band of bands){const left=x({x:band.start}),right=x({x:band.end});ctx.fillStyle=SESSION_STYLE[band.kind].color;ctx.fillRect(left,pad,Math.max(1,right-left),h);if(!mini&&right-left>55){ctx.fillStyle='#53657a';ctx.fillText(SESSION_STYLE[band.kind].label,left+5,pad+13)}}}if(!mini){ctx.strokeStyle='#e4ecf4';for(let j=0;j<4;j++){const yy=pad+j*h/3;ctx.beginPath();ctx.moveTo(pad,yy);ctx.lineTo(width-pad,yy);ctx.stroke();ctx.fillText(money(hi-j*(hi-lo)/3),3,yy-4)}ctx.fillText(time(vals[0].x,zone),pad,height-8);ctx.fillText(time(vals[vals.length-1].x,zone),Math.max(pad,width-140),height-8)}ctx.strokeStyle='#176dc0';ctx.lineWidth=mini?1.5:2;if(!pointsOnly){ctx.beginPath();vals.forEach((r,i)=>{if(!i||r.x-vals[i-1].x>120000)ctx.moveTo(x(r),y(r));else ctx.lineTo(x(r),y(r))});ctx.stroke()}ctx.fillStyle='#176dc0';for(let i=0;i<vals.length;i++){const r=vals[i],isolated=(i===0||r.x-vals[i-1].x>120000)&&(i===vals.length-1||vals[i+1].x-r.x>120000);if(!pointsOnly&&vals.length>1&&!isolated)continue;ctx.beginPath();ctx.arc(x(r),y(r),pointsOnly?3:2,0,Math.PI*2);ctx.fill()}const base=document.createElement('canvas');base.width=canvas.width;base.height=canvas.height;base.getContext('2d').drawImage(canvas,0,0);
 let wrapper=canvas.parentElement;
 if(!wrapper?.classList.contains('mcPlot')){wrapper=el('div',null,'mcPlot');canvas.replaceWith(wrapper);wrapper.append(canvas)}
 let tooltip=wrapper.querySelector('.mcTooltip');if(!tooltip){tooltip=el('div',null,'mcTooltip');tooltip.setAttribute('role','status');tooltip.setAttribute('aria-live','polite');tooltip.hidden=true;wrapper.append(tooltip)}
 canvas.removeAttribute('title');canvas.tabIndex=0;let index=-1;
 const restore=()=>{ctx.clearRect(0,0,width,height);ctx.drawImage(base,0,0,width,height)};
 const show=i=>{
  index=Math.max(0,Math.min(vals.length-1,i));const point=vals[index],xx=x(point),yy=y(point);restore();
  ctx.save();ctx.strokeStyle='#7492b0';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(xx,pad);ctx.lineTo(xx,height-pad);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#176dc0';ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(xx,yy,4,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
  const original=rows.find(r=>Date.parse(r.timestamp)===point.x)||{};
  const unit=pointsOnly?'원':original.currency==='USD'?'USD':original.currency==='KRW'?'원':original.currency||'';
  const full=new Intl.DateTimeFormat('ko-KR',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(point.x));
  tooltip.textContent=full+' · '+(zone==='America/New_York'?'미국 동부':'한국')+(pointsOnly?'':' · '+SESSION_STYLE[sessionKind(point.x,zone)].label)+'\n'+(pointsOnly?'자산 ':'가격 ')+money(point.y)+(unit?' '+unit:'');tooltip.hidden=false;
  tooltip.style.left=Math.max(6,Math.min(width-tooltip.offsetWidth-6,xx-tooltip.offsetWidth/2))+'px';
  tooltip.style.top=Math.max(4,Math.min(height-tooltip.offsetHeight-4,yy-tooltip.offsetHeight-15))+'px';
  canvas.dataset.selectedTimestamp=original.timestamp||new Date(point.x).toISOString();canvas.dataset.selectedValue=String(point.y);
 };
 const inspect=event=>{const rect=canvas.getBoundingClientRect(),px=(event.clientX-rect.left)*width/rect.width;const ratio=Math.max(0,Math.min(1,(px-pad)/w)),target=start+ratio*(end-start);let nearest=0;for(let i=1;i<vals.length;i++)if(Math.abs(vals[i].x-target)<Math.abs(vals[nearest].x-target))nearest=i;show(nearest)};
 canvas.onpointermove=inspect;
 canvas.onpointerdown=event=>{if(event.pointerType!=='mouse')try{canvas.setPointerCapture(event.pointerId)}catch(_){}inspect(event)};
 canvas.onpointerleave=event=>{if(event.pointerType==='mouse'){tooltip.hidden=true;restore()}};
 canvas.onpointercancel=()=>{tooltip.hidden=true;restore()};
 canvas.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Escape'].includes(event.key))return;event.preventDefault();if(event.key==='Escape'){tooltip.hidden=true;restore();return}show(index<0?0:index+(event.key==='ArrowLeft'?-1:1))};
}

function render(){if(!panel)return;panel.replaceChildren();const head=el('div',null,'mcHead');head.append(el('h3','보유종목 일중 그래프'),el('small','선택 시 필요한 데이터 조회 · 상시 수집 없음'));panel.append(head);const controls=el('div',null,'mcControls');controls.style.margin='12px 0';const ps=positions(canon());if(!ps.some(p=>p.symbol===S.selected))S.selected=ps[0]?.symbol||'';const select=el('select');select.setAttribute('aria-label','보유종목 선택');for(const p of ps){const o=el('option',p.name+' · '+p.symbol);o.value=p.symbol;select.append(o)}select.value=S.selected;select.disabled=S.busy;select.onchange=()=>{S.selected=select.value;render();readCache({fill:true})};const date=el('input');date.type='date';date.setAttribute('aria-label','종목 거래일');date.value=S.date;date.title='거래일 선택 (비우면 API의 최근 실제 거래일 기준)';date.disabled=S.busy;date.onchange=()=>{S.date=date.value;S.charts.clear();S.hydratedDate=null;render();readCache({fill:true})};const clear=el('button','최근 거래일');clear.disabled=S.busy;clear.onclick=()=>{S.date='';S.charts.clear();S.hydratedDate=null;render();readCache({fill:true})};const one=el('button',S.busy?'업데이트 중…':'선택 종목 업데이트');one.disabled=S.busy||!S.selected;one.onclick=()=>update([S.selected]);const all=el('button','보유종목 전체 업데이트');all.disabled=S.busy||!ps.length;all.onclick=()=>update(ps.map(p=>p.symbol));const enlarge=el('button','큰 그래프 보기');enlarge.disabled=!S.selected;enlarge.onclick=()=>openLargeChart(S.selected);controls.append(select,date,clear,one,all,enlarge);panel.append(controls);const data=S.charts.get(S.selected);panel.append(el('div',data?.candles?.length?'거래일 '+data.session_date+' · '+(data.market_timezone==='America/New_York'?'미국 동부시각':'한국시각')+' · '+(data.candles.at(-1)?.currency||'')+' · 마지막 봉 '+time(data.last_bar_at,data.market_timezone)+' · 수집 '+time(data.updated_at)+(data.backfill_complete?'':' · 일부 구간 수집 중'):'선택한 종목의 최근 실제 거래일 데이터를 불러옵니다.','mcNote'));panel.append(el('div',S.message,'mcNote'));const legend=el('div',null,'mcLegend');for(const kind of ['PRE','REGULAR','AFTER']){const item=el('span'),swatch=el('i');swatch.style.background=SESSION_STYLE[kind].color;item.append(swatch,el('span',SESSION_STYLE[kind].label));legend.append(item)}panel.append(legend);const canvas=el('canvas');canvas.setAttribute('aria-label','선택 종목의 일중 가격 그래프');panel.append(canvas);requestAnimationFrame(()=>draw(canvas,data?.candles||[],'close',data?.market_timezone||'Asia/Seoul'));for(const market of ['KR','US']){
 const items=ps.filter(p=>p.market===market);if(!items.length)continue;
 const title=el('h4',(market==='KR'?'국내 보유종목':'해외 보유종목')+' · '+items.length+'개','mcMarketTitle');panel.append(title);
 const cards=el('div',null,'mcCards');cards.dataset.market=market;
 for(const p of items){
 const box=el('div',null,'mcCard');box.dataset.symbol=p.symbol;box.tabIndex=0;box.setAttribute('role','button');box.setAttribute('aria-label',p.name+' 큰 그래프 보기');
 let startPoint=null,moved=false;box.addEventListener('pointerdown',e=>{startPoint={x:e.clientX,y:e.clientY};moved=false});box.addEventListener('pointermove',e=>{if(startPoint&&Math.hypot(e.clientX-startPoint.x,e.clientY-startPoint.y)>8)moved=true});
 box.onclick=e=>{if(!moved||e.detail===0)openLargeChart(p.symbol);moved=false;startPoint=null};box.onkeydown=e=>{if(e.target===box&&['Enter',' '].includes(e.key)){e.preventDefault();openLargeChart(p.symbol)}};
 const d=S.charts.get(p.symbol);box.append(el('strong',p.name,'mcName'),el('div',d?.candles?.length?money(d.candles.at(-1).close)+' '+(d.candles.at(-1).currency||''):(S.cacheFailures.has(p.symbol)?'저장 데이터 조회 실패 · 선택해 재시도':S.hydratedDate===S.date?'저장 데이터 없음 · 선택해 조회':'서버 저장 데이터 확인 중…'),'mcNote'));
 if(d?.candles?.length){const c=el('canvas');c.dataset.height='80';box.append(c);requestAnimationFrame(()=>draw(c,d.candles,'close',d.market_timezone))}
 box.append(el('small','눌러서 크게 보기'));cards.append(box)
}panel.append(cards)
}
panel.append(el('p','배경색은 국내 KRX 정규장(한국시각 09:00~15:30), 미국 정규장(동부시각 09:30~16:00)을 기준으로 구분합니다. 실제 장전·장후 거래는 API가 제공한 구간만 표시합니다. 가격 차트는 API가 반환한 1분봉을 표시합니다. 누락된 시간대는 선을 연결하지 않습니다. 프리·애프터장 포함 여부는 원천 제공 범위에 따릅니다.','mcNote'));renderAccounts();if(largeDialog?.open)renderLargeChart();}
function openLargeChart(code){
 if(!code)return;S.selected=code;largeSymbol=code;render();
 if(!largeDialog){largeDialog=el('dialog',null,'ctManualChart mcLargeDialog');largeDialog.id='ctLargeIntraday';largeDialog.setAttribute('aria-labelledby','ctLargeIntradayTitle');document.body.append(largeDialog);
  largeDialog.addEventListener('close',()=>{document.documentElement.style.overflow=priorOverflow;const button=panel?.querySelector('.mcCard[data-symbol="'+CSS.escape(largeSymbol)+'"]');button?.focus({preventScroll:true})});
  largeDialog.addEventListener('click',e=>{if(e.target===largeDialog){const r=largeDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)largeDialog.close()}});
 }
 largeDialog.dataset.range='ALL';if(!largeDialog.open){priorOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';largeDialog.showModal()}
 renderLargeChart();readCache({fill:true});
}
function renderLargeChart(){
 if(!largeDialog?.open)return;const code=largeSymbol,p=positions(canon()).find(p=>p.symbol===code),data=S.charts.get(code),range=largeDialog.dataset.range||'ALL';largeDialog.replaceChildren();
 const header=el('div',null,'mcLargeHeader'),title=el('h3',(p?.name||code)+' · '+code);title.id='ctLargeIntradayTitle';const close=el('button','닫기');close.setAttribute('aria-label','큰 그래프 닫기');close.onclick=()=>largeDialog.close();header.append(title,close);largeDialog.append(header);
 const info=data?.candles?.length?'거래일 '+data.session_date+' · '+(data.market_timezone==='America/New_York'?'미국 동부시각':'한국시각')+' · 마지막 가격 '+money(data.candles.at(-1).close)+' '+(data.candles.at(-1).currency||''):'저장 데이터를 확인하고 필요한 분봉을 조회 중입니다.';
 largeDialog.append(el('p',info,'mcLargeMessage'));
 const controls=el('div',null,'mcLargeControls');for(const [value,label] of [['ALL','전체 거래일'],['REGULAR','정규장 확대'],['120','최근 2시간']]){const button=el('button',label,range===value?'mcRangeActive':'');button.setAttribute('aria-pressed',String(range===value));button.onclick=()=>{largeDialog.dataset.range=value;renderLargeChart()};controls.append(button)}
 const refresh=el('button',S.busy?'조회 중…':'이 종목 업데이트');refresh.disabled=S.busy;refresh.onclick=()=>update([code]);controls.append(refresh);largeDialog.append(controls);
 const legend=el('div',null,'mcLegend');for(const kind of ['PRE','REGULAR','AFTER']){const item=el('span'),swatch=el('i');swatch.style.background=SESSION_STYLE[kind].color;item.append(swatch,el('span',SESSION_STYLE[kind].label));legend.append(item)}largeDialog.append(legend);
 let rows=data?.candles||[],zone=data?.market_timezone||'Asia/Seoul';if(range==='REGULAR')rows=rows.filter(r=>sessionKind(r.timestamp,zone)==='REGULAR');else if(range==='120'&&rows.length){const since=Date.parse(rows.at(-1).timestamp)-120*60000;rows=rows.filter(r=>Date.parse(r.timestamp)>=since)}
 const canvas=el('canvas');canvas.setAttribute('aria-label','확대한 종목 가격 그래프');canvas.dataset.emptyMessage='선택 구간에 표시할 데이터가 없습니다.';largeDialog.append(canvas);
 largeDialog.append(el('p','마우스를 올리거나 손가락으로 좌우 이동하면 시간과 가격이 표시됩니다. 확대 구간 변경은 저장 데이터만 사용합니다.','mcNote'));
 requestAnimationFrame(()=>{if(canvas.isConnected){canvas.dataset.height=String(Math.max(240,canvas.getBoundingClientRect().height||400));draw(canvas,rows,'close',zone)}});
}
function renderAccounts(){
 panel.append(el('h3','계좌 자산 관측 기록'));
 const c=el('div',null,'mcControls'),account=el('select');account.setAttribute('aria-label','계좌 관측 기록 선택');
 for(const id of ['TOTAL',...IDS]){const o=el('option',id==='TOTAL'?'전체 자산':id);o.value=id;account.append(o)}
 const date=el('input');date.type='date';date.value=S.accountDate||kstToday();date.max=kstToday();date.setAttribute('aria-label','계좌 기록 날짜 (한국시각)');date.onchange=()=>{S.accountDate=date.value;S.history=[];render();loadAccountHistory()};
 const sync=el('button','종목 날짜와 맞춤');sync.onclick=()=>{S.accountDate=S.date||S.charts.get(S.selected)?.session_date||kstToday();S.history=[];render();loadAccountHistory()};
 const today=el('button','오늘');today.onclick=()=>{S.accountDate=kstToday();S.history=[];render();loadAccountHistory()};
 const button=el('button','현재 계좌 원본 기록');button.disabled=S.busy||S.accountBusy||(S.accountDate&&S.accountDate!==kstToday());button.onclick=()=>recordAccounts();
 c.append(account,date,sync,today,button);panel.append(c);
 panel.append(el('p','조회 날짜 '+(S.accountDate||kstToday())+' · 한국시각(KST) 기준 · 실제 저장된 관측 '+S.history.length+'건. 종목 거래일과 별도로 선택합니다. 기록 사이의 자산·손익은 추정하지 않습니다.','mcNote'));
 if(!S.history.length){panel.append(el('p',S.accountBusy?'해당 날짜의 저장 기록을 조회 중입니다.':'이 날짜에는 저장된 계좌 관측 기록이 없습니다. 현재 계좌 원본 기록은 오늘 날짜에서만 가능합니다.','mcNote'));return}
 const canvas=el('canvas');canvas.setAttribute('aria-label','계좌 자산 관측 그래프');panel.append(canvas);
 const paint=()=>draw(canvas,S.history.map(p=>({timestamp:account.value==='TOTAL'?p.source_as_of:(p.accounts?.[account.value]?.source_as_of||p.source_as_of),nav:account.value==='TOTAL'?(IDS.every(id=>num(p.accounts?.[id]?.nav)!=null)?IDS.reduce((n,id)=>n+Number(p.accounts[id].nav),0):null):p.accounts?.[account.value]?.nav})),'nav','Asia/Seoul',true);account.onchange=paint;requestAnimationFrame(paint);
 const wrap=el('div',null,'mcAccountTable'),table=el('table'),thead=el('tr');['원본 기준시각','계좌','자산(원)','당일손익(원)','순입출금(원)'].forEach(x=>thead.append(el('th',x)));table.append(thead);
 for(const p of S.history.slice(-8).reverse())for(const id of IDS){const a=p.accounts?.[id]||{},row=el('tr');[time(a.source_as_of||p.source_as_of),id,money(a.nav),money(a.today_pnl),money(a.net_flow)].forEach(x=>row.append(el('td',x)));table.append(row)}wrap.append(table);panel.append(wrap);
}
async function loadAccountHistory(){const date=S.accountDate||kstToday();S.accountBusy=true;render();try{const out=await request('/charts/observe',{date});if(date===(S.accountDate||kstToday()))S.history=out.history?.points||[]}catch(e){S.message='계좌 기록 조회: '+e.message}finally{S.accountBusy=false;render()}}
async function hydrateSavedCharts(){
 if(S.hydrating||S.hydratedDate===S.date)return;
 S.hydrating=true;const date=S.date,queue=positions(canon()).map(p=>p.symbol).filter(code=>code!==S.selected);let changed=false;
 const worker=async()=>{while(queue.length){const code=queue.shift();try{const out=await request('/charts/read',{symbol:code,date:date||null});S.cacheFailures.delete(code);if(date===S.date&&out.chart?.schema==='CT_MANUAL_INTRADAY_V1'){const prev=S.charts.get(code);if(!prev||Date.parse(out.chart.updated_at)>=Date.parse(prev.updated_at)){S.charts.set(code,out.chart);changed=true}}}catch(_){if(date===S.date)S.cacheFailures.add(code)}}};
 await Promise.all([worker(),worker(),worker()]);
 S.hydrating=false;if(date===S.date){S.hydratedDate=date;if(changed||!S.busy)render()}else hydrateSavedCharts();
}

async function readCache({fill=false}={}){
 if(cacheBusy){pendingSelection=pendingSelection||fill;return}
 if(S.busy)return;
 cacheBusy=true;const selected=S.selected,date=S.date;let failed=false;
 try{
  if(selected){
   const out=await request('/charts/read',{symbol:selected,date:date||null});
   if(date===S.date&&out.chart?.schema==='CT_MANUAL_INTRADAY_V1'){
    const prev=S.charts.get(selected);
    if(!prev||Date.parse(out.chart.updated_at)>=Date.parse(prev.updated_at))S.charts.set(selected,out.chart);
   }
  }
  render();
  const accountDate=S.accountDate||kstToday();const h=await request('/charts/observe',{date:accountDate});if(accountDate===(S.accountDate||kstToday()))S.history=h.history?.points||[];
  S.message='저장된 데이터 표시';render();
 }catch(e){failed=true;S.message='캐시 조회: '+e.message;render()}
 finally{cacheBusy=false}
 if(pendingSelection||selected!==S.selected||date!==S.date){pendingSelection=false;return readCache({fill:true})}
 hydrateSavedCharts();
 if(fill&&!failed&&selected&&needsHistory(S.charts.get(selected))){
  S.message='최근 실제 거래일의 분봉을 가져오는 중…';render();
  await update([selected]);
 }
}

async function update(symbols){if(S.busy)return;S.busy=true;let passed=0,partial=0;const failed=[];render();try{for(const code of [...new Set(symbols)]){S.message=(passed+failed.length+partial+1)+'/'+symbols.length+' · '+code+' 업데이트 중';render();try{const out=await request('/charts/update',{symbol:code,date:S.date||null});if(out.chart){S.charts.set(code,out.chart);if(out.chart.status==='PARTIAL')partial++;else passed++}}catch(e){failed.push(code+' ('+e.message+')')}}S.message='완료 '+passed+' · 부분 수집 '+partial+' · 실패 '+failed.length+(failed.length?' · '+failed.join(', '):'')+(partial?' · 다시 누르면 남은 구간을 이어서 수집합니다.':'')}finally{S.busy=false;render()}}
async function recordAccounts(){if(S.busy)return;S.busy=true;render();try{const out=await request('/charts/observe',{record:true,date:S.accountDate||kstToday()});S.history=out.history?.points||[];S.message='계좌 원본 기준시각을 기록했습니다.'}catch(e){S.message=e.message}finally{S.busy=false;render()}}
function boot(){if(!root.__JJOONI_LIVE_READY||!mount())return;const identity=positions(canon()).map(p=>p.symbol).join(',');if(identity!==lastIdentity){lastIdentity=identity;S.hydratedDate=null;render();if(S.started)hydrateSavedCharts()}if(!S.started){S.started=true;readCache({fill:panel.getClientRects().length>0})}}
document.addEventListener('jjooni:live-applied',boot);document.addEventListener('click',e=>{if(e.target.closest?.('.tab[data-tab="portfolio"]'))setTimeout(()=>{boot();render();readCache({fill:true})},80)});boot();
root.addEventListener('resize',()=>{if(panel?.isConnected)render()},{passive:true});
})(typeof window==='object'?window:globalThis);
