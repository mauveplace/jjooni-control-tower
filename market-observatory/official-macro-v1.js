(()=>{
'use strict';
if(window.__JJOONI_OFFICIAL_MACRO_V1)return;
const STATE={version:'1.1',status:'BOOTING',loaded:false,error:null,selected:null,range:'10Y',chart:null};
window.__JJOONI_OFFICIAL_MACRO_V1=STATE;
let DATA=null;
const q=(s,r=document)=>{try{return r.querySelector(s)}catch(_){return null}};
const qa=(s,r=document)=>{try{return [...r.querySelectorAll(s)]}catch(_){return[]}};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const n=v=>{if(v==null||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
const fmt=(v,d=2)=>n(v)==null?'—':Number(v).toLocaleString('ko-KR',{maximumFractionDigits:d});
const signed=(v,d=2)=>n(v)==null?'—':(Number(v)>0?'+':'')+fmt(v,d);
const COLORS={GREEN:'🟢',ORANGE:'🟠',RED:'🔴',GRAY:'⚪'};
const GROUPS={
 us:[['inflation','Inflation'],['labor','Labor'],['growth','Growth'],['fed','Fed']],
 kr:[['inflation','Inflation'],['growth','Growth'],['exports','Export'],['semiconductor','Semiconductor']]
};
const METRIC_GUIDE={
 US_CPI:{meaning:'미국 소비자가 실제로 지불하는 상품·서비스 가격의 변화를 보여주는 대표 물가지표입니다.',high:'높을수록 물가압력이 강하다는 뜻이라 금리 인하 기대가 약해지거나 금리 상승 압력이 커질 수 있습니다.',low:'낮을수록 인플레이션 둔화 신호로 해석돼 금리 부담 완화에 우호적일 수 있습니다.',market:'채권금리·달러·성장주에 민감합니다. 특히 예상치 대비 차이와 Core CPI를 함께 봅니다.'},
 US_CORE_CPI:{meaning:'CPI에서 변동성이 큰 식품·에너지를 제외해 기조적인 물가압력을 보는 지표입니다.',high:'예상보다 높으면 끈적한 물가로 해석돼 Fed 긴축 우려가 커질 수 있습니다.',low:'예상보다 낮으면 기조적 물가 둔화 신호로 금리민감 자산에 우호적일 수 있습니다.',market:'헤드라인 CPI보다 통화정책 해석에 더 중요하게 반응하는 경우가 많습니다.'},
 US_PCE:{meaning:'미국 가계의 소비지출 가격 변화를 측정하는 물가지표이며 소비구성 변화까지 반영합니다.',high:'높으면 소비물가 압력이 강하다는 뜻입니다.',low:'낮으면 인플레이션 압력 완화 신호입니다.',market:'Fed가 선호하는 물가체계의 일부라 금리 기대에 영향을 줍니다.'},
 US_CORE_PCE:{meaning:'식품·에너지를 제외한 PCE 물가로 Fed가 특히 중시하는 기조 물가지표입니다.',high:'예상 상회 시 정책금리 인하 지연 또는 높은 금리 장기화 우려가 커질 수 있습니다.',low:'예상 하회 시 디스인플레이션 기대와 금리부담 완화에 힘을 줄 수 있습니다.',market:'미국 금리·달러·나스닥/반도체 등 장기 성장자산에 핵심 거시 입력입니다.'},
 US_NFP:{meaning:'미국 비농업 부문의 월간 고용 증감을 보여주는 대표 고용지표입니다.',high:'고용 증가가 강하면 경기와 소비는 견조하지만 임금·물가 압력 때문에 금리 인하 기대가 약해질 수 있습니다.',low:'고용 증가가 약하면 경기둔화 우려가 커지지만 동시에 금리 인하 기대가 강화될 수 있습니다.',market:'숫자 자체보다 예상치, 이전치 수정, 3개월 평균을 함께 봐야 합니다.'},
 US_UNEMPLOYMENT:{meaning:'경제활동인구 중 실업자가 차지하는 비율입니다.',high:'상승하면 노동시장 냉각과 경기둔화 신호일 수 있습니다.',low:'낮으면 노동시장이 타이트하다는 뜻으로 임금·물가압력이 유지될 수 있습니다.',market:'NFP와 함께 봐야 하며 단독으로 해석하면 왜곡될 수 있습니다.'},
 US_AHE:{meaning:'미국 민간부문 근로자의 평균 시간당 임금 증가율로 임금 인플레이션을 보는 지표입니다.',high:'높으면 서비스 물가와 인플레이션 압력 지속 가능성이 커집니다.',low:'낮으면 임금발 물가압력 완화 신호일 수 있습니다.',market:'Core PCE와 함께 Fed의 기조물가 판단에 중요한 보조지표입니다.'},
 US_JOLTS:{meaning:'미국의 구인건수와 노동시장 수요를 보여주는 지표입니다.',high:'구인건수가 많으면 기업의 노동수요가 강하고 노동시장이 타이트하다는 뜻입니다.',low:'구인 감소는 노동시장 수요 냉각 신호입니다.',market:'실업자 대비 구인건수와 추세를 같이 보면 노동시장 균형을 더 잘 볼 수 있습니다.'},
 US_ECI:{meaning:'임금과 복리후생을 포함한 고용비용의 변화를 측정하는 지표입니다.',high:'높으면 기업의 인건비 부담과 서비스 물가 압력이 강할 수 있습니다.',low:'낮으면 임금·고용비용 압력이 완화되는 신호입니다.',market:'분기 지표지만 임금 인플레이션의 질을 보는 데 유용합니다.'},
 US_GDP:{meaning:'미국 경제가 일정 기간 생산한 최종 재화·서비스의 실질 성장률입니다.',high:'성장이 강하면 기업이익과 경기에는 긍정적이지만 금리 인하 기대는 약해질 수 있습니다.',low:'성장이 약하면 경기침체 우려가 커질 수 있으나 금리 하락 기대는 강화될 수 있습니다.',market:'성장률뿐 아니라 소비·투자·재고 등 세부 기여도를 함께 봅니다.'},
 US_FED_FUNDS:{meaning:'Fed가 설정하는 연방기금금리 목표범위로 미국 통화정책의 기준 금리입니다.',high:'금리가 높거나 인상되면 금융여건이 긴축적이 되어 성장주와 레버리지 자산의 할인율 부담이 커질 수 있습니다.',low:'금리 인하 또는 낮은 금리는 금융여건 완화에 우호적입니다.',market:'현재 금리보다 향후 경로와 시장 기대(FedWatch)가 더 중요할 때가 많습니다.'},
 US_SEP_DOT_PLOT:{meaning:'FOMC 위원들의 성장·물가·실업·정책금리 전망과 점도표를 보여주는 공식 전망 자료입니다.',high:'점도표 금리 경로가 높아지면 더 매파적인 정책 전망입니다.',low:'점도표 금리 경로가 낮아지면 더 비둘기파적인 정책 전망입니다.',market:'실제 정책 약속이 아니라 위원들의 전망이므로 향후 데이터에 따라 바뀔 수 있습니다.'},
 KR_BASE_RATE:{meaning:'한국은행 금융통화위원회가 결정하는 한국의 기준금리입니다.',high:'금리 인상·고금리 지속은 원화 강세 요인이 될 수 있지만 내수·부동산·주식 할인율에는 부담입니다.',low:'금리 인하는 금융여건 완화에 우호적이지만 환율과 자본흐름을 함께 봐야 합니다.',market:'한미 금리차, 원/달러 환율, 가계부채를 같이 봅니다.'},
 KR_CPI:{meaning:'한국 가계가 구입하는 상품·서비스 가격의 변화를 보여주는 대표 소비자물가지표입니다.',high:'물가가 높으면 한국은행의 금리 인하 여력이 줄 수 있습니다.',low:'물가 둔화는 통화완화 여지를 키울 수 있습니다.',market:'원/달러 환율과 서비스물가를 함께 확인하는 것이 중요합니다.'},
 KR_CORE_CPI:{meaning:'변동성이 큰 일부 품목을 제외해 한국의 기조적 물가 흐름을 보는 지표입니다.',high:'기조물가가 높으면 금리 인하가 늦어질 가능성이 커질 수 있습니다.',low:'기조물가 둔화는 정책 완화에 우호적입니다.',market:'헤드라인 CPI보다 지속적인 물가압력을 판단할 때 유용합니다.'},
 KR_GDP:{meaning:'한국 경제의 실질 성장률로 내수와 수출을 포함한 전체 경기 방향을 보여줍니다.',high:'성장이 강하면 기업실적과 경기에는 긍정적이지만 금리인하 필요성은 낮아질 수 있습니다.',low:'성장이 약하면 내수·기업실적 우려가 커질 수 있습니다.',market:'수출 주도인지 내수 회복인지 성장 구성까지 확인해야 합니다.'},
 KR_BOK_OUTLOOK:{meaning:'한국은행이 제시하는 성장률·물가 등 공식 경제전망입니다.',high:'성장 전망 상향은 경기 자신감 신호이고 물가 전망 상향은 통화완화 제약 요인입니다.',low:'성장 전망 하향은 경기 우려, 물가 전망 하향은 금리 인하 여지 확대 요인입니다.',market:'전망치 자체보다 직전 전망 대비 상향·하향 수정이 중요합니다.'},
 KR_EXPORT_YOY:{meaning:'한국 전체 수출액이 1년 전 같은 기간보다 얼마나 늘거나 줄었는지 보여줍니다.',high:'수출 증가율 상승은 제조업·기업이익·원화에 우호적인 경기 신호일 수 있습니다.',low:'수출 둔화는 대외수요와 제조업 사이클 약화 신호일 수 있습니다.',market:'반도체 비중이 커서 반도체 수출과 중국·미국 수요를 함께 봅니다.'},
 KR_SEMICON_EXPORT_YOY:{meaning:'한국 반도체 수출액의 전년동기 대비 증감률로 국내 반도체 업황의 핵심 실물지표입니다.',high:'증가율이 높으면 메모리·AI 서버 등 반도체 수요가 강하다는 신호일 수 있습니다.',low:'둔화 또는 감소는 업황 피크아웃 가능성을 점검해야 한다는 신호입니다.',market:'삼성전자·SK하이닉스와 반도체 ETF의 펀더멘털 확인에 직접적인 참고지표입니다.'},
 KR_EXPORT_1_20:{meaning:'매월 1~20일 관세청 수출을 집계한 조기 지표로 월말 수출 방향을 빠르게 확인합니다.',high:'초반 수출이 강하면 해당 월 전체 수출의 양호한 출발로 볼 수 있습니다.',low:'초반 수출이 약하면 월말까지 회복 여부를 확인해야 합니다.',market:'조업일수 차이가 크므로 일평균 수출을 함께 봐야 합니다.'},
 KR_CURRENT_ACCOUNT:{meaning:'상품·서비스·본원소득 등을 포함한 대외거래의 순수지를 보여주는 지표입니다.',high:'큰 흑자는 외화 유입과 대외건전성에 긍정적입니다.',low:'적자 또는 흑자 축소는 대외수지와 원화에 부담 요인이 될 수 있습니다.',market:'상품수지뿐 아니라 배당·이자 등 본원소득수지까지 같이 봅니다.'},
 KR_EMPLOYMENT:{meaning:'한국 고용시장 상황을 취업자 수·실업률 등으로 보여주는 지표군입니다.',high:'고용 증가가 강하면 내수와 소비 여건이 양호하다는 신호입니다.',low:'고용 둔화는 내수 약화와 경기 하방 신호일 수 있습니다.',market:'연령대·업종별 고용과 실업률을 함께 봐야 합니다.'},
 KR_INDUSTRIAL_PRODUCTION:{meaning:'광공업·서비스업 등 생산활동의 변화를 통해 한국 경기의 현재 흐름을 보여주는 지표입니다.',high:'생산 증가가 강하면 제조업과 경기회복 신호로 볼 수 있습니다.',low:'생산 감소는 재고조정이나 수요 둔화 신호일 수 있습니다.',market:'재고·출하·설비투자와 함께 보면 경기 사이클 판단력이 높아집니다.'}
};
function guideFor(key,m){
 return METRIC_GUIDE[key]||{meaning:(m?.name||key)+'의 현재 수준과 추세를 확인하는 공식 거시지표입니다.',high:'높은 값의 의미는 지표 성격과 경기국면에 따라 달라집니다.',low:'낮은 값의 의미는 지표 성격과 경기국면에 따라 달라집니다.',market:'이전치·예상치·장기추세를 함께 확인하세요.'};
}
function releaseFmt(v,measure){
 if(v==null)return '—';
 const s=String(measure||'');
 return fmt(v)+(s.includes('%')?'%':'');
}
function surpriseRead(key,m){
 if(m?.value_role==='official_forecast')return '공식기관 전망입니다. 실제 발표치·시장 예상치와 surprise를 비교하지 않습니다.';
 const r=m?.release||{},a=n(r.actual),cns=n(r.consensus),g=guideFor(key,m);
 if(a==null||cns==null)return '예상치 또는 실제치가 없어 surprise 비교는 대기 중입니다.';
 const d=a-cns;
 if(Math.abs(d)<1e-9)return '실제치가 예상과 일치했습니다.';
 return (d>0?'예상 상회: ':'예상 하회: ')+(d>0?g.high:g.low);
}
function inject(){
 const tabs=q('#tabs'),main=q('main.wrap');if(!tabs||!main)return false;
 if(!q('button[data-tab="official-macro"]')){
   const b=document.createElement('button');b.dataset.tab='official-macro';b.textContent='공식 거시';
   const overview=q('button[data-tab="overview"]',tabs);overview?.insertAdjacentElement('afterend',b);
 }
 if(!q('#official-macro')){
   const s=document.createElement('section');s.className='panel';s.id='official-macro';
   s.innerHTML='<div class="card"><h3>Macro Official Data</h3><div class="meta obsMacroLoading">공식 거시데이터를 불러오는 중입니다…</div></div>';
   const overview=q('#overview');overview?.insertAdjacentElement('afterend',s);
 }
 if(!q('#officialMacroStyle')){
   const st=document.createElement('style');st.id='officialMacroStyle';st.textContent=`
#official-macro{min-width:0}.obsMacroHero{display:grid;grid-template-columns:1fr 1fr;gap:12px}.obsMacroCard{background:#fff;border:1px solid #e5ebf2;border-radius:16px;padding:14px;min-width:0}.obsMacroHead{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.obsMacroTitle{font-size:16px;font-weight:950}.obsMacroSub{font-size:10px;color:#718096;margin-top:3px}.obsMacroStatusGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:10px}.obsMacroStatus{border:1px solid #e7ecf2;border-radius:11px;padding:9px;background:#fafbfd;min-width:0}.obsMacroStatus small{display:block;color:#718096;font-size:9px;font-weight:800}.obsMacroStatus b{display:block;margin-top:4px;font-size:11px;overflow-wrap:anywhere}.obsMacroBadge{display:inline-flex;align-items:center;border-radius:999px;padding:4px 7px;font-size:9px;font-weight:900;background:#f2f4f7;color:#475467}.obsMacroBadge.live{background:#ecfdf3;color:#067647}.obsMacroBadge.pending{background:#f2f4f7;color:#667085}.obsMacroSection{margin-top:12px}.obsMacroGroup{background:#fff;border:1px solid #e5ebf2;border-radius:16px;overflow:hidden;margin-top:10px}.obsMacroGroup h4{margin:0;padding:12px 13px;background:#f8fafc;border-bottom:1px solid #e8edf3;font-size:13px}.obsMacroRow{display:grid;grid-template-columns:minmax(150px,1.45fr) repeat(5,minmax(72px,.72fr));gap:0;border-top:1px solid #edf1f5;cursor:pointer;align-items:center}.obsMacroRow:first-of-type{border-top:0}.obsMacroRow:hover{background:#fafcff}.obsMacroRow>div{padding:9px 8px;min-width:0;font-size:10px;overflow-wrap:anywhere}.obsMacroName{font-weight:900}.obsMacroName small{display:block;color:#718096;font-size:8px;font-weight:700;margin-top:2px}.obsMacroOpen{display:inline-flex;margin-top:6px;border:1px solid #bfd2ff;background:#eef4ff;color:#175cd3;border-radius:7px;padding:4px 7px;font-size:8px;font-weight:900;cursor:pointer}.obsMacroRow.selected{background:#f8fbff;box-shadow:inset 3px 0 0 #175cd3}.obsMacroCell b{display:block;font-size:11px}.obsMacroCell span{font-size:8px;color:#8090a3}.obsMacroDetail{margin-top:12px;background:#fff;border:1px solid #e5ebf2;border-radius:16px;padding:14px}.obsMacroDetailHead{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.obsMacroKpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;margin:10px 0}.obsMacroKpi{background:#f8fafc;border:1px solid #e8edf3;border-radius:10px;padding:9px;min-width:0}.obsMacroKpi small{display:block;font-size:8px;color:#718096}.obsMacroKpi b{display:block;margin-top:3px;font-size:12px;overflow-wrap:anywhere}.obsMacroChart{height:330px;position:relative}.obsMacroRange{display:flex;gap:5px;flex-wrap:wrap;margin:7px 0}.obsMacroRange button{border:1px solid #d8e0e9;background:#fff;border-radius:8px;padding:5px 8px;font-size:9px;font-weight:850}.obsMacroRange button.on{background:#eef4ff;color:#175cd3;border-color:#bfd2ff}.obsMacroNotes{font-size:9px;color:#667085;line-height:1.55;margin-top:8px}.obsMacroQuality{margin-top:10px;padding:9px 10px;border-radius:10px;background:#f8fafc;font-size:9px;color:#667085}.obsMacroSource{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}.obsMacroSource span{border:1px solid #dfe6ee;border-radius:999px;padding:4px 7px;font-size:8px;font-weight:850;background:#fff}.obsMacroInfo{margin-top:10px;padding:9px 10px;border-left:3px solid #98a2b3;background:#f8fafc;font-size:9px;color:#667085;line-height:1.5}.obsMacroExplain{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0}.obsMacroExplain>div{background:#f8fafc;border:1px solid #e5ebf2;border-radius:10px;padding:10px;font-size:9px;line-height:1.55;color:#475467}.obsMacroExplain b{display:block;color:#1d2939;font-size:10px;margin-bottom:3px}.obsMacroSurprise{margin:8px 0 10px;padding:10px;border-radius:10px;background:#fff7ed;border:1px solid #fed7aa;font-size:9px;line-height:1.5;color:#9a3412}.obsMacroChartHead{display:flex;justify-content:space-between;align-items:flex-end;gap:8px;margin-top:10px}.obsMacroChartHead b{font-size:12px}.obsMacroChartHead span{font-size:8px;color:#7d8b9d}
@media(max-width:760px){.obsMacroHero{grid-template-columns:1fr}.obsMacroExplain{grid-template-columns:1fr}.obsMacroStatusGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.obsMacroRow{grid-template-columns:minmax(130px,1.5fr) repeat(2,minmax(68px,.8fr))}.obsMacroRow>div:nth-child(n+4){display:none}.obsMacroKpis{grid-template-columns:repeat(2,minmax(0,1fr))}.obsMacroChart{height:300px}.obsMacroDetailHead{display:block}.obsMacroGroup{overflow-x:hidden}}
`;
   document.head.appendChild(st);
 }
 return true;
}
function statusCard(label,obj){
 const c=obj?.color||'GRAY',r=obj?.regime||'DATA_PENDING';
 return '<div class="obsMacroStatus"><small>'+esc(label)+'</small><b>'+esc(COLORS[c]||'⚪')+' '+esc(r)+'</b></div>';
}
function metric(key){return DATA?.metrics?.[key]||null}
function currentValue(m){
 const x=m?.latest||{};
 if(m?.key==='US_FED_FUNDS'&&x.lower!=null&&x.upper!=null)return fmt(x.lower)+'–'+fmt(x.upper)+'%';
 if(x.yoy!=null&&['US_CPI','US_CORE_CPI','US_PCE','US_CORE_PCE','KR_CPI','KR_CORE_CPI'].includes(m?.key))return fmt(x.yoy)+'%';
 if(x.value==null)return '—';
 return fmt(x.value)+(m?.unit&&String(m.unit).includes('%')?'%':(String(m?.unit||'').startsWith('K')?'천 명':(m?.unit==='USD million'?'백만 USD':'')));
}
function trendValue(m){
 const x=m?.latest||{};
 if(x.ann_3m!=null)return fmt(x.ann_3m)+'%';
 if(x.avg_3m!=null)return fmt(x.avg_3m);
 if(x.qoq!=null)return fmt(x.qoq)+'%';
 return '—';
}
function rowHtml(k){
 const m=metric(k);if(!m)return'';
 const src=m.primary_source?.institution||m.primary_source?.name||'';
 const r=m.release||{};
 const cls=m.status==='LIVE'?'live':'pending';
 return '<div class="obsMacroRow" data-macro-key="'+esc(k)+'">'+
  '<div class="obsMacroName">'+esc(m.name||k)+' <span class="obsMacroBadge '+cls+'">'+esc(src)+'</span><small>'+esc(m.status||'')+'</small><button type="button" class="obsMacroOpen">📈 그래프 · 의미</button></div>'+
  '<div class="obsMacroCell"><span>'+ (m.value_role==='official_forecast'?'공식 전망 · '+esc(m.forecast_horizon):'실제 · '+esc((m.latest?.period||'').slice(0,7))) +'</span><b>'+esc(currentValue(m))+'</b></div>'+
  '<div class="obsMacroCell"><span>이전</span><b>'+esc(r.previous==null?'—':fmt(r.previous))+'</b></div>'+
  '<div class="obsMacroCell"><span>예상</span><b>'+esc(r.consensus==null?'—':fmt(r.consensus))+'</b></div>'+
  '<div class="obsMacroCell"><span>Surprise</span><b>'+esc(r.surprise==null?'—':signed(r.surprise))+'</b></div>'+
  '<div class="obsMacroCell"><span>최근 3M</span><b>'+esc(trendValue(m))+'</b></div></div>';
}
function groupHtml(country,key,label){
 const g=DATA?.macro?.official?.[country]?.[key]||{};const ks=g.metrics||[];
 return '<div class="obsMacroGroup"><h4>'+esc(label)+' · '+esc(COLORS[g.regime?.color]||'⚪')+' '+esc(g.regime?.regime||'')+'</h4>'+ks.map(rowHtml).join('')+'</div>';
}
function render(){
 const panel=q('#official-macro');if(!panel||!DATA)return;
 const us=DATA.regimes?.us||{},kr=DATA.regimes?.kr||{};
 panel.innerHTML='<div class="obsMacroHero">'+
 '<div class="obsMacroCard"><div class="obsMacroHead"><div><div class="obsMacroTitle">🇺🇸 US MACRO</div><div class="obsMacroSub">Fed · BLS · BEA 공식치 / FRED 전송계층</div></div><span class="obsMacroBadge live">OFFICIAL</span></div><div class="obsMacroStatusGrid">'+GROUPS.us.map(x=>statusCard(x[1],us[x[0]])).join('')+'</div></div>'+
 '<div class="obsMacroCard"><div class="obsMacroHead"><div><div class="obsMacroTitle">🇰🇷 KR MACRO</div><div class="obsMacroSub">한국은행 · 통계청 · 관세/산업부 공식치</div></div><span class="obsMacroBadge live">OFFICIAL</span></div><div class="obsMacroStatusGrid">'+GROUPS.kr.map(x=>statusCard(x[1],kr[x[0]])).join('')+'</div></div></div>'+
 '<div class="obsMacroInfo"><b>사용법:</b> 각 지표의 <b>📈 그래프 · 의미</b>를 누르면 해당 지표 바로 아래에 장기 그래프와 발표수치 해설이 열립니다. Actual=실제 발표치, Previous=이전 발표치, Consensus=시장 예상치, Surprise=실제치-예상치입니다.</div>'+
 '<div class="obsMacroSection">'+GROUPS.us.map(x=>groupHtml('us',x[0],'US · '+x[1])).join('')+GROUPS.kr.map(x=>groupHtml('kr',x[0],'KR · '+x[1])).join('')+'</div>'+
 '<div class="obsMacroDetail" id="officialMacroDetail"><div class="meta">지표를 누르면 10년 히스토리 · 추세 · 출처 · revision/vintage를 표시합니다.</div></div>'+
 '<div class="obsMacroQuality">generated '+esc(DATA.generated_kst||'—')+' · live '+esc(DATA.quality?.live_metrics??0)+' · pending '+esc((DATA.quality?.pending_metrics||[]).length)+' · degraded '+esc((DATA.quality?.degraded_metrics||[]).length)+' · vintage keys '+esc(DATA.quality?.vintage_keys??0)+'</div>';
 qa('.obsMacroRow',panel).forEach(r=>r.onclick=()=>showDetail(r.dataset.macroKey));
 STATE.loaded=true;STATE.status='ACTIVE';
 const first=STATE.selected||'US_CORE_PCE';if(metric(first))showDetail(first);
}
function primarySeries(m){
 const hist=m?.history||[];
 const inflation=['US_CPI','US_CORE_CPI','US_PCE','US_CORE_PCE','KR_CPI','KR_CORE_CPI'].includes(m?.key);
 return {label:inflation?'YoY %':(m?.name||m?.key),points:hist.map(x=>({date:x.period,value:inflation?x.yoy:x.value})).filter(x=>n(x.value)!=null)};
}
function cutoff(points,range){
 if(!points.length||range==='ALL')return points;
 const last=new Date(points[points.length-1].date+'T00:00:00Z');const days={'3Y':1096,'5Y':1827,'10Y':3653}[range]||3653;
 last.setUTCDate(last.getUTCDate()-days);const cut=last.toISOString().slice(0,10);return points.filter(x=>x.date>=cut);
}
const markerPlugin={id:'officialMacroMarkers',afterDatasetsDraw(chart,args,opts){
 const marks=opts?.markers||[];const x=chart.scales.x;if(!x)return;const labels=chart.data.labels||[];const ctx=chart.ctx;
 ctx.save();ctx.font='9px system-ui';ctx.fillStyle='#667085';ctx.strokeStyle='#c9d3df';ctx.lineWidth=1;
 for(const m of marks){let i=labels.findIndex(d=>String(d)>=m.date);if(i<0)continue;const px=x.getPixelForValue(i);ctx.beginPath();ctx.moveTo(px,chart.chartArea.top);ctx.lineTo(px,chart.chartArea.bottom);ctx.stroke();ctx.save();ctx.translate(px+3,chart.chartArea.top+10);ctx.rotate(-Math.PI/2);ctx.fillText(m.label,0,0);ctx.restore();}
 ctx.restore();
}};
function drawDetailChart(m){
 const c=q('#officialMacroChart');if(!c||typeof Chart==='undefined')return;
 if(STATE.chart){STATE.chart.destroy();STATE.chart=null}
 const ps=primarySeries(m),pts=cutoff(ps.points,STATE.range);
 STATE.chart=new Chart(c,{type:'line',data:{labels:pts.map(x=>x.date),datasets:[{label:ps.label,data:pts.map(x=>x.value),borderWidth:2,pointRadius:pts.length<2?3:0,tension:.12,spanGaps:true}]},plugins:[markerPlugin],options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:true,position:'bottom'},officialMacroMarkers:{markers:DATA?.historical_markers||[]}},scales:{x:{ticks:{maxTicksLimit:7,font:{size:9},callback:function(v){const s=this.getLabelForValue(v);return String(s).slice(0,7)}},grid:{color:'#eef2f6'}},y:{ticks:{maxTicksLimit:6,font:{size:9}},grid:{color:'#e8edf3'}}}}});
}
function kpi(label,val){return '<div class="obsMacroKpi"><small>'+esc(label)+'</small><b>'+esc(val==null?'—':val)+'</b></div>'}
function showDetail(key){
 const m=metric(key),box=q('#officialMacroDetail');if(!m||!box)return;STATE.selected=key;
 const l=m.latest||{},r=m.release||{},g=guideFor(key,m);const vint=r.vintage_history||[];
 const src=[m.primary_source?.name||m.primary_source?.institution,m.transport_source?.provider,m.transport_source?.series_id].filter(Boolean);
 const row=q('.obsMacroRow[data-macro-key="'+key+'"]');
 if(row){row.insertAdjacentElement('afterend',box);qa('.obsMacroRow',q('#official-macro')).forEach(x=>x.classList.toggle('selected',x===row));}
 box.innerHTML='<div class="obsMacroDetailHead"><div><div class="obsMacroTitle">'+esc(m.name||key)+'</div><div class="obsMacroSub">'+esc(key)+' · '+esc(m.frequency||'')+' · '+esc(m.status||'')+'</div><div class="obsMacroSource">'+src.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div></div><span class="obsMacroBadge '+(m.status==='LIVE'?'live':'pending')+'">'+esc(m.primary_source?.institution||'OFFICIAL')+'</span></div>'+
 '<div class="obsMacroKpis">'+
  kpi('현재 추세값',currentValue(m))+kpi(m.value_role==='official_forecast'?'공식 전망 ('+m.forecast_horizon+')':'발표 Actual',releaseFmt(m.value_role==='official_forecast'?r.forecast:r.actual,r.measure))+kpi('Previous',releaseFmt(r.previous,r.measure))+kpi('Consensus',releaseFmt(r.consensus,r.measure))+kpi('Surprise',r.surprise==null?'—':signed(r.surprise))+kpi('발표 기준',r.measure||m.unit||'—')+
  kpi('3M annualized / avg',l.ann_3m!=null?fmt(l.ann_3m)+'%':(l.avg_3m!=null?fmt(l.avg_3m):'—'))+kpi('6M annualized / avg',l.ann_6m!=null?fmt(l.ann_6m)+'%':(l.avg_6m!=null?fmt(l.avg_6m):'—'))+
  kpi('1Y 평균',m.historical_position?.avg_1y==null?'—':fmt(m.historical_position.avg_1y))+
  kpi('5Y 평균',m.historical_position?.avg_5y==null?'—':fmt(m.historical_position.avg_5y))+
  kpi('코로나 전 평균',m.historical_position?.pre_covid_avg==null?'—':fmt(m.historical_position.pre_covid_avg))+
  kpi('목표 / 기준',m.target==null?'—':fmt(m.target)+(m.unit&&String(m.unit).includes('%')?'%':''))+'</div>'+
 (m.projections?'<div class="obsMacroNotes"><b>연도별 공식 전망</b><br>'+Object.entries(m.projections).map(([label,years])=>esc(label)+': '+Object.entries(years).map(([year,value])=>esc(year)+' '+fmt(value)+'%').join(' · ')).join('<br>')+'</div>':'')+
 '<div class="obsMacroExplain"><div><b>이 지표는 무엇?</b>'+esc(g.meaning)+'</div><div><b>높게 나오면</b>'+esc(g.high)+'</div><div><b>낮게 나오면</b>'+esc(g.low)+'</div><div><b>투자할 때 보는 포인트</b>'+esc(g.market)+'</div></div>'+
 '<div class="obsMacroSurprise"><b>이번 발표 읽는 법</b><br>'+esc(surpriseRead(key,m))+'</div>'+
 '<div class="obsMacroChartHead"><b>📈 '+esc(m.name||key)+(m.value_role==='official_forecast'?' 발표별 전망 기록':' 장기 추이')+'</b><span>확보 기간 '+esc((m.history?.[0]?.period||'—'))+' ~ '+esc(m.latest?.period||'—')+'</span></div>'+
 '<div class="obsMacroRange">'+['3Y','5Y','10Y','ALL'].map(x=>'<button data-macro-range="'+x+'" class="'+(STATE.range===x?'on':'')+'">'+x+'</button>').join('')+'</div>'+
 '<div class="obsMacroChart"><canvas id="officialMacroChart"></canvas></div>'+
 '<div class="obsMacroNotes"><b>Actual SSOT:</b> '+esc(m.primary_source?.name||m.primary_source?.institution||'—')+' · <b>Consensus:</b> '+esc(r.consensus_source?.provider||'별도 시장데이터')+'<br>'+
 (m.note?esc(m.note)+'<br>':'')+
 (m.source_url||m.transport_source?.url?'<a target="_blank" rel="noopener" href="'+esc(m.source_url||m.transport_source.url)+'">공식 원문</a> · ':'')+
 '확인 '+esc(m.checked_kst||'—')+'<br>'+
 (m.value_role==='official_forecast'?'전망 발표별 기록이며, 10년 시계열 확보 여부는 표시된 확보 기간을 따릅니다.<br>':'')+
 (m.error?'수집 지연: '+esc(m.error)+'<br>':'')+
 '<b>Vintage:</b> '+(vint.length?vint.map(x=>esc(x.version)+' '+esc(x.value)).join(' → '):'기록 대기')+'</div>';
 qa('button[data-macro-range]',box).forEach(b=>b.onclick=()=>{STATE.range=b.dataset.macroRange;qa('button[data-macro-range]',box).forEach(x=>x.classList.toggle('on',x===b));drawDetailChart(m)});
 drawDetailChart(m);
}
async function load(){
 try{
  const r=await fetch('./data/official-macro.json?cb='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('official-macro '+r.status);
  DATA=await r.json();if(DATA?.schema!=='JJOONI_OFFICIAL_MACRO_V1')throw new Error('official-macro schema');
  render();
 }catch(e){STATE.status='ACTIVE_DEGRADED';STATE.error=String(e);const p=q('#official-macro');if(p&&!DATA)p.innerHTML='<div class="card"><h3>Macro Official Data</h3><div class="meta">공식 거시데이터 생성 대기 · '+esc(String(e))+'</div></div>';console.warn(e)}
}
function boot(){if(!inject()){setTimeout(boot,200);return}load()}
boot();
setInterval(()=>{if(!document.hidden)load()},120000);
})();
