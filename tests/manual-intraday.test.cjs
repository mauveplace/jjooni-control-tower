const test=require('node:test'),assert=require('node:assert/strict');
const {positions,merge,num,needsHistory,marketGroup,sessionKind,sessionBands}=require('../manual-intraday-v1.js');
test('deduplicate symbols across five active accounts',()=>{const ps=positions({accounts:{TOSS:{positions:[{ticker:'005930.KS',qty:2,name:'삼성전자'},{ticker:'AAPL',qty:1}]},ISA:{positions:[{ticker:'005930',qty:3},{ticker:'CASH',qty:1,record_type:'CASH'}]},AI:{positions:[{ticker:'NVDA',qty:1}]}}});assert.equal(ps.length,2);assert.deepEqual(ps[0].accounts,['TOSS','ISA']);});
test('last row replaces unfinished candle by time',()=>{assert.deepEqual(merge([{timestamp:'2026-10-09T01:00:00Z',close:1}],[{timestamp:'2026-10-09T01:00:00Z',close:2}]),[{timestamp:'2026-10-09T01:00:00Z',close:2}])});
test('unknown data is never silently zeroed',()=>{assert.equal(num(null),null);assert.equal(num(''),null);assert.equal(num('NaN'),null);assert.equal(num(0),0)});

test('selection fills missing and partial data but reuses a complete cached session',()=>{assert.equal(needsHistory(null),true);assert.equal(needsHistory({candles:[],status:'NOT_COLLECTED'}),true);assert.equal(needsHistory({candles:[{close:1}],backfill_complete:false}),true);assert.equal(needsHistory({candles:[{close:1}],backfill_complete:true}),false);assert.equal(needsHistory({candles:[],status:'EMPTY_SESSION'}),false)});

test('market grouping follows listing venue, including KR alpha numeric codes',()=>{assert.equal(marketGroup('005930.KS'),'KR');assert.equal(marketGroup('0101N0'),'KR');assert.equal(marketGroup('AAPL'),'US');assert.equal(marketGroup('BRK.B'),'US')});
test('US session boundaries use New York local time in summer and winter',()=>{const z='America/New_York';assert.equal(sessionKind('2026-10-09T13:29:00Z',z),'PRE');assert.equal(sessionKind('2026-10-09T13:30:00Z',z),'REGULAR');assert.equal(sessionKind('2026-10-09T20:00:00Z',z),'AFTER');assert.equal(sessionKind('2026-12-09T14:29:00Z',z),'PRE');assert.equal(sessionKind('2026-12-09T14:30:00Z',z),'REGULAR');assert.equal(sessionKind('2026-12-09T21:00:00Z',z),'AFTER')});
test('KR closing auction stays regular until 15:30',()=>{const z='Asia/Seoul';assert.equal(sessionKind('2026-10-08T08:59:00+09:00',z),'PRE');assert.equal(sessionKind('2026-10-08T09:00:00+09:00',z),'REGULAR');assert.equal(sessionKind('2026-10-08T15:29:00+09:00',z),'REGULAR');assert.equal(sessionKind('2026-10-08T15:30:00+09:00',z),'AFTER')});
test('background bands split exactly at session boundaries',()=>{const bands=sessionBands(Date.parse('2026-10-09T13:00:00Z'),Date.parse('2026-10-09T21:00:00Z'),'America/New_York');assert.deepEqual(bands.map(b=>b.kind),['PRE','REGULAR','AFTER']);assert.equal(bands[0].end,Date.parse('2026-10-09T13:30:00Z'));assert.equal(bands[1].end,Date.parse('2026-10-09T20:00:00Z'))});

const {chartReference,changeText}=require('../manual-intraday-v1.js');
test('reference requires dated positive previous trading close',()=>{assert.equal(chartReference({session_date:'2026-10-12',previous_close:100,previous_close_date:'2026-10-08'}),100);for(const d of ['2026-10-12','2026-10-13',null])assert.equal(chartReference({session_date:'2026-10-12',previous_close:100,previous_close_date:d}),null);assert.equal(chartReference({session_date:'2026-10-12',previous_close:0,previous_close_date:'2026-10-08'}),null)});
test('price changes use the reference and show missing as unknown',()=>{assert.equal(changeText(102,100),'+2 (+2.00%)');assert.equal(changeText(98,100),'-2 (-2.00%)');assert.match(changeText(102,null),/확인 중/)});

const {needsRefresh}=require('../manual-intraday-v1.js');
test('latest complete cache expires after ten minutes; explicit historical date remains cached',()=>{const now=Date.parse('2026-10-16T04:00:00Z'),d={candles:[{close:100}],backfill_complete:true,updated_at:'2026-10-16T03:00:00Z'};assert.equal(needsRefresh(d,'',now),true);assert.equal(needsRefresh(d,'2026-10-15',now),false);d.updated_at='2026-10-16T03:59:00Z';assert.equal(needsRefresh(d,'',now),false)});

const {changePct,changeTone}=require('../manual-intraday-v1.js');
test('percent and color share one dated reference and unknown is not a decline',()=>{assert.equal(changePct(103,100),3.0000000000000027);assert.equal(changeTone(103,100),'up');assert.equal(changeTone(98,100),'down');assert.equal(changeTone(100,100),'flat');for(const p of [null,'',NaN]){assert.equal(changePct(p,100),null);assert.equal(changeTone(p,100),'unknown')}assert.equal(changePct(100,null),null);});
test('reference queue prioritizes selected symbol and one failed source cannot block others',async()=>{
 const fs=require('fs'),vm=require('vm'),src=fs.readFileSync('manual-intraday-v1.js','utf8'),calls=[],pending=[];
 const charts=new Map(['A','B','C','D','SELECTED'].map(symbol=>[symbol,{symbol,session_date:'2026-10-19',candles:[{close:102}]}]));
 const context={S:{charts,selected:'SELECTED'},chartReference,referenceCache:new Map(),render:()=>{},request:(path,body)=>{calls.push(body.symbol);return new Promise((resolve,reject)=>pending.push({body,resolve,reject}))}};
 vm.createContext(context);vm.runInContext(src.slice(src.indexOf('const referencePending='),src.indexOf('async function hydrateSavedCharts()'))+';this.queue=queueReferences;',context);
 context.queue();assert.deepEqual(calls,['SELECTED','A','B']);pending[1].reject(Error('source unavailable'));await new Promise(r=>setImmediate(r));assert.equal(calls[3],'C');pending[0].resolve({reference:{session_date:'2026-10-19',previous_close:100,previous_close_date:'2026-10-16'}});await new Promise(r=>setImmediate(r));assert.equal(charts.get('SELECTED').previous_close,100);assert.equal(calls[4],'D');
});
