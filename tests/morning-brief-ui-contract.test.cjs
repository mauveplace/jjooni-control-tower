const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync('market-observatory/morning-brief-v1.js','utf8');
const html=fs.readFileSync('market-observatory/index.html','utf8');
const start=src.indexOf('function viewState('),end=src.indexOf('\nfunction render(d){',start);
assert.ok(start>=0&&end>start,'real reader exposes pure publication-state helper');
const fn=src.slice(start,end);
const verified={
 report_date_kst:'2026-11-07',market_date_us:'2026-11-06',
 content_status:'WEB_VERIFIED_WITH_DISCLOSED_GAPS',
 revisions:[{revised_at_kst:'2026-11-09T06:45:00+09:00'}],
 editorial_contract:{interpretation_status:'HISTORIC_NARRATIVE_NOT_RECALCULATED_AFTER_EOD_CORRECTION',
  close_checks:[{symbol:'NDX',status:'VERIFIED',close:26989.99,change_pct:1.35},
  {symbol:'SOX',status:'VERIFIED',close:9390.25,change_pct:4.21}]}
};
function view(d,selected='latest',now='2026-11-09'){
 return vm.runInNewContext(fn+'\nviewState(d,selected,now)',{d,selected,now});
}
test('Monday shows Saturday final public brief without calling it a current Monday market report',()=>{
 const x=view(verified);
 assert.equal(x.badge,'마지막 게시본 · 2026-11-07');
 assert.match(x.notice,/월요일.*별도 투자보드/);
 assert.match(x.notice,/26,989\.99/);assert.match(x.notice,/9,390\.25/);
 assert.match(x.notice,/재산출되지 않았습니다/);
 assert.doesNotMatch(x.notice,/CROSS_CHECKED/);
});
test('verified correction is not downgraded to missing source, or presented as original TRI-POD signal',()=>{
 const x=view(verified,'latest','2026-11-10');
 assert.deepEqual(Array.from(x.conflicts),[]);
 assert.match(x.notice,/11-09 공식 종가 정정/);
 assert.match(x.notice,/매매 판단에 사용하지 마세요/);
});
test('unverified conflict remains clearly labeled and cannot display a close',()=>{
 const d=JSON.parse(JSON.stringify(verified));
 d.editorial_contract.interpretation_status='HISTORIC_NARRATIVE_NOT_RECALCULATED';
 d.editorial_contract.close_checks[0]={symbol:'NDX',status:'CONFLICT',close:null,change_pct:null};
 const x=view(d,'latest','2026-11-09');
 assert.deepEqual(Array.from(x.conflicts),['NDX']);
 assert.match(x.notice,/확정 종가 불일치\/미검증/);
});
test('selected historical report is never mislabeled as most recently published',()=>{
 assert.equal(view(verified,'2026-11-07','2026-11-09').badge,'보관 기록 · 2026-11-07');
});
test('mobile reader has correction detail, consistent latest-publication wording and cache bust',()=>{
 assert.match(src,/검증 근거·정정 이력 펼쳐보기/);
 assert.match(src,/briefSourceDetails/);
 assert.match(src,/briefTools\{display:grid/);
 assert.match(src,/공식 EOD 확인/);
 assert.match(html,/morning-brief-v1\.js\?v=20261110-reference-prices-v1/);
 assert.match(html,/<option value="latest">최신 공개본<\/option>/);
});

const quoteStart=src.indexOf('function figureQuote('),quoteEnd=src.indexOf('\nfunction render(d){',quoteStart);
assert.ok(quoteStart>=0&&quoteEnd>quoteStart,'reference quote projection helper must exist');
const quoteFn=src.slice(quoteStart,quoteEnd);
function quote(c,ref,session='2026-11-09'){
 const d={market_date_us:session,editorial_contract:{reference_quotes:ref?[ref]:[]}};
 return vm.runInNewContext(quoteFn+'\nfigureQuote(c,d)',{c,d});
}
const ndxRef={symbol:'NDX',session_date:'2026-11-09',status:'PROVIDER_REFERENCE_ONLY',
 official_eod_verified:false,trade_signal_eligible:false,close:27907.63,change_pct:3.40,
 source_observations:[{url:'https://finance.yahoo.com/'},{url:'https://ycharts.com/'}]};
test('strict CONFLICT can show a clearly labeled provider reference, not an authoritative close',()=>{
 const x=quote({symbol:'NDX',status:'CONFLICT',close:null,change_pct:null},ndxRef);
 assert.equal(x.value,27907.63);assert.equal(x.pct,3.40);assert.equal(x.reference,true);
 assert.match(src,/참고 완료 일봉 \/ 공식 종가 미검증/);
 assert.match(src,/매매 신호 사용 금지/);
});
test('reference never overrides VERIFIED, another session, or a live trading signal',()=>{
 const official=quote({symbol:'NDX',status:'VERIFIED',close:28000,change_pct:1},ndxRef);
 assert.equal(official.value,28000);assert.equal(official.reference,false);
 const other=quote({symbol:'NDX',status:'CONFLICT',close:null,change_pct:null},ndxRef,'2026-11-06');
 assert.equal(other.value,null);
 const unsafe=quote({symbol:'NDX',status:'CONFLICT',close:null,change_pct:null},{...ndxRef,trade_signal_eligible:true});
 assert.equal(unsafe.value,null);
});
test('missing reference never turns CONFLICT into an invented value',()=>{
 const x=quote({symbol:'SOX',status:'CONFLICT',close:null,change_pct:null},null);
 assert.equal(x.value,null);assert.equal(x.reference,false);
});


const supplementStart=src.indexOf('function canonicalSupplement(');
const supplementEnd=src.indexOf('\nfunction render(d){',supplementStart);
assert.ok(supplementStart>=0&&supplementEnd>supplementStart,'reader must expose a pure same-session catch-up projector');
const supplementFn=src.slice(supplementStart,supplementEnd);
const reportRace={report_date_kst:'2026-11-14',market_date_us:'2026-11-13',
 published_kst:'2026-11-14T06:32:48+09:00',body_markdown:'VIX10 미확인',
 editorial_contract:{close_checks:[{symbol:'NDX',status:'MISSING',close:null,change_pct:null},
  {symbol:'SOX',status:'MISSING',close:null,change_pct:null}]}};
const glanceCatchup={generated_kst:'2026-11-14T06:36:45+09:00',source_generated_kst:'2026-11-14T06:34:06+09:00',
 us_session:'2026-11-13',no_trade:true,consistency:{status:'OK'},
 tripod:{session:'2026-11-13',ndx:27943.74,pod:'BIPOD',
  vix10:20.73,ma250:27505.80,drawdown_52w_pct:-10.51},
 groups:[{name:'미국',items:[{key:'NASDAQ100',date:'2026-11-13',value:27943.7363,d1_pct:-1.22}]}]};
const pulseCatchup={generated_kst:'2026-11-14T06:34:38+09:00',market_date_us:'2026-11-13',
 read_only:true,snapshot_status:'FINAL',session_gate:{aligned:true,core_dates:{NASDAQ100:'2026-11-13'}},
 raw:{tradingview_cross_asset:{ndx:{value:27943.73632812,change_pct:-1.221148897,
  market_date:'2026-11-13'}}}};
function projection(d=reportRace,g=glanceCatchup,p=pulseCatchup){
 return vm.runInNewContext(supplementFn+'\ncanonicalSupplement(d,g,p)',
  {d,g,p,Date});
}
test('2026-11-14 race: later completed-session canonical values are visible as NON-TRADE references',()=>{
 const x=projection();
 assert.ok(x);
 assert.equal(x.session,'2026-11-13');
 assert.equal(x.late,true);
 assert.equal(x.ndx,27943.73632812);
 assert.equal(x.vix10,20.73);
 assert.equal(x.ma250,27505.80);
 assert.equal(x.dd,-10.51);
 assert.equal(x.tradeEligible,false);
 assert.equal(x.officialEodVerified,false);
 assert.match(src,/NO_TRADE_REVIEW_ONLY/);
 assert.match(src,/원장 후속 갱신/);
 assert.match(src,/공식 EOD 미검증/);
});
test('no source-session mixing or missing FINAL gate can surface a current NDX',()=>{
 const clone=x=>JSON.parse(JSON.stringify(x));
 let g=clone(glanceCatchup);g.us_session='2026-11-12';assert.equal(projection(reportRace,g),null);
 g=clone(glanceCatchup);g.consistency.status='ERROR';assert.equal(projection(reportRace,g),null);
 g=clone(glanceCatchup);g.no_trade=false;assert.equal(projection(reportRace,g),null);
 let p=clone(pulseCatchup);p.session_gate.aligned=false;assert.equal(projection(reportRace,glanceCatchup,p),null);
 p=clone(pulseCatchup);p.snapshot_status='PROVISIONAL';assert.equal(projection(reportRace,glanceCatchup,p),null);
 p=clone(pulseCatchup);p.market_date_us='2026-11-12';assert.equal(projection(reportRace,glanceCatchup,p),null);
});
test('conflicting NDX independent source and untrusted/early source timestamps never auto-upgrade',()=>{
 const clone=x=>JSON.parse(JSON.stringify(x));
 let p=clone(pulseCatchup);p.raw.tradingview_cross_asset.ndx.value=28042;
 assert.equal(projection(reportRace,glanceCatchup,p),null);
 let g=clone(glanceCatchup);g.groups[0].items[0].d1_pct=1.5;
 assert.equal(projection(reportRace,g),null);
 g=clone(glanceCatchup);g.source_generated_kst='2026-11-14T07:30:00+09:00';
 assert.equal(projection(reportRace,g),null);
 g=clone(glanceCatchup);g.tripod.vix10=null;assert.equal(projection(reportRace,g),null);
});
test('historic reports without missing inputs are not amended and SOX is not invented',()=>{
 const d={...reportRace,body_markdown:'최종 값 확인',editorial_contract:{
  close_checks:[{symbol:'NDX',status:'VERIFIED',close:27943.74},{symbol:'SOX',status:'VERIFIED',close:10168.99}]}};
 assert.equal(projection(d),null);
 assert.doesNotMatch(supplementFn,/SOX.+close\s*[:=]/);
 assert.match(src,/SOURCE_GLANCE=results\[2\]/);
 assert.match(src,/SOURCE_PULSE=results\[3\]/);
 assert.match(html,/sync=20261114-canonical-catchup/);
});

test('optional SOX market bar only appears as a single-source reference on exact same session',()=>{
 const g=JSON.parse(JSON.stringify(glanceCatchup));
 g.groups[0].items.push({key:'SOX',date:'2026-11-13',value:10168.99,d1_pct:-3.21,source:'Yahoo ^SOX completed daily (single provider)',comparison_status:'SAME_PREVIOUS_US_SESSION'});
 let x=projection(reportRace,g);
 assert.equal(x.sox,10168.99);
 assert.equal(x.soxPct,-3.21);
 assert.equal(x.officialEodVerified,false);
 assert.equal(x.tradeEligible,false);
 assert.match(src,/SOX는 Yahoo 일봉 단일원천 참고값/);
 g.groups[0].items.at(-1).date='2026-11-12';
 x=projection(reportRace,g);
 assert.equal(x.sox,null);assert.equal(x.ndx,27943.73632812);
 g.groups[0].items.at(-1).date='2026-11-13';
 g.groups[0].items.at(-1).value=NaN;
 x=projection(reportRace,g);
 assert.equal(x.sox,null);
 g.groups[0].items.at(-1).value=10168.99;
 g.groups[0].items.at(-1).comparison_status='PRIOR_SESSION_UNVERIFIED';
 g.groups[0].items.at(-1).d1_pct=null;
 x=projection(reportRace,g);
 assert.equal(x.sox,10168.99);
 assert.equal(x.soxPct,null);
 g.groups[0].items.at(-1).source='Unverified visitor quote';
 x=projection(reportRace,g);
 assert.equal(x.sox,null);
});
