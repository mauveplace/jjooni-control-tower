'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const repo=path.join(__dirname,'..');
const root=path.join(repo,'market-observatory');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/song-word-study.json'),'utf8'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'song-word-study-v1.js'),'utf8');
const css=fs.readFileSync(path.join(root,'song-word-study-v1.css'),'utf8');

test('original source-verified Song terms have strict fields and unique dates',()=>{
 assert.equal(data.schema,'SONG_WORD_STUDY_V1');
 assert.ok(data.entries.length>=25);
 assert.equal(new Set(data.entries.map(x=>x.id)).size,data.entries.length);
 assert.equal(new Set(data.entries.map(x=>x.date)).size,data.entries.length);
 const required=['date','term','english','category','meaning','speaker_context','study_example','caution','source_type'];
 for(const x of data.entries){
  for(const k of required)assert.ok(typeof x[k]==='string'&&x[k].trim(),x.date+' '+k);
  assert.match(x.date,/^2026-\d\d-\d\d$/);
  assert.ok(['TRANSCRIPT','PDF_EXTRACT'].includes(x.source_type));
  assert.ok(x.meaning.length>=20);
 }
 assert.equal(data.entries.find(x=>x.date==='2026-11-19').term,'수요예측');
 assert.equal(data.entries.find(x=>x.date==='2026-11-18').term,'실적 가이던스');
 assert.equal(data.entries.find(x=>x.date==='2026-10-28').term,'특수목적기구');
});

test('study assets preserve source privacy and compile',()=>{
 new vm.Script(js,{filename:'song-word-study-v1.js'});
 assert.doesNotMatch(JSON.stringify(data),/drive\.google\.com|\/mnt\/data\/|account_number|api_key|Bearer /i);
 assert.match(css,/#song-terms/);
 assert.match(js,/localStorage/);
 assert.match(js,/aria-pressed/);
 assert.match(js,/cache:"no-store"/);
});

test('word study mounts in existing Observatory with no sixth main nav',()=>{
 const {IA}=require('../market-observatory/observatory-nav-v2.js');
 assert.equal(IA.length,5);
 assert.equal(IA.find(x=>x.id==='brief').tabs.includes('song-terms'),true);
 assert.match(html,/button data-tab="song-terms">오늘의 한 단어/);
 assert.match(html,/section class="panel" id="song-terms"/);
 for(const id of ['sw-search','sw-category','sw-sort','sw-filter','sw-card-flip','sw-flash-body','sw-quiz-content']){
  if(id==='sw-card-flip'){assert.match(js,/sw-card-flip/);continue;}
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(html,/song-word-study-v1\.css/);
 assert.match(html,/song-word-study-v1\.js/);
 assert.ok(html.indexOf('song-word-study-v1.js')>html.indexOf('observatory-nav-v2.js'));
});
