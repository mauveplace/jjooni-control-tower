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
let DATA=null,INDEX=null,request=0,bound=false;
const fetchJSON=async path=>{const r=await fetch(path+'?cb='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('게시 파일 조회 실패 ('+r.status+')');return r.json()};
function activate(){const b=document.querySelector('#tabs button[data-tab="morning-brief"]');if(b)b.click()}
function ensure(){let panel=document.getElementById('morning-brief');if(!panel)return null;
 if(!bound){bound=true;document.getElementById('briefRefresh').onclick=()=>load();document.getElementById('briefHistory').onchange=e=>load(e.target.value);document.getElementById('tabs').addEventListener('click',e=>{if(e.target.closest('button[data-tab="morning-brief"]')){if(!DATA)load();try{history.replaceState(null,'','#morning-brief')}catch{}}});window.addEventListener('hashchange',()=>{if(location.hash==='#morning-brief')activate()});}
 return panel;
}
function render(d){
 const p=ensure();if(!p)return;document.getElementById('briefTitle').textContent=d.title||'송팀장 아침 시황 브리핑';
 const archived=d.report_date_kst!==today(),seed=d.content_status==='USER_PROVIDED_NOT_REVERIFIED';
 document.getElementById('briefMeta').innerHTML=`<span>브리핑 날짜 <b>${esc(d.report_date_kst)}</b></span><span>미국장 기준 <b>${esc(d.market_date_us)}</b></span><span>작성 <b>${esc(time(d.generated_kst))} KST</b></span><span>게시 <b>${esc(time(d.published_kst))} KST</b></span>`;
 const badge=document.getElementById('briefBadge');badge.textContent=archived?'이전 브리핑':'오늘 브리핑';badge.className=archived?'briefBadge warning':'briefBadge';
 document.getElementById('briefNotice').textContent=seed?'채팅에서 제공된 원문입니다. 이번 게시에서 본문 수치와 해석을 다시 검증하지 않았으며, 시장 SSOT와 별도로 보관합니다.':(d.verification_note||'출처·기준시각과 미확인 항목은 본문에서 확인하세요.');
 const article=document.getElementById('briefArticle');article.innerHTML=markdown(d.body_markdown);
 const heads=[...article.querySelectorAll('h2')];document.getElementById('briefContents').innerHTML=heads.map(h=>`<a href="#${h.id}">${esc(h.textContent)}</a>`).join('');
 document.getElementById('briefContents').onclick=e=>{const a=e.target.closest('a');if(!a)return;e.preventDefault();document.getElementById(a.getAttribute('href').slice(1))?.scrollIntoView({behavior:'smooth',block:'start'})};
 const status=document.getElementById('briefLoadStatus');status.textContent='게시된 원문을 읽었습니다. 작성 완료 후 자동 게시되며, 페이지는 60초마다 새 게시 여부를 확인합니다.';
}
function renderHistory(){const select=document.getElementById('briefHistory');if(!select)return;const chosen=select.value||'latest';const entries=Array.isArray(INDEX?.entries)?INDEX.entries:[];select.innerHTML='<option value="latest">최신 브리핑</option>'+entries.filter(e=>/^\d{4}-\d{2}-\d{2}$/.test(e.report_date_kst||'')).slice(0,120).map(e=>`<option value="${esc(e.report_date_kst)}">${esc(e.report_date_kst)} · 미국 ${esc(e.market_date_us||'—')}</option>`).join('');select.value=[...select.options].some(o=>o.value===chosen)?chosen:'latest'}
async function load(selected){const p=ensure();if(!p)return;const value=selected||document.getElementById('briefHistory').value||'latest';if(value!=='latest'&&!/^\d{4}-\d{2}-\d{2}$/.test(value))return;const id=++request,button=document.getElementById('briefRefresh');button.disabled=true;const status=document.getElementById('briefLoadStatus');status.textContent='브리핑을 읽는 중입니다…';
 const path=value==='latest'?LATEST:ROOT+value.replace(/-/g,'')+'.json';
 const results=await Promise.allSettled([fetchJSON(path).then(validate),fetchJSON(HISTORY)]);if(id!==request)return;
 if(results[1].status==='fulfilled'){INDEX=results[1].value;renderHistory()}
 if(results[0].status==='fulfilled'){DATA=results[0].value;render(DATA);if(results[1].status==='rejected')status.textContent+=' 지난 브리핑 목록은 조회하지 못했습니다.'}
 else status.textContent=String(results[0].reason?.message||'브리핑 조회 실패')+(DATA?' 이전에 읽은 원문을 유지합니다.':' 아직 게시된 브리핑이 없거나 조회할 수 없습니다.');button.disabled=false;
}
const style=document.createElement('style');style.textContent=`
.briefShell{max-width:1000px;margin:0 auto}.briefHead{background:#fff;border:1px solid #e5ebf2;border-radius:16px;padding:20px;margin-bottom:12px}.briefEyebrow{font-size:11px;color:#175cd3;font-weight:800;letter-spacing:.04em}.briefHead h1{font-size:25px;margin:8px 0 12px;line-height:1.4}.briefMeta{display:flex;flex-wrap:wrap;gap:6px 20px;font-size:12px;color:#667085}.briefMeta b{color:#344054}.briefTools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:16px}.briefTools select,.briefTools button{border:1px solid #d5dfec;background:#fff;border-radius:9px;padding:9px 12px;font:inherit;font-size:13px;min-height:40px;max-width:100%}.briefTools button{cursor:pointer;color:#175cd3;font-weight:700}.briefTools button:disabled{opacity:.6}.briefBadge{font-size:11px;color:#087443;background:#ecfdf3;padding:5px 9px;border-radius:999px}.briefBadge.warning{color:#b54708;background:#fff6ed}.briefNotice{font-size:12px;color:#667085;margin:12px 0 0;line-height:1.6}.briefLoadStatus{font-size:12px;line-height:1.6;color:#667085;padding:0 4px;margin:8px 0 12px}.briefContents{display:flex;flex-wrap:wrap;gap:7px;margin:14px 0 0}.briefContents a{font-size:11px;color:#175cd3;background:#eef4ff;padding:6px 9px;border-radius:8px;text-decoration:none}.briefArticle{padding:28px;background:#fff;border:1px solid #e5ebf2;border-radius:16px;font-size:15px;line-height:1.85;overflow-wrap:anywhere}.briefArticle h1{font-size:24px}.briefArticle h2{font-size:20px;color:#0b3b70;border-bottom:1px solid #e5ebf2;padding-bottom:10px;margin-top:32px;scroll-margin-top:190px}.briefArticle h3{font-size:17px;margin-top:24px}.briefArticle h4{font-size:15px}.briefArticle p{margin:12px 0}.briefArticle ul,.briefArticle ol{padding-left:24px}.briefArticle li{margin:5px 0}.briefArticle a{color:#175cd3;text-underline-offset:3px}.briefArticle hr{border:0;border-top:1px solid #e5ebf2;margin:24px 0}.briefArticle blockquote{margin:18px 0;background:#f3f7ff;border-left:4px solid #175cd3;padding:14px 18px;border-radius:6px}.briefArticle code{background:#f2f4f7;padding:2px 5px;border-radius:4px}.briefTableWrap{overflow-x:auto;margin:14px 0}.briefArticle table{border-collapse:collapse;width:100%;min-width:480px;font-size:13px;line-height:1.6}.briefArticle th,.briefArticle td{border:1px solid #e5ebf2;padding:9px 12px;text-align:left}.briefArticle th{background:#f3f6fa;font-weight:750}.briefArticle tbody tr:nth-child(even){background:#fafbfd}
@media(max-width:760px){.briefHead{padding:16px}.briefHead h1{font-size:21px}.briefArticle{padding:16px;font-size:14px}.briefArticle h2{font-size:18px}.briefMeta{display:grid;grid-template-columns:1fr;font-size:11px}.briefTools select{flex:1;min-width:0}.briefArticle table{font-size:12px}.briefArticle th,.briefArticle td{padding:8px}.briefContents{gap:5px}}
`;document.head.appendChild(style);ensure();if(location.hash==='#morning-brief')activate();
setInterval(()=>{if(document.querySelector('#tabs button[data-tab="morning-brief"].on')&&document.getElementById('briefHistory')?.value==='latest')load('latest')},60000);
window.__JJOONI_MORNING_BRIEF={version:'1.0',contract:'SAME_CHAT_BRIEF_PUBLISHED_WITH_DAILY_ARCHIVE',markdown,validate,load};
})();
