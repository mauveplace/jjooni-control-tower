(()=>{
'use strict';
const DATA_URL='./data/market-regime.json';
const el=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const pct=v=>v==null?'—':Number(v).toFixed(2)+'%';
const badge=(label,tone='neutral')=>'<span class="mrBadge '+tone+'">'+esc(label)+'</span>';
function freshness(d){
  const end=Date.parse(d?.effective_window?.end_kst||'');
  if(!Number.isFinite(end)) return 'UNKNOWN';
  return Date.now()<=end?'ACTIVE':'EXPIRED';
}
function render(d){
  const root=el('#regimeRoot'); if(!root)return;
  const state=freshness(d), n=d.weekly_ev?.nasdaq||{}, k=d.weekly_ev?.kospi||{}, t=d.triggers||{}, s=d.semiconductor||{}, r=d.research_overlay||{};
  const pulse=el('#pulse');
  if(pulse && !el('#mrPulse')){
    const x=document.createElement('span'); x.id='mrPulse'; x.className='chip';
    x.textContent='REGIME '+(d.regime?.code||'—').replaceAll('_',' ');
    pulse.appendChild(x);
  }
  const bond=t.bond_stress||{}, actions=d.actions||{};
  root.innerHTML=
    '<div class="mrTop">'+
      '<div>'+badge(state,state==='ACTIVE'?'ok':'warn')+badge(d.source?.version||'—')+'</div>'+
      '<div class="mrHeadline">'+esc(d.ui?.headline_ko||'—')+'</div>'+
      '<div class="meta">기준 '+esc(d.source?.generated_kst||'—')+' · 유효 '+esc(d.effective_window?.start_kst||'—')+' → '+esc(d.effective_window?.end_kst||'—')+'</div>'+
    '</div>'+
    '<div class="mrGrid">'+
      '<div class="mrBox"><small>NASDAQ 1주 EV</small><b>'+pct(n.ev_pct)+'</b><span>'+esc(n.band||'—')+'</span></div>'+
      '<div class="mrBox"><small>KOSPI 1주 EV</small><b>'+pct(k.ev_pct)+'</b><span>'+esc(k.band||'—')+'</span></div>'+
      '<div class="mrBox"><small>반도체 등급</small><b>'+esc(s.current_grade||'—')+'</b><span>2개 점등→S− · 3개→A</span></div>'+
      '<div class="mrBox"><small>Bond Stress</small><b>'+esc(bond.current_state||'—')+'</b><span>10Y 5.25% OR 30Y 5.50%</span></div>'+
    '</div>'+
    (r.status?(
      '<div class="mrSection mrResearch"><h4>금리 Driver 연구 오버레이 '+badge('RESEARCH ONLY','warn')+'</h4>'+
        '<div class="mrGrid mrResearchGrid">'+
          '<div class="mrBox"><small>주식 레짐</small><b>'+esc(r.equity_regime?.label_ko||'—')+'</b><span>'+esc(r.equity_regime?.interpretation_ko||'')+'</span></div>'+
          '<div class="mrBox"><small>금리 레짐</small><b>'+esc(r.rate_regime?.display_label_ko||'—')+'</b><span>'+esc(r.rate_regime?.interpretation_ko||'')+'</span></div>'+
          '<div class="mrBox"><small>Credit Modifier</small><b>'+esc(r.credit_modifier?.label_ko||'—')+'</b><span>'+esc(r.credit_modifier?.interpretation_ko||'')+'</span></div>'+
          '<div class="mrBox"><small>공식판 영향</small><b>'+(r.weekly_ssot_unchanged?'없음':'확인 필요')+'</b><span>이번 주 '+esc(r.weekly_ssot_version||'')+' 판정·확률·행동 유지</span></div>'+
        '</div>'+
        '<div class="mrRule"><b>Primary Driver</b><span>'+esc(r.rate_regime?.primary_label_ko||'—')+' · Secondary: '+esc(r.rate_regime?.secondary_label_ko||'—')+'</span></div>'+
        '<div class="mrRule"><b>Credit 속도/수준</b><span>HY OAS '+esc(r.credit_modifier?.current_reference?.hy_oas_pct??'—')+'% · 5D '+esc(r.credit_modifier?.current_reference?.five_day_change_bp??'—')+'bp · 1D '+esc(r.credit_modifier?.current_reference?.one_day_change_bp??'—')+'bp · 수준 '+esc(r.credit_modifier?.current_reference?.three_year_level_percentile??'—')+'백분위</span></div>'+
        '<div class="mrRule"><b>해석 원칙</b><span>'+esc(r.driver_framework?.credit_rule_ko||'')+'</span></div>'+
        '<div class="mrRule"><b>v11.5 후보</b><span>'+esc(r.bond_stress_design?.v115_candidate_ko||'')+'</span></div>'+
        '<div class="mrTimeline">'+
          (r.next_checks||[]).map(x=>'<div><b>'+esc((x.kst||'').slice(5,16).replace('T',' '))+' '+esc(x.item||'')+'</b><span>'+esc(x.purpose_ko||'')+'</span></div>').join('')+
        '</div>'+
        '<div class="mrNote"><b>연구 메모</b><br>'+esc(r.note_ko||'')+'</div>'+
      '</div>'
    ):'')+
    '<div class="mrSection"><h4>이번 주 행동</h4><div class="mrActions">'+
      '<div>정기 DCA <b>'+esc(actions.regular_dca||actions.dca||'—')+'</b></div>'+
      '<div>비정기 레버리지 <b>'+esc(actions.irregular_leverage_add||'—')+'</b></div>'+
      '<div>월요일 시초 <b>'+esc(actions.monday_open||'—')+'</b></div>'+
      '<div>반도체 코어 <b>'+esc(actions.semiconductor_core||'—')+'</b></div>'+
    '</div></div>'+
    '<div class="mrSection"><h4>핵심 트리거</h4>'+
      '<div class="mrRule"><b>Bond Stress</b><span>10Y ≥ 5.25% 또는 30Y ≥ 5.50% · H.15 확인 시 CONFIRMED</span></div>'+
      '<div class="mrRule"><b>Macro Stress</b><span>Bond Stress / Core PCE YoY ≥ 3.5% / NFP ≥ 20만 중 2개</span></div>'+
      '<div class="mrRule"><b>OIL-WATCH</b><span>WTI Dec-27 ≥ $75 3거래일 또는 Brent 근월 ≥ $110 종가</span></div>'+
      '<div class="mrRule"><b>VIX / VKOSPI</b><span>VIX는 미국 상관쇼크 · VKOSPI는 한국 변동성/TAIL 전용</span></div>'+
    '</div>'+
    '<div class="mrSection"><h4>반도체 S → S− → A</h4>'+
      (s.downgrade_conditions||[]).map(x=>'<div class="mrRule"><b>'+esc(x.id)+'</b><span>'+esc(x.definition)+'</span></div>').join('')+
    '</div>'+
    '<div class="mrSection"><h4>체크 순서</h4><div class="mrTimeline">'+
      (d.checkpoints||[]).map(x=>'<div><b>'+esc(x.order)+'. '+esc(x.label)+'</b><span>'+esc(x.purpose||'')+'</span></div>').join('')+
    '</div></div>'+
    '<div class="mrNote"><b>'+esc(d.regime?.label_ko||'')+'</b><br>'+esc(d.regime?.summary_ko||'')+'<br><br><b>PB 경계:</b> '+esc(d.consumer_contract?.rule||'')+'</div>';
  const meta=el('.obsRegimeLoading');
  if(meta) meta.textContent='시장판단 SSOT · 계좌/주문 SSOT와 분리 · PB는 읽기 전용 참고';
}
async function load(){
  try{
    const r=await fetch(DATA_URL+'?cb='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw new Error('market-regime '+r.status);
    const d=await r.json();
    if(d.schema!=='JJOONI_MARKET_REGIME_V1')throw new Error('schema mismatch');
    render(d);
    window.__JJOONI_MARKET_REGIME=d;
  }catch(e){
    const root=el('#regimeRoot'); if(root) root.innerHTML='<div class="mrNote">Market Regime 데이터 연결을 확인 중입니다.</div>';
    console.warn(e);
  }
}
const style=document.createElement('style');
style.textContent=`
#regimeRoot{margin-top:12px}.mrTop{display:grid;gap:7px}.mrHeadline{font-size:20px;font-weight:950;line-height:1.25}.mrBadge{display:inline-flex;padding:4px 8px;border-radius:999px;background:#eef2f6;font-size:10px;font-weight:900;margin-right:5px}.mrBadge.ok{background:#ecfdf3;color:#067647}.mrBadge.warn{background:#fff4ed;color:#b54708}.mrGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}.mrBox{background:#f8fafc;border:1px solid #e9eef4;border-radius:12px;padding:10px}.mrBox small{display:block;color:#667085;font-size:9px;font-weight:850}.mrBox b{display:block;font-size:17px;margin:4px 0}.mrBox span{font-size:9px;color:#718096}.mrSection{margin-top:14px}.mrSection h4{margin:0 0 7px;font-size:13px}.mrActions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.mrActions>div,.mrRule,.mrTimeline>div{border:1px solid #e7ecf2;background:#fff;border-radius:10px;padding:8px 9px;font-size:11px}.mrRule{display:grid;grid-template-columns:120px 1fr;gap:8px;margin-bottom:6px}.mrRule span,.mrTimeline span{color:#667085}.mrTimeline{display:grid;gap:6px}.mrTimeline>div{display:grid;grid-template-columns:180px 1fr;gap:8px}.mrNote{margin-top:14px;padding:11px;border-radius:12px;background:#f6f8fb;border:1px solid #e7ecf2;font-size:10px;line-height:1.55;color:#475467}.mrResearch{padding:12px;border:1px solid #fedf89;background:#fffcf5;border-radius:14px}.mrResearch h4{display:flex;align-items:center;gap:6px}.mrResearchGrid{margin-bottom:9px}@media(max-width:760px){.mrGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.mrActions{grid-template-columns:1fr}.mrRule,.mrTimeline>div{grid-template-columns:1fr}.mrHeadline{font-size:17px}}
`;
document.head.appendChild(style);
window.addEventListener('load',load);
})();
