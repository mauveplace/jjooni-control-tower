(()=>{
'use strict';
const SCHEMA='JJOONI_MORNING_BRIEF_V1', ROOT='./data/morning-brief/', LATEST=ROOT+'latest.json', HISTORY=ROOT+'index.json';
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const safeURL=u=>{try{const x=new URL(u);return ['http:','https:'].includes(x.protocol)?x.href:null}catch{return null}};
function inline(text){
 const links=[];let s=String(text).replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,(_,t,u)=>{const href=safeURL(u);if(!href)return t;const n=links.length;links.push(`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(t)}</a>`);return '\u0000LINK'+n+'\u0000'});
 s=esc(s).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`\n]+)`/g,'<code>$1</code>');
 return s.replace(/\u0000LINK(\d+)\u0000/g,(_,n)=>links[Number(n)]||'');
}
function markdown(body){
 const lines=String(body||'').replace(/\r/g,'').split('\n'),out=[];let i=0,n=0;
 const row=s=>s.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(x=>x.trim());
 const isSep=s=>/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(s||'');
 while(i<lines.length){let l=lines[i];if(!l.trim()){i++;continue}
  if(/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(l)){out.push('<hr>');i++;continue}
  const h=l.match(/^(#{1,4})\s+(.+)$/);if(h){n++;out.push(`<h${h[1].length} id="brief-section-${n}">${inline(h[2])}</h${h[1].length}>`);i++;continue}
  if(l.includes('|')&&isSep(lines[i+1])){const head=row(l);i+=2;const rows=[];while(i<lines.length&&lines[i].trim()&&lines[i].includes('|')){rows.push(row(lines[i]));i++}out.push('<div class="briefTableWrap"><table><thead><tr>'+head.map(x=>'<th>'+inline(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+head.map((_,j)=>'<td>'+inline(r[j]||'')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>');continue}
  if(/^\s*>/.test(l)){const a=[];while(i<lines.length&&/^\s*>/.test(lines[i]))a.push(lines[i++].replace(/^\s*>\s?/,''));out.push('<blockquote>'+a.map(inline).join('<br>')+'</blockquote>');continue}
  if(/^\s*[-*]\s+/.test(l)){const a=[];while(i<lines.length&&/^\s*[-*]\s+/.test(lines[i]))a.push(lines[i++].replace(/^\s*[-*]\s+/,''));out.push('<ul>'+a.map(x=>'<li>'+inline(x)+'</li>').join('')+'</ul>');continue}
  if(/^\s*\d+\.\s+/.test(l)){const a=[];while(i<lines.length&&/^\s*\d+\.\s+/.test(lines[i]))a.push(lines[i++].replace(/^\s*\d+\.\s+/,''));out.push('<ol>'+a.map(x=>'<li>'+inline(x)+'</li>').join('')+'</ol>');continue}
  const a=[l];i++;while(i<lines.length&&lines[i].trim()&&!/^(#{1,4}\s|\s*>|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])&&!(lines[i].includes('|')&&isSep(lines[i+1]))&&!/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(lines[i]))a.push(lines[i++]);out.push('<p>'+a.map(inline).join('<br>')+'</p>');
 }
 return out.join('\n');
}
function validate(d){if(d?.schema!==SCHEMA||!/^\d{4}-\d{2}-\d{2}$/.test(d.report_date_kst||'')||typeof d.body_markdown!=='string'||!d.body_markdown.trim()||!d.generated_kst||!d.market_date_us)throw Error('브리핑 파일 형식이 올바르지 않습니다.');return d}
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const time=s=>String(s||'—').replace('T',' ').slice(0,16);
let DATA=null,INDEX=null,SOURCE_GLANCE=null,SOURCE_PULSE=null,request=0,bound=false;
const fetchJSON=async path=>{const r=await fetch(path+'?cb='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('게시 파일 조회 실패 ('+r.status+')');return r.json()};
function activate(){const b=document.querySelector('#tabs button[data-tab="morning-brief"]');if(b)b.click()}
function ensure(){let panel=document.getElementById('morning-brief');if(!panel)return null;
 if(!bound){bound=true;document.getElementById('briefRefresh').onclick=()=>load();document.getElementById('briefHistory').onchange=e=>load(e.target.value);document.getElementById('tabs').addEventListener('click',e=>{if(e.target.closest('button[data-tab="morning-brief"]')){if(!DATA)load();try{history.replaceState(null,'','#morning-brief')}catch{}}});window.addEventListener('hashchange',()=>{if(location.hash==='#morning-brief')activate()});}
 return panel;
}
function viewState(d,selected='latest',now=today()){
 const latest=selected==='latest',isToday=d.report_date_kst===now;
 const monday=new Date(now+'T00:00:00Z').getUTCDay()===1;
 const revisions=Array.isArray(d.revisions)?d.revisions:[];
 const revisedOn=revisions.length?String(revisions[revisions.length-1].revised_at_kst||'').slice(0,10):'';
 const conflicts=(d.editorial_contract?.close_checks||[]).filter(c=>c.status==='CONFLICT').map(c=>c.symbol);
 const badge=latest?(isToday?'오늘 공개본':'마지막 게시본 · '+d.report_date_kst):'보관 기록 · '+d.report_date_kst;
 let notice=d.content_status==='USER_PROVIDED_NOT_REVERIFIED'
  ?'사용자 제공 기록이며 본문 수치와 해석은 재검증되지 않았습니다.'
  :'미국장 '+d.market_date_us+' 기준에 작성한 공개 기록입니다. 실시간 시세 또는 주문 신호가 아닙니다.';
 const nowVerified=d.editorial_contract?.interpretation_status==='HISTORIC_NARRATIVE_NOT_RECALCULATED_AFTER_EOD_CORRECTION';
 if(nowVerified){
  const closeText=(d.editorial_contract?.close_checks||[]).filter(c=>c.status==='VERIFIED'&&Number.isFinite(c.close)&&Number.isFinite(c.change_pct))
   .map(c=>c.symbol+' '+Number(c.close).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' ('+(c.change_pct>=0?'+':'')+Number(c.change_pct).toFixed(2)+'%)').join(' · ');
  notice=(revisedOn||'사후')+' 공식 종가 정정: '+closeText+'. 최초 발행 본문에 남은 수익률·TRI-POD 경계선은 재산출되지 않았습니다. 원문은 보관 기록이며 매매 판단에 사용하지 마세요.';
 }else if(conflicts.length)notice+=(revisedOn?' '+revisedOn+' 사후 정정: ':' 확인 보류: ')+conflicts.join('·')+' 확정 종가 불일치/미검증. 과거 본문 수익률과 전략선은 매매 판단에 사용하지 마세요.';
 if(latest&&!isToday&&monday)notice+=' 월요일 국내 개장 전 분석은 별도 투자보드에 기록되며, 이 공개 탭은 화~토 발행본을 표시합니다.';
 return {badge,warning:!isToday||conflicts.length>0,notice,revisedOn,conflicts};
}
function figureQuote(c,d){
 const official=['VERIFIED','CROSS_CHECKED'].includes(c.status)&&Number.isFinite(c.close)&&Number.isFinite(c.change_pct);
 if(official)return {value:c.close,pct:c.change_pct,reference:false,kind:c.status};
 const q=(d.editorial_contract?.reference_quotes||[]).find(q=>
  q.symbol===c.symbol&&q.session_date===d.market_date_us&&q.status==='PROVIDER_REFERENCE_ONLY'&&
  q.official_eod_verified===false&&q.trade_signal_eligible===false&&
  Number.isFinite(q.close)&&Number.isFinite(q.change_pct)&&
  Array.isArray(q.source_observations)&&q.source_observations.length>=2);
 if(c.status==='CONFLICT'&&q)return {value:q.close,pct:q.change_pct,reference:true,kind:c.status};
 return {value:null,pct:null,reference:false,kind:c.status};
}

/** Same-session *display-only* fallback; never changes official EOD/trading gates. */
function canonicalSupplement(d,g,p){
 if(!d||!g||!p||!d.market_date_us||g.us_session!==d.market_date_us||
    p.market_date_us!==d.market_date_us||g.tripod?.session!==d.market_date_us||
    g.no_trade!==true||p.read_only!==true||p.snapshot_status!=='FINAL'||
    p.session_gate?.aligned!==true||
    p.session_gate?.core_dates?.NASDAQ100!==d.market_date_us||
    g.consistency?.status!=='OK')return null;
 const a=g.groups?.find(x=>x.name==='미국')?.items?.find(x=>x.key==='NASDAQ100');
 const raw=p.raw?.tradingview_cross_asset?.ndx;
 const soxItem=g.groups?.find(x=>x.name==='미국')?.items?.find(x=>x.key==='SOX');
 const numeric=v=>typeof v==='number'&&Number.isFinite(v);
 if(a?.date!==d.market_date_us||raw?.market_date!==d.market_date_us||
    !numeric(a?.value)||!numeric(a?.d1_pct)||!numeric(raw?.value)||
    !numeric(raw?.change_pct)||!numeric(g.tripod?.ndx)||
    !numeric(g.tripod?.vix10)||!numeric(g.tripod?.ma250)||
    !numeric(g.tripod?.drawdown_52w_pct)||!g.generated_kst||
    !g.source_generated_kst||!p.generated_kst||
    Math.abs(a.value-raw.value)>.05||Math.abs(g.tripod.ndx-raw.value)>.05||
    Math.abs(a.d1_pct-raw.change_pct)>.06)return null;
 const reportedMissing=(d.editorial_contract?.close_checks||[]).some(x=>
    x.symbol==='NDX'&&['MISSING','CONFLICT'].includes(x.status));
 const narrativeMissing=/VIX10 미확인|MA250 미확인|DD 미확인/.test(d.body_markdown||'');
 if(!reportedMissing&&!narrativeMissing)return null;
 const published=Date.parse(d.published_kst||'');
 const sourceGenerated=Date.parse(g.source_generated_kst);
 const pulseGenerated=Date.parse(p.generated_kst);
 const glanceGenerated=Date.parse(g.generated_kst);
 if(!Number.isFinite(sourceGenerated)||!Number.isFinite(pulseGenerated)||
    !Number.isFinite(glanceGenerated)||!Number.isFinite(published)||
    sourceGenerated>glanceGenerated||pulseGenerated>glanceGenerated||
    sourceGenerated> Date.now()+60000||glanceGenerated>Date.now()+60000)return null;
 const soxOk=soxItem?.date===d.market_date_us&&numeric(soxItem.value)&&soxItem.value>0&&numeric(soxItem.d1_pct);
 return {session:g.us_session,ndx:raw.value,ndxPct:raw.change_pct,
  sox:soxOk?soxItem.value:null,soxPct:soxOk?soxItem.d1_pct:null,
  vix10:g.tripod.vix10,ma250:g.tripod.ma250,dd:g.tripod.drawdown_52w_pct,
  pod:g.tripod.pod,sourceGenerated:g.source_generated_kst,
  pulseGenerated:p.generated_kst,glanceGenerated:g.generated_kst,
  late:glanceGenerated>published,tradeEligible:false,officialEodVerified:false};
}

function render(d){
 const p=ensure();if(!p)return;document.getElementById('briefTitle').textContent=d.title||'송팀장 아침 시황 브리핑';
 const editorial=d.editorial_contract?.version==='SONG_INSPIRED_DAILY_V1';
 const display=viewState(d,document.getElementById('briefHistory')?.value||'latest');
 document.querySelector('.briefEyebrow').textContent=editorial?'DAILY MARKET LETTER · 시장·AI산업 리서치':'SONG MORNING BRIEF · 지난 시황 기록';
 const supplement=document.getElementById('briefHistory')?.value==='latest'?canonicalSupplement(d,SOURCE_GLANCE,SOURCE_PULSE):null;
 let figures=document.getElementById('briefKeyFigures');if(!figures){figures=document.createElement('div');figures.id='briefKeyFigures';figures.className='briefKeyFigures';document.getElementById('briefMeta').after(figures)}
 figures.innerHTML=editorial?(d.editorial_contract.close_checks||[]).map(c=>{
  const baseFigure=figureQuote(c,d);
  const figure=c.symbol==='NDX'&&supplement&&!Number.isFinite(baseFigure.value)
   ?{value:supplement.ndx,pct:supplement.ndxPct,reference:true,kind:'CANONICAL_REFERENCE_ONLY'}:
   c.symbol==='SOX'&&supplement&&Number.isFinite(supplement.sox)&&!Number.isFinite(baseFigure.value)
   ?{value:supplement.sox,pct:supplement.soxPct,reference:true,kind:'CANONICAL_REFERENCE_ONLY'}:baseFigure;
  const usable=Number.isFinite(figure.value),ref=figure.reference;
  const pct=usable?(figure.pct>=0?'+':'')+Number(figure.pct).toFixed(2)+'%':'';
  const note=figure.kind==='CANONICAL_REFERENCE_ONLY'?pct+' · 원장 참고 / 공식 EOD 미검증 (매매 신호 금지)':
   ref?pct+' · 참고 완료 일봉 / 공식 종가 미검증 (매매 신호 사용 금지)':
   c.status==='VERIFIED'?pct+' · 공식 EOD 확인':
   c.status==='CROSS_CHECKED'&&usable?pct+' · 비공식 교차 확인':
   c.status==='CONFLICT'?'확정 종가 출처 충돌':
   c.status==='MISSING'?'완료된 종가 미확인':'원천 검증 필요';
  return `<div class="briefFigure"><span>${esc(c.symbol)} · ${esc(c.session_date)} ${ref?'참고 완료 일봉':c.status==='CROSS_CHECKED'?'참고 종가':'정규장 종가'}</span><b>${usable?esc(Number(figure.value).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})):'확인 보류'}</b><small>${esc(note)}</small></div>`;
 }).join(''):'';
 document.getElementById('briefMeta').innerHTML=`<span>브리핑 날짜 <b>${esc(d.report_date_kst)}</b></span><span>미국장 기준 <b>${esc(d.market_date_us)}</b></span><span>작성 <b>${esc(time(d.generated_kst))} KST</b></span><span>게시 <b>${esc(time(d.published_kst))} KST</b></span>`;
 const badge=document.getElementById('briefBadge');badge.textContent=display.badge;badge.className=display.warning?'briefBadge warning':'briefBadge';
 const noticeElement=document.getElementById('briefNotice');noticeElement.textContent=display.notice;noticeElement.classList.toggle('conflict',display.conflicts.length>0||!!display.revisedOn);
 let provenance=document.getElementById('briefSourceDetails');
 if(!provenance){provenance=document.createElement('details');provenance.id='briefSourceDetails';provenance.className='briefSourceDetails';noticeElement.after(provenance)}
 const wasOpen=provenance.open;provenance.innerHTML='<summary>검증 근거·정정 이력 펼쳐보기</summary><p></p>';
 provenance.querySelector('p').textContent=d.verification_note||'이 보고서의 원천 검증 기록이 없습니다.';
 provenance.open=wasOpen;
 let catchup=document.getElementById('briefCanonicalCatchup');
 if(!catchup){catchup=document.createElement('aside');catchup.id='briefCanonicalCatchup';catchup.className='briefCanonicalCatchup';figures.after(catchup)}
 if(supplement){
  const number=(v,digits=2)=>Number(v).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
  const percent=v=>(v>=0?'+':'')+Number(v).toFixed(2)+'%';
  catchup.hidden=false;
  catchup.innerHTML='<strong>원장 후속 갱신 · '+esc(supplement.session)+' 미국장</strong>'+
   '<p>원문 발행'+(supplement.late?' 후':' 시점에 확인된')+' 최신 원장 참고값입니다. NDX는 Observatory 단일원장, SOX는 Yahoo 일봉 단일원천 참고값입니다. 공식 NDX/SOX EOD 이중검증이 아니며, 기존 시황 원문의 계산·결론이나 거래 신호를 재작성하지 않습니다.</p>'+
   '<p>NDX <b>'+number(supplement.ndx)+'</b> ('+percent(supplement.ndxPct)+') · '+
   (Number.isFinite(supplement.sox)?'SOX <b>'+number(supplement.sox)+'</b> ('+percent(supplement.soxPct)+') · ':'SOX 원천 참고값 미확인 · ')+
   'VIX10 <b>'+number(supplement.vix10)+'</b> · MA250 <b>'+number(supplement.ma250)+'</b> · '+
   '52주 고점 대비 DD <b>'+percent(supplement.dd)+'</b> · 이전 전략 표시 <b>'+esc(supplement.pod)+'</b></p>'+
   '<small>출처: Observatory 원장 '+esc(time(supplement.sourceGenerated))+' / Daily Pulse '+esc(time(supplement.pulseGenerated))+
   ' / Glance '+esc(time(supplement.glanceGenerated))+' KST · 단일 원장 참고 · 공식 종가 미확인 · NO_TRADE_REVIEW_ONLY</small>';
  noticeElement.textContent+=' · 별도 후속 원장 참고값이 상단에 반영됐습니다. 본문은 최초 발행 시점 기록입니다.';
 }else{catchup.hidden=true;catchup.textContent=''}
 const article=document.getElementById('briefArticle');article.innerHTML=markdown(d.body_markdown);article.classList.add('songEditorial');
 const heads=[...article.querySelectorAll('h2')];document.getElementById('briefContents').innerHTML=heads.map(h=>`<a href="#${h.id}">${esc(h.textContent)}</a>`).join('');
 document.getElementById('briefContents').onclick=e=>{const a=e.target.closest('a');if(!a)return;e.preventDefault();document.getElementById(a.getAttribute('href').slice(1))?.scrollIntoView({behavior:'smooth',block:'start'})};
 const status=document.getElementById('briefLoadStatus');status.textContent='미국장 '+d.market_date_us+' 기준 보관 자료입니다. 현재 시장값과 다를 수 있습니다. 검증 통과한 새 공개본은 60초마다 확인합니다.';
}
function renderHistory(){const select=document.getElementById('briefHistory');if(!select)return;const chosen=select.value||'latest';const entries=Array.isArray(INDEX?.entries)?INDEX.entries:[];select.innerHTML='<option value="latest">최신 공개본</option>'+entries.filter(e=>/^\d{4}-\d{2}-\d{2}$/.test(e.report_date_kst||'')).slice(0,120).map(e=>`<option value="${esc(e.report_date_kst)}">${esc(e.report_date_kst)} · 미국 ${esc(e.market_date_us||'—')}</option>`).join('');select.value=[...select.options].some(o=>o.value===chosen)?chosen:'latest'}
async function load(selected){const p=ensure();if(!p)return;const value=selected||document.getElementById('briefHistory').value||'latest';if(value!=='latest'&&!/^\d{4}-\d{2}-\d{2}$/.test(value))return;const id=++request,button=document.getElementById('briefRefresh');button.disabled=true;const status=document.getElementById('briefLoadStatus');status.textContent='브리핑을 읽는 중입니다…';
 const path=value==='latest'?LATEST:ROOT+value.replace(/-/g,'')+'.json';
 const results=await Promise.allSettled([fetchJSON(path).then(validate),fetchJSON(HISTORY),fetchJSON('./data/daily-glance.json'),fetchJSON('./data/daily-market-pulse.json')]);if(id!==request)return;
 SOURCE_GLANCE=results[2].status==='fulfilled'?results[2].value:null;
 SOURCE_PULSE=results[3].status==='fulfilled'?results[3].value:null;
 if(results[1].status==='fulfilled'){INDEX=results[1].value;renderHistory()}
 if(results[0].status==='fulfilled'){DATA=results[0].value;render(DATA);if(results[1].status==='rejected')status.textContent+=' 지난 브리핑 목록은 조회하지 못했습니다.'}
 else status.textContent=String(results[0].reason?.message||'브리핑 조회 실패')+(DATA?' 이전에 읽은 원문을 유지합니다.':' 아직 게시된 브리핑이 없거나 조회할 수 없습니다.');button.disabled=false;
}
const style=document.createElement('style');style.textContent=`
.briefShell{max-width:1000px;margin:0 auto}.briefHead{background:#fff;border:1px solid #e5ebf2;border-radius:16px;padding:20px;margin-bottom:12px}.briefEyebrow{font-size:11px;color:#175cd3;font-weight:800;letter-spacing:.04em}.briefHead h1{font-size:25px;margin:8px 0 12px;line-height:1.4}.briefMeta{display:flex;flex-wrap:wrap;gap:6px 20px;font-size:12px;color:#667085}.briefMeta b{color:#344054}.briefTools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:16px}.briefTools select,.briefTools button{border:1px solid #d5dfec;background:#fff;border-radius:9px;padding:9px 12px;font:inherit;font-size:13px;min-height:40px;max-width:100%}.briefTools button{cursor:pointer;color:#175cd3;font-weight:700}.briefTools button:disabled{opacity:.6}.briefBadge{font-size:11px;color:#087443;background:#ecfdf3;padding:5px 9px;border-radius:999px}.briefBadge.warning{color:#b54708;background:#fff6ed}.briefNotice{font-size:12px;color:#344054;margin:12px 0 0;line-height:1.6}.briefNotice.conflict{background:#fff9e3;border-left:4px solid #eab308;padding:12px 13px;border-radius:5px;font-weight:700}.briefSourceDetails{font-size:12px;color:#667085;margin-top:10px;line-height:1.6}.briefSourceDetails summary{cursor:pointer;color:#475467;font-weight:700}.briefSourceDetails p{margin:8px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}.briefLoadStatus{font-size:12px;line-height:1.6;color:#667085;padding:0 4px;margin:8px 0 12px}.briefContents{display:flex;flex-wrap:wrap;gap:7px;margin:14px 0 0}.briefContents a{font-size:11px;color:#175cd3;background:#eef4ff;padding:6px 9px;border-radius:8px;text-decoration:none}.briefArticle{padding:28px;background:#fff;border:1px solid #e5ebf2;border-radius:16px;font-size:15px;line-height:1.85;overflow-wrap:anywhere}.briefArticle h1{font-size:24px}.briefArticle h2{font-size:20px;color:#0b3b70;border-bottom:1px solid #e5ebf2;padding-bottom:10px;margin-top:32px;scroll-margin-top:190px}.briefArticle h3{font-size:17px;margin-top:24px}.briefArticle h4{font-size:15px}.briefArticle p{margin:12px 0}.briefArticle ul,.briefArticle ol{padding-left:24px}.briefArticle li{margin:5px 0}.briefArticle a{color:#175cd3;text-underline-offset:3px}.briefArticle hr{border:0;border-top:1px solid #e5ebf2;margin:24px 0}.briefArticle blockquote{margin:18px 0;background:#f3f7ff;border-left:4px solid #175cd3;padding:14px 18px;border-radius:6px}.briefArticle code{background:#f2f4f7;padding:2px 5px;border-radius:4px}.briefTableWrap{overflow-x:auto;margin:14px 0}.briefArticle table{border-collapse:collapse;width:100%;min-width:480px;font-size:13px;line-height:1.6}.briefArticle th,.briefArticle td{border:1px solid #e5ebf2;padding:9px 12px;text-align:left}.briefArticle th{background:#f3f6fa;font-weight:750}.briefArticle tbody tr:nth-child(even){background:#fafbfd}
@media(max-width:760px){.briefHead{padding:16px}.briefHead h1{font-size:21px}.briefArticle{padding:16px;font-size:14px}.briefArticle h2{font-size:18px}.briefMeta{display:grid;grid-template-columns:1fr;font-size:11px}.briefTools select{flex:1;min-width:0}.briefArticle table{font-size:12px}.briefArticle th,.briefArticle td{padding:8px}.briefContents{gap:5px}}
.songEditorial{background:#fff;color:#191919;font-family:system-ui,-apple-system,'Noto Sans KR',sans-serif}.songEditorial h2{background:#171717;color:#ffe100!important;border-left:9px solid #ffe100;border-bottom:0;border-radius:3px;padding:12px 16px;margin:36px 0 18px;font-size:20px;font-weight:900;letter-spacing:-.025em}.songEditorial h3{background:#fff5b8;color:#101010;padding:10px 12px;border-radius:2px;font-size:17px;font-weight:850;margin-top:30px;border-bottom:2px solid #e9c900}.songEditorial strong{font-weight:850}.songEditorial blockquote{background:#fff8c9;border-left:5px solid #f0c900;color:#222}.songEditorial .briefTableWrap{border:1px solid #ddd;border-radius:7px}.songEditorial th{background:#1d1d1d!important;color:#ffe100!important;border-color:#444!important}.songEditorial td{font-variant-numeric:tabular-nums}.songEditorial p:first-child{font-size:19px;font-weight:750}.songEditorial a{color:#1255a5}.briefEyebrow{color:#181818!important;background:#ffe100;display:inline-block;padding:5px 10px;border-radius:3px}.briefHead{border-top:6px solid #ffe100}.briefHead h1{font-size:30px;letter-spacing:-.035em;max-width:760px}.briefContents a{background:#fff4a3;color:#151515;font-weight:750}.briefBadge{background:#ffe100;color:#151515}.briefArticle{border-top:4px solid #171717}.briefKeyFigures{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}.briefKeyFigures:empty{display:none}.briefCanonicalCatchup{background:#fff8e5;border:1px solid #ecd79c;border-left:5px solid #e7b820;border-radius:10px;margin-top:14px;padding:12px 16px;font-size:13px;line-height:1.65;color:#26241f}.briefCanonicalCatchup[hidden]{display:none}.briefCanonicalCatchup strong{font-weight:800}.briefCanonicalCatchup p{margin:6px 0}.briefCanonicalCatchup small{font-size:11px;color:#57534e}.briefFigure{background:#171717;color:#fff;border-radius:10px;padding:16px;display:grid;gap:5px}.briefFigure span{color:#d2d5da;font-size:12px}.briefFigure b{font-size:28px;line-height:1.25;font-variant-numeric:tabular-nums}.briefFigure small{color:#ffe100;font-size:15px;font-weight:750}@media(max-width:760px){.songEditorial h2{font-size:17px;padding:11px 12px;margin-top:26px}.songEditorial h3{font-size:15px}.songEditorial .briefTableWrap{margin-left:-10px;margin-right:-10px}.songEditorial td,.songEditorial th{white-space:normal;min-width:85px}.briefArticle{padding:14px}.briefHead h1{font-size:24px}.briefFigure{padding:12px}.briefFigure b{font-size:23px} .briefFigure span{font-size:10px}.briefTools{display:grid;grid-template-columns:minmax(0,auto) minmax(0,1fr);align-items:center}.briefTools label{font-size:12px}.briefTools select{width:100%;font-size:13px}.briefTools button{grid-column:1/3;justify-self:start}.briefBadge{grid-column:1/3;justify-self:start}.briefHead h1{font-size:clamp(21px,5.5vw,24px);line-height:1.4}.briefNotice{font-size:12px}}
`;document.head.appendChild(style);ensure();if(location.hash==='#morning-brief')activate();
setInterval(()=>{if(document.querySelector('#tabs button[data-tab="morning-brief"].on')&&document.getElementById('briefHistory')?.value==='latest')load('latest')},60000);
window.__JJOONI_MORNING_BRIEF={version:'1.2',contract:'SAME_CHAT_BRIEF_PUBLISHED_WITH_DAILY_ARCHIVE',markdown,validate,viewState,load};
})();
