const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('account-feed transport retries are distinct from auth/validation blocks and clear after recovery',async()=>{
 const badges=[],window={__JJOONI_ENTRY_DIAGNOSTICS:{phase:'CONNECTING_ACCOUNTS'}},context={window,document:{hidden:false},Date,CANON:null,TRADE_QUOTES:null,sessionStorage:{getItem:()=> 'fixture-only'},console:{warn(){}},setBadge:(...args)=>badges.push(args),loadGviz:async()=>{throw Error('GVIZ_TIMEOUT')},decryptEnvelope:async()=>({snapshot_id:'fixture'}),applyLive(){}};
 vm.createContext(context);const source=fs.readFileSync('live-bridge.js','utf8');const block=source.slice(source.indexOf('const CONNECTION='),source.indexOf('function renderRefreshStatus()'));vm.runInContext(block,context);
 await window.__JJOONI_LIVE_BRIDGE.refresh();assert.equal(window.__JJOONI_FEED_CONNECTION.state,'RETRYING');assert.equal(badges.at(-1)[0],'SSOT RETRY');assert.equal(window.__JJOONI_ENTRY_DIAGNOSTICS.phase,'CONNECTING_ACCOUNTS');
 context.loadGviz=async()=>({SCHEMA:'JJOONI_CT_LIVE_ENCRYPTED_V1',ENCRYPTED_PAYLOAD:'{}'});await window.__JJOONI_LIVE_BRIDGE.refresh();assert.equal(window.__JJOONI_FEED_CONNECTION.state,'READY');assert.equal(window.__JJOONI_FEED_CONNECTION.last_error,null);assert.equal(window.__JJOONI_ENTRY_DIAGNOSTICS.phase,'ACCOUNTS_READY');
 context.loadGviz=async()=>({SCHEMA:'INVALID'});await window.__JJOONI_LIVE_BRIDGE.refresh();assert.equal(window.__JJOONI_FEED_CONNECTION.state,'BLOCKED');assert.equal(badges.at(-1)[0],'SSOT BLOCKED');
});
