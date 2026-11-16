const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { model, enabled, rail, marketStrip, sectorChart } = require('../market-observatory/observatory-v3.js');
const { build: briefDigest } = require('../market-observatory/brief-visual-digest-v1.js');
const root = path.join(__dirname, '..', 'market-observatory');
const read = p => JSON.parse(fs.readFileSync(path.join(root, 'data', p), 'utf8'));
const fixture = () => ({glance:read('daily-glance.json'), freshness:read('freshness-status.json'),
  sector:read('sector-rotation-brief.json'), pulse:read('daily-market-pulse.json'),
  brief:read('morning-brief/latest.json')});
const now = f => Date.parse(f.generated_kst)+60000;
test('V3 only on explicit opt-in, no implicit preference change', () => {
 assert.equal(enabled('?ui=v3'), true);
 assert.equal(enabled('?ui=v2'), false);
 assert.equal(enabled(''), false);
 assert.equal(enabled('?ui=v1'), false);
});
test('V3 threshold numbers from same-session published canonical, never generated', () => {
 const f=fixture(),m=model(f.glance,f.freshness,f.sector,now(f.freshness));
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
 assert.match(marketStrip(m),/MARKET CLOSE/);
 assert.equal(m.sectors.length,11);
 assert.match(sectorChart(m),/자금흐름 아님/);
});
test('V3 fail closed on stale freshness even if cached NDX looks plausible', () => {
 const f=fixture();
 const expired=Date.parse(f.freshness.generated_kst)+7200001;
 const m=model(f.glance,f.freshness,f.sector,expired);
 assert.equal(m.ready,true);
 assert.equal(m.freshnessCurrent,false);
 assert.equal(m.referenceOnly,true);
 assert.equal(m.tradeEligible,undefined);
 assert.match(rail(m),/최신성 재확인 필요/);
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
 const f=fixture();
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
