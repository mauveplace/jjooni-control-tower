'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../market-observatory');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/song-live-insights.json'),'utf8'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const script=fs.readFileSync(path.join(root,'song-live-insights-v1.js'),'utf8');
const css=fs.readFileSync(path.join(root,'song-live-insights-v1.css'),'utf8');

test('only actual dated Song live insights are published as read-only reference',()=>{
 assert.equal(data.schema,'SONG_LIVE_INSIGHTS_V1');
 assert.equal(data.published_note_date,'2026-11-21');
 assert.equal(data.status,'SOURCE_SUMMARY_REVIEW_ONLY');
 assert.equal(data.items.length,7);
 assert.equal(new Set(data.items.map(x=>x.id)).size,data.items.length);
 for(const x of data.items){
  for(const k of ['id','title','category','speaker','application','caution','evidence'])
   assert.ok(typeof x[k]==='string'&&x[k].length>2,x.id+' '+k);
  assert.equal(x.evidence==='TRANSCRIPT'||x.evidence==='TRANSCRIPT_AND_MARKET_CROSSCHECK',true);
 }
 assert.match(data.items.find(x=>x.id==='signal').speaker,/No-Pod/);
 assert.match(data.items.find(x=>x.id==='new-method').caution,/(규칙|룰)/);
 assert.match(data.items.find(x=>x.id==='allocation').caution,/개인 사례/);
});
test('do not leak private Plaud/Drive raw content or quietly change trading rules',()=>{
 const all=JSON.stringify(data);
 assert.doesNotMatch(all,/f_01a1|plaud:\/\/|drive\.google\.com|\/mnt\/data|presigned_url|PRIVATE_KEY|계좌번호/i);
 assert.ok(data.disclaimers.some(s=>/VIX10/.test(s)),'VIX audio ambiguity must be declared');
 assert.ok(data.disclaimers.some(s=>/단어/.test(s)),'live is not a daily word segment');
 new vm.Script(script,{filename:'song-live-insights-v1.js'});
 assert.match(script,/textContent/);
 assert.doesNotMatch(script,/innerHTML|eval\(/);
 assert.match(css,/\.songLiveGate/);
});
test('live reference remains inside existing morning brief with no 6th nav tab',()=>{
 assert.equal((html.match(/id="songLiveGate"/g)||[]).length,1);
 assert.equal((html.match(/id="song-live-insights"/g)||[]).length,1);
 assert.ok(html.indexOf('id="songLiveGate"')<html.indexOf('id="briefArticle"'));
 assert.match(html,/song-live-insights-v1\.js/);
 assert.match(html,/song-live-insights-v1\.css/);
 const {IA}=require('../market-observatory/observatory-nav-v2.js');
 assert.equal(IA.length,5);
 assert.equal(IA.find(x=>x.id==='brief').tabs.includes('morning-brief'),true);
 assert.equal(IA.find(x=>x.id==='brief').tabs.includes('song-terms'),true);
 assert.equal(IA.some(x=>x.tabs.includes('song-live-insights')),false);
});
