const fs=require('fs');
const tablet=fs.readFileSync('tablet-runtime-v8.js','utf8');
const ui=fs.readFileSync('ui-refactor.js','utf8');
const cost=fs.readFileSync('cost-bridge.js','utf8');
const loader=fs.readFileSync('trade-review-loader.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const checks={
 tablet_v83:tablet.includes("version:'8.3'"),
 ticker_name_upgrade:tablet.includes('incoming&&incoming!==k'),
 explicit_fx_only:tablet.includes('L().fx_reference'),
 wide_more_hidden:ui.includes('@media(min-width:768px){#ctMoreTab,#ctMoreMenu{display:none!important}}'),
 wide_nav_creation_blocked:ui.includes("if(!mobile()){const more=qs('#ctMoreTab'),menu=qs('#ctMoreMenu')"),
 ui_v15:ui.includes("version:'1.5'"),
 cost_fail_closed:cost.includes("String(c.schema||'')==='AUTOBOT_COST_V2'&&bill.currency_verified===true"),
 cost_unverified_block:cost.includes('통화 원천 미검증 · 숫자 차단'),
 loader_1417:loader.includes("version:'14.17'"),
 loader_tablet_83:loader.includes('tablet-runtime-v8.js?v=8.3'),
 loader_ui_15:loader.includes('ui-refactor.js?v=1.5'),
 index_1417:index.includes('trade-review-loader.js?v=14.17')
};
console.log(JSON.stringify(checks,null,2));
if(Object.values(checks).some(v=>!v)) process.exit(1);
