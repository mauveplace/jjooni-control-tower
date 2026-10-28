(function(root){
'use strict';
const norm=s=>String(s||'').trim().toUpperCase().replace(/\.(KS|KQ)$/,'');
function related(company,holdings){
 if(holdings.some(p=>norm(p.symbol)===company.symbol))return '직접 보유';
 const names=holdings.map(p=>String(p.name||'')+' '+norm(p.symbol)).join(' ');
 if(company.market==='US'&&/나스닥|NASDAQ|TQQQ|QQQM|\bQQQ\b|\bQLD\b/i.test(names))return 'ETF 관련 관찰';
 if(company.market==='KR'&&/코스피|KOSPI/i.test(names))return 'ETF 관련 관찰';
 if(/반도체|SEMICON|SOXL|SOXX/i.test(names)&&/반도체|메모리|파운드리/.test(company.theme))return 'ETF 관련 관찰';
 return null;
}
function surprise(m){return Number.isFinite(m.actual)&&Number.isFinite(m.consensus)&&m.consensus!==0&&m.consensus_basis===m.basis?100*(m.actual-m.consensus)/Math.abs(m.consensus):null;}
function select(data,filter,holdings=[],now=new Date()){
 const companies=new Map((data.universe||[]).map(c=>[c.symbol,c]));
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(now);
 return (data.events||[]).map(e=>({...e,company:companies.get(e.symbol),relation:related(companies.get(e.symbol)||{},holdings),displayState:e.status==='RELEASED'?'발표 완료':e.date_kst<today?'발표 확인 중':'발표 예정'})).filter(e=>e.company&&(filter!=='released'||e.status==='RELEASED')&&(filter!=='upcoming'||e.status!=='RELEASED')&&(filter!=='holdings'||e.relation)).sort((a,b)=>filter==='released'?b.date_kst.localeCompare(a.date_kst):a.date_kst.localeCompare(b.date_kst));
}
const api={norm,related,surprise,select};if(typeof module==='object'&&module.exports){module.exports=api;return}root.JjooniEarnings=api;
let data=null,pending=null,filter='all',shown=8;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=u=>{try{const x=new URL(u);return x.protocol==='https:'?esc(x.href):'#'}catch(_){return '#'}};
const time=s=>s?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(s)):'시간 미확인';
function local(){try{const d=JSON.parse(localStorage.getItem('jjooni_private_earnings_symbols_v1')||'{}');return {positions:Array.isArray(d.positions)?d.positions:[],as_of:d.as_of}}catch(_){return {positions:[]}}}
function mount(){const panel=document.getElementById('calendar');if(!panel)return null;let box=document.getElementById('earningsBoard');if(box)return box;box=document.createElement('section');box.id='earningsBoard';box.className='card';box.style.marginBottom='14px';panel.prepend(box);return box;}
function render(){const box=mount();if(!box||!data)return;const held=local(),rows=select(data,filter,held.positions),known=new Set(data.events.map(e=>e.symbol));const units={KRW_TRILLION:'조원',KRW_BILLION:'십억원',USD_BILLION:'십억달러',USD_MILLION:'백만달러',USD_PER_SHARE:'달러/주',PERCENT:'%'};
 const metrics=e=>e.metrics.length?'<div style="overflow:auto"><table style="width:100%;font-size:12px;border-collapse:collapse"><thead><tr><th>지표·기준</th><th>발표값</th><th>예상</th><th>예상 대비</th></tr></thead><tbody>'+e.metrics.map(m=>{const diff=surprise(m);return '<tr><td>'+esc(m.label)+' · '+esc(m.basis)+'</td><td>'+esc(m.actual?.toLocaleString('ko-KR',{maximumFractionDigits:4})??'미확인')+' '+esc(units[m.unit]||m.unit)+(Number.isFinite(m.yoy_pct)?'<br>전년비 '+esc(m.yoy_pct)+'%':'')+'</td><td>'+esc(m.consensus??'미확인')+'</td><td>'+(diff==null?'비교 불가':esc(diff.toFixed(2))+'%')+'</td></tr>'}).join('')+'</tbody></table></div>':'<p class="meta">결과 수치 확인 대기 · 일정이 지났다는 이유로 발표 완료로 바꾸지 않습니다.</p>';
 box.innerHTML='<h3>기업 실적 일정·결과</h3><p class="meta">공식 IR·공시 기준 · 모든 표시시각 KST · 수치와 해석 분리 · 확인 '+esc(time(data.updated_kst))+'</p><div class="range">'+[['all','전체'],['upcoming','발표 예정'],['released','발표 완료'],['holdings','내 보유 관련']].map(([k,v])=>'<button type="button" data-earn-filter="'+k+'" aria-pressed="'+(filter===k)+'" class="'+(filter===k?'on':'')+'">'+v+'</button>').join('')+'</div>'+(filter==='holdings'?'<p class="meta">'+(held.positions.length?'같은 브라우저의 컨트롤타워 보유내역 · 기준 '+esc(held.as_of||'미확인'):'보유내역 미연결: 같은 브라우저에서 컨트롤타워를 열어 갱신해 주세요.')+' · ETF 관련 관찰은 구성종목·비중 확정 자료가 아닙니다.</p>':'')+rows.slice(0,shown).map(e=>'<article style="border-top:1px solid #e5ebf2;padding:14px 0"><div style="display:flex;justify-content:space-between;gap:10px"><b>'+esc(e.company.name)+' · '+esc(e.symbol)+'</b><span>'+esc(e.displayState)+'</span></div><p class="meta">'+esc(e.date_kst)+' · '+esc(e.fiscal_period)+' · '+esc(e.relation||'시장 핵심 관찰')+' · '+esc(e.company.theme)+(e.release_at_kst?'<br>결과 공개 '+esc(time(e.release_at_kst))+(e.time_status==='APPROXIMATE'?'경':''):' · 공개시각 미확인')+(e.call_at_kst?'<br>컨퍼런스콜 '+esc(time(e.call_at_kst)):'')+'</p>'+metrics(e)+'<details><summary>발표 내용·분석·다음 확인사항</summary>'+[['확인된 사실',e.facts],['분석·해석',e.analysis],['위험·한계',e.risks],['다음 확인',e.next_checks]].map(([label,xs])=>xs?.length?'<p><b>'+label+'</b></p><ul>'+xs.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'').join('')+'<p>'+e.sources.map(s=>'<a href="'+link(s.url)+'" target="_blank" rel="noopener noreferrer">공식 원문</a>').join(' · ')+'</p></details></article>').join('')+(rows.length===0?'<p>해당 조건에서 확인된 실적 일정이 없습니다. 일정 없음과는 다릅니다.</p>':'')+(rows.length>shown?'<button type="button" data-earn-more>더 보기 ('+(rows.length-shown)+')</button>':'')+'<details><summary>관찰기업·일정 확인 범위 ('+known.size+'/'+data.universe.length+')</summary><p class="meta">'+esc(data.coverage_note)+'</p>'+data.universe.filter(c=>!known.has(c.symbol)).map(c=>'<span style="display:inline-block;margin:4px;font-size:12px">'+esc(c.name)+' · 일정 미확인</span>').join('')+'</details>';
 box.onclick=e=>{const b=e.target.closest('[data-earn-filter]');if(b){filter=b.dataset.earnFilter;shown=8;render()}if(e.target.closest('[data-earn-more]')){shown+=8;render()}};
}
function load(){if(data){render();return Promise.resolve()}if(pending)return pending;const box=mount();if(!box)return Promise.resolve();box.textContent='기업 실적 자료 확인 중…';pending=fetch('./data/earnings.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(d=>{if(d.schema!=='OBS_EARNINGS_V1')throw Error('실적 자료 형식 오류');data=d;render()}).catch(()=>{box.textContent='기업 실적 자료를 불러오지 못했습니다. 기존 경제일정은 계속 확인할 수 있습니다.'}).finally(()=>{pending=null});return pending;}
function active(){const p=document.getElementById('calendar');return p?.classList.contains('on')}
document.addEventListener('click',e=>{if(e.target.closest('[data-tab="calendar"]'))load()});window.addEventListener('storage',e=>{if(e.key==='jjooni_private_earnings_symbols_v1'&&data)render()});if(active())load();
})(typeof window==='object'?window:globalThis);
