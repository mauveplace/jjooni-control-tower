const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const read=p=>fs.readFileSync('market-observatory/'+p,'utf8');
test('sector spark return uses the same 100-session base as the table',()=>{
 const src=read('sector-etf-v1.js');
 const context={};vm.createContext(context);
 const data=JSON.parse(read('data/sector-etf.json'));
 const helpers=src.slice(src.indexOf('function seriesRet('),src.indexOf('function ranked20('));
 const spark=src.slice(src.indexOf('function sparkline('),src.indexOf('function themeHtml('));
 vm.runInContext(`const DATA=${JSON.stringify(data)};const n=v=>v==null?null:Number(v);const esc=v=>String(v);const pct=v=>v==null?'—':(v>=0?'+':'')+Number(v).toFixed(2)+'%';${helpers}\n${spark}\nthis.check=()=>DATA.groups.flatMap(g=>g.rows||[]).map(r=>({ticker:r.ticker,expected:pct(ret(r,100)),html:sparkline(r)}));`,context);
 const rows=context.check();assert(rows.length>10);
 for(const row of rows)assert(row.html.includes('>'+row.expected+'</b>'),row.ticker+' table/chart disagreement');
});
test('macro trend cannot masquerade as the actual used for surprise',()=>{
 const src=read('official-macro-v1.js'),context={};vm.createContext(context);
 const start=src.indexOf('function trendBasis('),end=src.indexOf('function groupHtml(');
 const data=JSON.parse(read('data/official-macro.json'));
 const helpers=src.slice(src.indexOf('const esc='),src.indexOf('const COLORS='));
 const release=src.slice(src.indexOf('function releaseFmt('),src.indexOf('function surpriseRead('));
 vm.runInContext(`${helpers}\n${release}\nconst DATA=${JSON.stringify(data)};const metric=k=>DATA.metrics[k];${src.slice(start,end)}\nthis.row=rowHtml;`,context);
 const html=context.row('US_CORE_PCE');
 assert.match(html,/추세[^<]*전년비/);assert.match(html,/발표 실제 · MoM %/);assert.match(html,/이전 · MoM %/);assert.match(html,/예상 · MoM %/);assert.match(html,/%p/);
 assert(!context.row('US_SEP_DOT_PLOT').includes('발표 실제'));
 assert.match(context.row('KR_INDUSTRIAL_PRODUCTION'),/추세[^<]*전월비/);
 assert.match(context.row('US_AHE'),/3.02%/);
});
