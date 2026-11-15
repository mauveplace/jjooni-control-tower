const test=require('node:test');
const assert=require('node:assert/strict');
const {inspect}=require('../tools/ct_observatory_v2_contract_audit.cjs');

test('Human Control Tower V2 and Market Observatory V2 remain connected without misleading finance verification',()=>{
 const x=inspect();
 assert.equal(x.state,'SOURCE_CONTRACT_PASS');
 assert.equal(x.human_mobile_destinations,5);
 assert.equal(x.observatory_groups,5);
 assert.equal(x.observatory_legacy_destinations,13);
 assert.equal(x.sector_rows,34);
 assert.equal(x.reference_nav_quality,'REFERENCE_ONLY');
 assert.equal(x.authenticated_private_browser,'UNVERIFIED');
 assert.equal(x.verified_pnl_history,'EVIDENCE_REQUIRED_NOT_ASSERTED');
});
