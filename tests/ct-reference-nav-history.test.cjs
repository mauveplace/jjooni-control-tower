const test=require('node:test');
const assert=require('node:assert/strict');
const {audit,schema}=require('../ct-reference-nav-history-v1.js');
const now=Date.parse('2026-11-15T10:00:00+09:00');
const ids=['TOSS','ISA','PENSION','IRP'];
const quality='REFERENCE_ONLY_NO_ATTESTED_BROKER_CLOSE';
function fixture(){
 const h={schema,state:'REFERENCE_ONLY',source_quality:quality,portfolio_account_ids:ids.slice(),
  date_basis:'CANONICAL_CAPTURE_KST_CALENDAR_DAY',
  selection_rule:'LATEST_COMPLETE_FOUR_ACCOUNT_CANONICAL_SNAPSHOT_PER_KST_DAY',
  bound_snapshot_id:'S1',generated_at_kst:'2026-11-15T09:00:00+09:00',
  certified_us_close:false,cash_flow_reconciled:false,historical_pnl_available:false,
  days:[{date:'2026-11-11',total_four_nav_krw:123,generated_kst:'2026-11-11T09:01:00+09:00',source_snapshot_id:'x1',source_quality:quality,legacy_tripod_excluded:true},
   {date:'2026-11-13',total_four_nav_krw:160,generated_kst:'2026-11-13T09:02:00+09:00',source_snapshot_id:'x2',source_quality:quality,legacy_tripod_excluded:false},
   {date:'2026-11-14',total_four_nav_krw:170,generated_kst:'2026-11-14T09:03:00+09:00',source_snapshot_id:'x3',source_quality:quality,legacy_tripod_excluded:false}]};
 return {h,ctx:{live:{snapshot_id:'S1'},canonical:{snapshot_id:'S1'},now}};
}
test('reference NAV is separate schema and preserves missing calendar days',()=>{
 const {h,ctx}=fixture(),r=audit(h,ctx);
 assert.equal(schema,'CT_REFERENCE_NAV_HISTORY_V1');
 assert.equal(r.ok,true);assert.equal(r.gaps,1);assert.equal(r.rows.length,3);
 assert.equal(r.excluded_legacy,1);
 assert(!JSON.stringify(r).includes('investment_pnl_krw'));
});
test('missing, invalid status, verified PnL promotion and unauthorized snapshot all fail closed',()=>{
 const bad=[x=>{x.h.state='VERIFIED'},x=>{x.h.schema='CT_RECONCILED_PERFORMANCE_HISTORY_V1'},
  x=>{x.h.cash_flow_reconciled=true},x=>{x.h.certified_us_close=true},
  x=>{x.h.historical_pnl_available=true},x=>{x.h.bound_snapshot_id='other'},
  x=>{x.ctx.canonical.snapshot_id='other'},x=>{x.h.portfolio_account_ids.push('TRIPOD')},
  x=>{x.h.generated_at_kst='bad'},x=>{x.h.generated_at_kst='2026-11-16T09:00:00+09:00'}];
 for(const mutation of bad){const x=fixture();mutation(x);assert.equal(audit(x.h,x.ctx).ok,false)}
 assert.equal(audit(null,fixture().ctx).ok,false);
});
test('reject incomplete, duplicate, missing financial NAV and clock mismatch without runtime exception',()=>{
 const bad=[
  x=>{x.h.days[1].date=x.h.days[0].date},
  x=>{x.h.days[1].date='2026-09-11'},
  x=>{x.h.days[1].date='2026-13-44'},
  x=>{x.h.days[1].total_four_nav_krw=NaN},
  x=>{x.h.days[1].total_four_nav_krw=null},
  x=>{x.h.days[1].generated_kst='2026-11-12T09:02:00+09:00'},
  x=>{x.h.days[1].source_snapshot_id=''},
  x=>{x.h.days[1].legacy_tripod_excluded=null}
 ];
 for(const m of bad){const x=fixture();m(x);assert.equal(audit(x.h,x.ctx).ok,false)}
});
test('only latest dated observations, never PnL or inferred zero for gap',()=>{
 const x=fixture(),r=audit(x.h,x.ctx);
 assert.equal(r.rows[0].nav,123);
 assert.equal(r.rows[r.rows.length-1].nav,170);
 assert.equal(r.rows.find(t=>t.date==='2026-11-12'),undefined);
});
