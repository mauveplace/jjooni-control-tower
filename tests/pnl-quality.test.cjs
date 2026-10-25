const test=require('node:test'),assert=require('node:assert/strict'),M=require('../canonical-metrics.js');
test('IRP accepts verified broker cumulative PnL but never infers it from an unverified principal',()=>{
 assert.deepEqual(M.cumulative({id:'IRP',nav:120,principal:100}),{pnl:null,return_pct:null});
 assert.deepEqual(M.cumulative({id:'IRP',nav:120,principal:100,principal_quality:'USER_CONFIRMED',principal_basis:'NET_CONTRIBUTED_CAPITAL'}),{pnl:20,return_pct:20});
 assert.deepEqual(M.cumulative({id:'IRP',nav:120,principal:100,principal_quality:'MODELED',principal_basis:'NET_CONTRIBUTED_CAPITAL'}),{pnl:null,return_pct:null});
 assert.deepEqual(M.cumulative({id:'IRP',total_pnl:0,total_pnl_quality:'BROKER_MEASURED',total_return_pct:0}),{pnl:0,return_pct:0});
});
test('measured/modelled totals remain separate, deduplicate strategy aliases, and preserve missing vs zero',()=>{
 const accounts={TOSS:{today_pnl:10,today_pnl_quality:'BROKER_MEASURED',today_pnl_scope:'US_CLOSE'},ISA:{today_pnl:-4,today_pnl_quality:'MODELED',today_pnl_scope:'US_CLOSE'},PENSION:{today_pnl:0,today_pnl_quality:'MODELED',today_pnl_scope:'US_CLOSE'},IRP:{today_pnl:null,today_pnl_quality:'MODELED'}};
 const t=M.aggregate(accounts,['TOSS','TRIPOD','ISA','PENSION','IRP']);assert.equal(t.known_day,3);assert.equal(t.day,null);assert.equal(t.day_quality.state,'MIXED');assert.equal(t.day_quality.groups.BROKER_MEASURED.subtotal,10);assert.equal(t.day_quality.groups.MODELED.subtotal,-4);assert.equal(t.day_quality.groups.UNKNOWN.subtotal,null);assert.equal(t.day_quality.comparable_period,true);assert.deepEqual(t.day_quality.groups.BROKER_MEASURED.ids,['TOSS']);
 accounts.ISA.today_pnl_scope='KR_BROKER_DAY';assert.equal(M.aggregate(accounts).day_quality.comparable_period,false);
 delete accounts.TOSS.today_pnl_quality;assert.equal(M.aggregate(accounts).day_quality.groups.UNKNOWN.subtotal,10);
});
