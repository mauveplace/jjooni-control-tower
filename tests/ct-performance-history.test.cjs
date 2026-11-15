const test=require('node:test');
const assert=require('node:assert/strict');
const {audit,schema}=require('../ct-performance-history-v1.js');
const ids=['TOSS','ISA','PENSION','IRP'];
const verifiedAt='2026-11-15T09:00:00+09:00';
function fixture(){
 const rows=[
  {date:'2026-11-11',nav_krw:1000,investment_pnl_krw:100,net_cash_flow_krw:0,asset_class_contributions_krw:{KR_STOCK:70,US_STOCK:30}},
  {date:'2026-11-12',nav_krw:1105,investment_pnl_krw:55,net_cash_flow_krw:50,asset_class_contributions_krw:{KR_STOCK:15,US_STOCK:40}},
  {date:'2026-11-13',nav_krw:1150,investment_pnl_krw:45,net_cash_flow_krw:0,asset_class_contributions_krw:{KR_STOCK:20,US_STOCK:25}}
 ];
 return {source:{schema,status:'VERIFIED',accounts:ids.slice(),bound_snapshot_id:'snap1',verified_at_kst:verifiedAt,asset_class_partition:'DISJOINT',rows},
  context:{live:{snapshot_id:'snap1',source_health:{pb_history:{state:'VERIFIED'}}},canonical:{snapshot_id:'snap1'}}};
}
test('verified reconciliation renders 3 chart data series only when source, 4 accounts, NAV bridge and classification all attest',()=>{
 const {source,context}=fixture(),out=audit(source,context);
 assert.equal(out.ok,true);
 assert.equal(out.contributionOk,true);
 assert.equal(out.rows.length,3);
 assert.deepEqual(out.contributions,[['KR_STOCK',105],['US_STOCK',95]]);
});
test('absence of an approved history source cannot become a fabricated chart',()=>{
 const {context}=fixture();
 assert.match(audit(null,context).reason,/미제공/);
 assert.match(audit({performance:[{date:'2026-11-11',total_asset:123}]},context).reason,/스키마/);
});
test('duplicate, unordered, missing, or structurally invalid accounting rows fail closed',()=>{
 for(const mutate of [
  s=>{s.rows[1].date=s.rows[0].date},
  s=>{s.rows[1].date='2026-11-10'},
  s=>{s.rows[2].nav_krw=null},
  s=>{s.rows[2].net_cash_flow_krw=undefined},
  s=>{s.rows[1].nav_krw+=200}
 ]){
  const {source,context}=fixture();mutate(source);assert.equal(audit(source,context).ok,false);
 }
});
test('snapshot mismatch, stale source health or incomplete account universe block charts',()=>{
 for(const mutate of [
  x=>{x.context.live.snapshot_id='different'},
  x=>{x.context.live.source_health.pb_history.state='STALE'},
  x=>{x.source.accounts.pop()},
  x=>{x.source.status='DRAFT'},
  x=>{x.source.verified_at_kst='bad timestamp'},
 ]){
  const x=fixture();mutate(x);assert.equal(audit(x.source,x.context).ok,false);
 }
});
test('category sums inconsistent or non-disjoint block only the third chart',()=>{
 let x=fixture();x.source.rows[2].asset_class_contributions_krw.KR_STOCK=300;
 let z=audit(x.source,x.context);assert.equal(z.ok,true);assert.equal(z.contributionOk,false);assert.match(z.contributionReason,/불일치/);
 x=fixture();x.source.asset_class_partition='OVERLAPPING';
 z=audit(x.source,x.context);assert.equal(z.ok,true);assert.equal(z.contributionOk,false);
});
test('financial history must not use legacy current-observation rows or TRI-POD as fifth account',()=>{
 const x=fixture();
 x.source.accounts.push('TRIPOD');
 assert.equal(audit(x.source,x.context).ok,false);
});

test('verified_at_kst requires an explicit timezone; date-only or local-ambiguous times cannot certify broker history',()=>{
 for(const unzoned of ['2026-11-15','2026-11-15T09:00:00','2026-11-15T09:00']){
  const {source,context}=fixture();source.verified_at_kst=unzoned;
  const result=audit(source,context);
  assert.equal(result.ok,false,'must reject timezone-free '+unzoned);
  assert.match(result.reason,/검증 시각/);
 }
 const {source,context}=fixture();
 source.verified_at_kst='2026-11-15T00:00:00Z';
 assert.equal(audit(source,context).ok,true,'valid explicit UTC should remain accepted');
});

test('NAV-to-PnL bridge accepts 1 KRW rounding but blocks asset-size-relative multiwon errors',()=>{
 const a=fixture();
 a.source.rows.forEach((row,index)=>{
  row.nav_krw*=100000000;
  row.investment_pnl_krw*=100000000;
  row.net_cash_flow_krw*=100000000;
  row.asset_class_contributions_krw.KR_STOCK*=100000000;
  row.asset_class_contributions_krw.US_STOCK*=100000000;
 });
 assert.equal(audit(a.source,a.context).ok,true);
 a.source.rows[1].nav_krw+=1;
 assert.equal(audit(a.source,a.context).ok,true,'1 KRW rounding difference is allowed');
 a.source.rows[1].nav_krw+=2;
 const wrong=audit(a.source,a.context);
 assert.equal(wrong.ok,false,'3 KRW difference must not be excused by large portfolio NAV');
 assert.match(wrong.reason,/NAV 증감/);
});
