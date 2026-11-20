const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { model, enabled, rail, marketStrip, sectorChart } = require('../market-observatory/observatory-v3.js');
const { build: briefDigest, render: renderBriefDigest, css: briefCss } = require('../market-observatory/brief-visual-digest-v1.js');
const root = path.join(__dirname, '..', 'market-observatory');
const read = p => JSON.parse(fs.readFileSync(path.join(root, 'data', p), 'utf8'));
const fixture = () => ({glance:read('daily-glance.json'), freshness:read('freshness-status.json'),
  sector:read('sector-rotation-brief.json'), pulse:read('daily-market-pulse.json'),
  brief:read('morning-brief/latest.json')});
const now = f => Date.parse(f.generated_kst)+60000;
/* Visual-contract tests use an aligned synthetic publication. The live brief may
 * lag the new US close: that mismatch MUST remain a runtime verification HOLD. */
const sameSessionFixture=()=>{
 const f=fixture();
 f.brief={...f.brief,market_date_us:f.glance.us_session};
 return f;
};
// Visual tests must not depend on the instant at which independently published
// sector and glance snapshots happen to cross a US/KR session boundary.
// Keep the real published snapshots immutable; production alignment is checked
// separately and the runtime still fails closed on any mismatch.
const alignedVisualFixture=()=>{
 const f=fixture();
 f.sector=structuredClone(f.sector);
 f.sector.completed_cutoffs={...f.sector.completed_cutoffs,US:f.glance.us_session,KR:f.glance.us_session};
 for(const group of f.sector.groups||[]){
  for(const row of group.rows||[]){
   if(row.status==='OK')row.current_session=f.sector.completed_cutoffs[row.market];
  }
 }
 return f;
};
test('published sector snapshot is either session-aligned or explicitly held by V3',()=>{
 const f=fixture(),rows=(f.sector.groups||[]).flatMap(x=>x.rows||[]);
 assert.equal(rows.length,34,'published sector board must retain 34 rows');
 assert.equal(f.sector.groups.find(x=>x.key==='classic')?.rows?.length,11);
 assert.equal(f.sector.groups.find(x=>x.key==='kr_sector')?.rows?.length,10);
 const m=model(f.glance,f.freshness,f.sector,now(f.freshness));
 if(m.ready){
  const aligned=f.sector.completed_cutoffs?.US===f.glance.us_session
   &&f.sector.completed_cutoffs?.KR===f.glance.us_session
   &&rows.every(x=>x.status==='OK'&&x.current_session===f.sector.completed_cutoffs[x.market]
     &&typeof x.current_return_pct==='number'&&Number.isFinite(x.current_return_pct));
  assert.equal(m.sectorReady,aligned,'V3 must hold unaligned published sector data');
  assert.equal(m.sectors.length,aligned?11:0);
 }
});
// Build an explicit unverified-close scenario instead of assuming the live
// fixture will forever be unverified. Nasdaq official evidence legitimately
// changes daily; this is NOT a contract change and must never be rewritten by
// unrelated calendar publishing.
const unverifiedGlance = glance => {
 const g = structuredClone(glance);
 g.brief_check = {
  ...g.brief_check, status:'NOT_COMPARABLE', official_status:'MISSING',
  official_eod_verified:false, trade_signal_eligible:false
 };
 return g;
};
test('V3 is default while explicit V1/V2 remain available', () => {
 assert.equal(enabled('?ui=v3'), true);
 assert.equal(enabled('?ui=v2'), false);
 assert.equal(enabled(''), true);
 assert.equal(enabled('?ui=v1'), false);
});
test('V3 default does not mistake a verified integer official close for unverified', () => {
 const f=fixture(),g=structuredClone(f.glance);
 g.brief_check={
  status:'MATCH',source_date:g.us_session,match_rule:'INTEGER_PART_EQUAL',
  official_status:'VERIFIED',official_eod_verified:true,trade_signal_eligible:false
 };
 const m=model(g,f.freshness,f.sector,now(f.freshness));
 assert.equal(m.ready,true,m.reason);
 assert.equal(m.officialVerified,true);
 assert.equal(m.referenceOnly,false);
 assert.equal(m.noTrade,true);
 assert.match(rail(m),/Nasdaq 공식 종가/);
 assert.match(rail(m),/정수자리 일치 검증 완료/);
 assert.doesNotMatch(rail(m),/공식 종가 독립검증 대기/);
 const stale=model(unverifiedGlance(f.glance),f.freshness,f.sector,now(f.freshness));
 assert.equal(stale.officialVerified,false);
 assert.match(rail(stale),/독립검증 대기/);
});
test('V3 threshold numbers from same-session published canonical, never generated', () => {
 const f=alignedVisualFixture();
 f.glance=unverifiedGlance(f.glance);
 const m=model(f.glance,f.freshness,f.sector,now(f.freshness));
 assert.equal(m.ready,true,m.reason);
 assert.equal(m.session,f.glance.us_session);
 assert.equal(m.pod,f.glance.tripod.pod);
 assert.equal(m.axis.lower,f.glance.tripod.lines.ma250_lower);
 assert.equal(m.axis.upper,f.glance.tripod.lines.ma250_upper);
 assert.equal(m.axis.tri,f.glance.tripod.lines.tripod_return);
 assert.equal(m.ndx,f.glance.groups[0].items.find(x=>x.key==='NASDAQ100').value);
 assert.ok(m.points.lower<m.points.now&&m.points.now<m.points.upper&&m.points.upper<m.points.tri);
 assert.equal(m.officialVerified,false);
 assert.equal(m.referenceOnly,true);
 assert.equal(m.noTrade,true);
 assert.match(rail(m),/NO.*TRADE|주문 신호 아님/);
 assert.match(rail(m),/NO-POD 진입 고정 기준점·손절선 상세 보기/);
 assert.match(marketStrip(m),/MARKET QUOTES/);
 assert.equal(m.sectors.length,11);
 assert.match(sectorChart(m),/자금흐름 아님/);
});
test('V3 fail closed on stale freshness even if cached NDX looks plausible', () => {
 const f=fixture();
 const expired=Date.parse(f.freshness.generated_kst)+7200001;
 const m=model(unverifiedGlance(f.glance),f.freshness,f.sector,expired);
 assert.equal(m.ready,true);
 assert.equal(m.freshnessCurrent,false);
 assert.equal(m.referenceOnly,true);
 assert.equal(m.tradeEligible,undefined);
 assert.match(rail(m),/최신성 재확인 필요/);
});
test('published independent NDX verification is reflected without mutating source fixture', () => {
 const f=fixture(),m=model(f.glance,f.freshness,f.sector,now(f.freshness));
 assert.equal(m.ready,true,m.reason);
 const check=f.glance.brief_check||{};
 const current=check.status==='MATCH' && check.official_eod_verified===true
  && check.source_date===f.glance.us_session && check.match_rule==='INTEGER_PART_EQUAL';
 assert.equal(m.officialVerified,current);
 assert.equal(m.referenceOnly,!check.official_eod_verified);
 assert.equal(m.noTrade,true);
 const forced=unverifiedGlance(f.glance);
 assert.equal(model(forced,f.freshness,f.sector,now(f.freshness)).officialVerified,false);
 assert.notDeepEqual(forced.brief_check,f.glance.brief_check,
  'a test scenario may not mutate the published evidence');
});
test('V3 fail closed on wrong session, mismatched price, or non LIVE', () => {
 const f=fixture();
 const badSession=structuredClone(f.glance);badSession.us_session='2026-01-01';
 assert.equal(model(badSession,f.freshness,f.sector,now(f.freshness)).ready,false);
 const badPrice=structuredClone(f.glance);badPrice.tripod.ndx+=100;
 assert.equal(model(badPrice,f.freshness,f.sector,now(f.freshness)).ready,false);
 const stale=structuredClone(f.freshness);stale.groups.market.state='LAGGING';
 assert.equal(model(f.glance,stale,f.sector,now(stale)).ready,false);
});
test('V3 source mismatch suppresses sectors rather than forging capital flow', () => {
 const f=fixture(), s=structuredClone(f.sector);
 s.completed_cutoffs.US='2026-01-01';
 const m=model(f.glance,f.freshness,s,now(f.freshness));
 assert.equal(m.ready,true);
 assert.equal(m.sectorReady,false);
 assert.equal(m.sectors.length,0);
});
test('Morning-brief visual digest inherits the same published session, not historical fallback', () => {
 const f=sameSessionFixture();
 const m=briefDigest({brief:f.brief,glance:f.glance,pulse:f.pulse,sector:f.sector,latest:true});
 assert.equal(m.ready,true,m.reason);
 assert.equal(m.day,f.glance.us_session);
 assert.equal(m.referenceOnly,true);
 assert.equal(m.tradeEligible,false);
 assert.equal(m.axis.lower,f.glance.tripod.lines.ma250_lower);
 assert.equal(m.axis.tri,f.glance.tripod.lines.tripod_return);
 assert.equal(briefDigest({brief:f.brief,glance:f.glance,pulse:f.pulse,sector:f.sector,latest:false}).ready,false);
 const bad=structuredClone(f.pulse);bad.snapshot_status='PRELIMINARY';
 assert.equal(briefDigest({brief:f.brief,glance:f.glance,pulse:bad,sector:f.sector,latest:true}).ready,false);
});
test('V3 assets and script order: optional skin after V2, visual before morning brief', () => {
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const vis=html.indexOf('brief-visual-digest-v1.js');
 const morning=html.indexOf('morning-brief-v1.js');
 const nav=html.indexOf('observatory-nav-v2.js');
 const today=html.indexOf('today-v2.js');
 const v3=html.indexOf('observatory-v3.js');
 assert.ok(vis>0&&vis<morning);
 assert.ok(nav>0&&today>nav&&v3>today);
 const skin=fs.readFileSync(path.join(root,'observatory-v3.css'),'utf8');
 assert.match(skin,/body\.obsV3/);
 assert.ok(!skin.includes('body.navV2:not('),'V3 must not override V2 outside opt-in');
});

test('V3 visual digest preserves red gains / blue losses and only mounts for explicit opt-in', () => {
 const briefSrc=fs.readFileSync(path.join(root,'morning-brief-v1.js'),'utf8');
 assert.match(briefSrc,/!\['v1','v2'\]\.includes\(new URLSearchParams\(location\.search\)\.get\('ui'\)\)/);
 assert.match(briefCss,/\.bdVisual \.gain\{color:#ba322d\}/);
 assert.match(briefCss,/\.bdVisual \.loss\{color:#2759a0\}/);
 assert.match(briefCss,/\.bdSectorRow em\.loss\{background:#2759a0\}/);
 assert.doesNotMatch(briefCss,/\.bdVisual \.gain\{color:#137c57\}/);
});
test('V3 brief digest derives the NDX stage from the actual TRI-POD ledger and formats signed distance', () => {
 const f=sameSessionFixture(),host={hidden:true,innerHTML:''};
 f.glance.tripod.pod='TRIPOD';
 const n=f.glance.tripod.lines.tripod_return+100;
 f.glance.tripod.ndx=n;
 f.glance.groups.flatMap(g=>g.items||[]).find(x=>x.key==='NASDAQ100').value=n;
 f.pulse.raw.tradingview_cross_asset.ndx.value=n;
 const m=renderBriefDigest(host,{brief:f.brief,glance:f.glance,pulse:f.pulse,sector:f.sector,latest:true,
  nowMs:Date.parse(f.glance.generated_kst)+60000});
 assert.equal(m.ready,true,m.reason);
 assert.equal(m.pod,'TRIPOD');
 assert.match(host.innerHTML,/현재 NDX · TRIPOD/);
 assert.doesNotMatch(host.innerHTML,/현재 NDX · BIPOD/);
 assert.ok(m.distances.tri<0);
 assert.match(host.innerHTML,/TRIPOD 낙폭 조건선까지 -[0-9]/);
 assert.doesNotMatch(host.innerHTML,/\+-[0-9]/);
});
test('V3 digest ages into an explicitly dated reference instead of implying fresh live prices', () => {
 const f=sameSessionFixture(),host={hidden:true,innerHTML:''};
 // Synthetic fresh-source scenario; actual published vintage is independently tested below.
 f.glance.source_generated_kst=f.glance.generated_kst;
 const recent=briefDigest({brief:f.brief,glance:f.glance,pulse:f.pulse,sector:f.sector,latest:true,
  nowMs:Date.parse(f.glance.generated_kst)+60000});
 assert.equal(recent.ready,true,recent.reason);
 assert.equal(recent.freshnessCurrent,true);
 const m=renderBriefDigest(host,{brief:f.brief,glance:f.glance,pulse:f.pulse,sector:f.sector,latest:true,
  nowMs:Date.parse(f.glance.generated_kst)+7200001});
 assert.equal(m.ready,true,m.reason);
 assert.equal(m.freshnessCurrent,false);
 assert.equal(m.referenceOnly,true);
 assert.equal(m.tradeEligible,false);
 assert.match(host.innerHTML,/최신성 재확인 필요/);
 assert.match(host.innerHTML,/마지막 게시 참고값/);
 assert.match(host.innerHTML,/현재 신호·공식 Nasdaq 종가가 아닙니다/);
});

test('V3 digest treats a newly republished but stale original source as historical', () => {
 const f=sameSessionFixture(),g=structuredClone(f.glance);
 const nowMs=Date.parse(g.generated_kst)+60000;
 g.source_generated_kst=new Date(nowMs-7200001).toISOString();
 const host={hidden:true,innerHTML:''};
 const m=renderBriefDigest(host,{brief:f.brief,glance:g,pulse:f.pulse,sector:f.sector,latest:true,nowMs});
 assert.equal(m.ready,true,m.reason);
 assert.equal(m.freshnessCurrent,false);
 assert.match(host.innerHTML,/최신성 재확인 필요/);
 assert.match(host.innerHTML,/마지막 게시 참고값/);
});

test('V3 four colored interactive markers show signed point and percentage distance from NDX', () => {
  const {distanceText}=require('../market-observatory/observatory-v3.js');
  assert.equal(distanceText(26149.12,27001.79),'현재 대비 852.67pt 더 하락 (-3.16%)');
  assert.equal(distanceText(27001.79,27001.79),'현재 위치 · 0.00pt (0.00%)');
  assert.equal(distanceText(27800.64,27001.79),'현재 대비 798.85pt 더 상승 (+2.96%)');
  assert.equal(distanceText(28414.27,27001.79),'현재 대비 1,412.48pt 더 상승 (+5.23%)');
  assert.equal(distanceText(null,27001.79),'현재 대비 거리 확인 불가');
  const f=fixture(), m=model(f.glance,f.freshness,f.sector,now(f.freshness));
  assert.equal(m.ready,true,m.reason);
  const html=rail(m,'test');
  for(const k of ['lower','now','upper','tri']){
    assert.match(html,new RegExp('data-ov3-point="'+k+'"'));
    assert.match(html,new RegExp('aria-controls="ov3Threshold-test-'+k+'"'));
    assert.match(html,new RegExp('data-ov3-card="'+k+'"'));
    assert.match(html,new RegExp('id="ov3Threshold-test-'+k+'"'));
  }
  assert.match(html,/aria-pressed="true"/);
  assert.match(html,/data-ov3-selected/);
  assert.match(html,/현재 대비 .*pt 더 (하락|상승)/);
  assert.match(html,/공식 종가|Nasdaq/);
});

test('visual digest rejects an older published brief against a newer US close',()=>{
 const f=sameSessionFixture();
 f.brief.market_date_us='2000-01-01';
 const m=briefDigest({brief:f.brief,glance:f.glance,pulse:f.pulse,sector:f.sector,latest:true});
 assert.equal(m.ready,false);
 assert.match(m.reason,/동일 거래일|원장 시각/);
});

test('V3 sector chart uses a zero-centered symmetric blue-loss/red-gain scale',()=>{
 // Layout fixture must be aligned; live 34-sector updates can cross the NDX daily publication boundary.
 const f=alignedVisualFixture(),m=model(f.glance,f.freshness,f.sector,now(f.freshness));
 assert.equal(m.sectorReady,true,'sector source complete');
 const rows=structuredClone(m.sectors);
 rows[0].current_return_pct=-4;
 rows[1].current_return_pct=2;
 rows[2].current_return_pct=0;
 const html=sectorChart({...m,sectors:rows});
 assert.match(html,/0% 중앙 기준 수익률/);
 assert.match(html,/파랑 ← 하락/);
 assert.match(html,/상승 → 빨강/);
 const negative=html.slice(html.indexOf('data-direction="loss"'),html.indexOf('data-direction="loss"')+470);
 const positive=html.slice(html.indexOf('data-direction="gain"'),html.indexOf('data-direction="gain"')+470);
 const neutral=html.slice(html.indexOf('data-direction="neutral"'),html.indexOf('data-direction="neutral"')+470);
 assert.match(negative,/class="ov3SectorHalf left"><i class="loss" style="width:100\.0%"/);
 assert.match(negative,/class="ov3SectorHalf right"><i class="gain" style="width:0\.0%"/);
 assert.match(positive,/class="ov3SectorHalf left"><i class="loss" style="width:0\.0%"/);
 assert.match(positive,/class="ov3SectorHalf right"><i class="gain" style="width:50\.0%"/);
 assert.match(neutral,/class="ov3SectorHalf left"><i class="loss" style="width:0\.0%"/);
 assert.match(neutral,/class="ov3SectorHalf right"><i class="gain" style="width:0\.0%"/);
 assert.match(negative,/중앙 왼쪽/);
 assert.match(positive,/중앙 오른쪽/);
 const css=fs.readFileSync(path.join(root,'observatory-v3.css'),'utf8');
 assert.match(css,/\.ov3SectorTrack::after/);
 assert.match(css,/left:50%/);
 assert.match(css,/\.ov3SectorHalf\.left\{justify-content:flex-end/);
 assert.match(css,/\.ov3SectorHalf\.right\{justify-content:flex-start/);
 assert.match(css,/\.ov3SectorHalf i\.loss\{background:#2759a0/);
 assert.match(css,/\.ov3SectorHalf i\.gain\{background:#ba322d/);
});

test('black NOW marker shows verified previous close change, never zero self-distance',()=>{
 const f=fixture(),daily=JSON.parse(fs.readFileSync(path.join(root,'..','public-market-daily.json'),'utf8')),ref=daily.market_context.items.NASDAQ100;
 const m=model(f.glance,f.freshness,f.sector,now(f.freshness),daily);
 assert.equal(m.ready,true,m.reason);
 assert.equal(m.ndxChangePts,ref.change);
 assert.equal(m.ndxChangePct,ref.change_pct);
 const {dailyMoveText,pointSummary}=require('../market-observatory/observatory-v3.js');
 const points=(ref.change>0?'+':'')+ref.change.toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2});
 assert.equal(dailyMoveText(m),'전일 대비 '+points+'pt ('+(ref.change_pct>0?'+':'')+ref.change_pct.toFixed(2)+'%)');
 const html=rail(m,'test');
 assert.match(html,/data-ov3-card="now"/);
 assert.ok(html.includes('전일 대비 '));
 assert.ok(!html.includes('현재 위치 · 0.00pt (0.00%)'));
 assert.match(html,/aria-label="현재 NDX · BIPOD · 전일 대비 /);
 for(const key of ['lower','upper','tri'])assert.match(pointSummary(key,m),/^현재 대비 [0-9,.]+pt 더 (상승|하락)/);
 const stale=structuredClone(daily);stale.market_context.items.NASDAQ100.session_date='1999-01-01';
 const hold=model(f.glance,f.freshness,f.sector,now(f.freshness),stale);
 assert.equal(hold.ready,true,'exact close is optional for rendering other thresholds');
 assert.equal(hold.ndxChangePts,null);
 assert.equal(hold.ndxChangePct,f.glance.groups.find(x=>x.name==='미국').items.find(x=>x.key==='NASDAQ100').d1_pct);
 assert.match(dailyMoveText(hold),/^전일 대비 [+-]?[0-9.]+% · 포인트 확인 대기$/);
 const wrong=structuredClone(daily);wrong.market_context.items.NASDAQ100.value+=100;
 assert.equal(model(f.glance,f.freshness,f.sector,now(f.freshness),wrong).ndxChangePts,null);
 assert.equal(model(f.glance,f.freshness,f.sector,now(f.freshness),null).ndxChangePts,null);
 assert.equal(dailyMoveText({...m,ndxChangePts:-57.034,ndxChangePct:-0.21}),'전일 대비 -57.03pt (-0.21%)');
});

test('V3 prioritizes fetched index quotes, exposes session/time, keeps TRI-POD EOD immutable',()=>{
 const {marketStripRows,marketStrip}=require('../market-observatory/observatory-v3.js');
 const f=fixture(),m=model(f.glance,f.freshness,f.sector,now(f.freshness));
 assert.equal(m.ready,true,m.reason);
 const publishedNDX=m.ndx,oldSession=m.session,oldAxis=structuredClone(m.axis);
 const newSession=new Date(Date.parse(oldSession+'T00:00:00Z')+86400000).toISOString().slice(0,10);
 const seen=Date.parse(newSession+'T21:00:00Z'),t=seen+600000;
 const q={key:'NASDAQ100',value:26345.67,session_date:newSession,observed_at:new Date(seen).toISOString(),
  change_pct:-2.84,source:'Test index quote provider',market_state:'CLOSED',quality:'LIVE',refresh_status:'FETCHED'};
 const get=key=>key==='NASDAQ100'?q:null;
 const r=marketStripRows(m,get,t),ndx=r.find(x=>x.key==='NASDAQ100'),sp=r.find(x=>x.key==='SP500');
 assert.equal(ndx.kind,'QUOTE');assert.equal(ndx.value,26345.67);assert.equal(ndx.session,newSession);
 assert.equal(sp.kind,'PUBLISHED');assert.equal(sp.session,oldSession);
 assert.equal(ndx.status,'최근 마감 관측');
 // Use the genuine quote reader's quality() labels; its nonstale normal quote
 // intentionally contains "지연 가능" (a disclaimer, NOT a delayed status).
 const Q=require('../market-observatory/intraday-quotes-v1.js');
 for(const state of ['REGULAR','PRE','POST','CONTINUOUS']){
  const onTime={...q,market_state:state,observed_at:new Date(t-60000).toISOString(),refresh_status:'FETCHED',quality:'LIVE'};
  const withQuality={...onTime,display_status:Q.quality(onTime,t)};
  assert.equal(withQuality.display_status,'장중 관측 · 지연 가능');
  const live=marketStripRows(m,key=>key==='NASDAQ100'?withQuality:null,t).find(x=>x.key==='NASDAQ100');
  assert.equal(live.delayed,false,state+' 1min must NOT be declared a delayed observation');
  assert.equal(live.status,'장중 관측 · 지연 가능');
  assert.match(marketStrip(m,key=>key==='NASDAQ100'?withQuality:null,t),/시세 API 조회 결과/);
  const old={...withQuality,observed_at:new Date(t-21*60000).toISOString()};
  const held=marketStripRows(m,key=>key==='NASDAQ100'?old:null,t).find(x=>x.key==='NASDAQ100');
  assert.equal(held.delayed,['REGULAR','CONTINUOUS'].includes(state),state+' delay must follow market-state policy');
 }
 const stale={...q,market_state:'REGULAR',display_status:'관측 지연'};
 assert.equal(marketStripRows(m,key=>key==='NASDAQ100'?stale:null,t)[0].delayed,true);
 const retainedByReader={...q,display_status:'이전 관측 유지'};
 assert.equal(marketStripRows(m,key=>key==='NASDAQ100'?retainedByReader:null,t)[0].delayed,true);

 const closed80=marketStripRows(m,get,seen+80*60000).find(x=>x.key==='NASDAQ100');
 assert.equal(closed80.delayed,false,'CLOSED observed bar remains recent close, not intraday delay');
 assert.equal(closed80.status,'최근 마감 관측');
 assert.match(marketStrip(m,get,seen+80*60000),/시세 API 조회 결과/);
 const html=marketStrip(m,get,t);
 assert.match(html,/MARKET QUOTES · 접속 시 조회/);
 assert.match(html,/26,345\.67/);
 assert.match(html,/Test index quote provider/);
 assert.match(html,/장 마감 관측 확인/);
 assert.match(html,/완료일봉 업데이트 대기/);
 assert.match(html,/KST/);
 assert.match(html,new RegExp('TRI-POD 판단 기준은 미국 '+oldSession));
 assert.equal(m.ndx,publishedNDX);
 assert.deepEqual(m.axis,oldAxis);
 assert.equal(m.session,oldSession);
 assert.equal(marketStripRows(m,()=>({...q,session_date:'2000-01-01'}),t).find(x=>x.key==='NASDAQ100').kind,'PUBLISHED');
 assert.equal(marketStripRows(m,()=>({...q,observed_at:new Date(t+600000).toISOString()}),t).find(x=>x.key==='NASDAQ100').kind,'PUBLISHED');
 const retained=marketStripRows(m,()=>({...q,refresh_status:'RETAINED'}),t).find(x=>x.key==='NASDAQ100');
 assert.equal(retained.delayed,true);
 assert.match(marketStrip(m,()=>({...q,refresh_status:'RETAINED'}),t),/관측 지연·이전값/);
 const held=model(f.glance,{...f.freshness,groups:{...f.freshness.groups,market:{...f.freshness.groups.market,state:'STALE'}}},f.sector,now(f.freshness));
 assert.equal(held.ready,false);
 assert.equal(marketStripRows(held,get,t).find(x=>x.key==='NASDAQ100').kind,'QUOTE',
  'current quotes are visible even when the dated TRI-POD verification is on HOLD');
});
