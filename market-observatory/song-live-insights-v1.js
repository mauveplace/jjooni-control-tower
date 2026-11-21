/* 송팀장 2026-11-21 공개 라이브 해설 · read-only educational reference.
 * NEVER a broker signal/order; no Plaud private source IDs in this asset.
 */
(function () {
  'use strict';
  var target = document.getElementById('song-live-insights');
  if (!target) return;
  var status = document.getElementById('songLiveStatus');
  var cards = document.getElementById('songLiveCards');
  function el(tag,cls,text){
    var x=document.createElement(tag);
    if(cls)x.className=cls;
    if(text!==undefined)x.textContent=String(text);
    return x;
  }
  function item(item,index){
    var node=el('details','songLiveItem');
    if(index===0)node.open=true;
    var summary=el('summary','songLiveSummary');
    var label=el('span','songLiveCat',item.category);
    var title=el('span','songLiveItemTitle',item.title);
    summary.append(label,title);
    var body=el('div','songLiveBody');
    [
      ['방송에서 확인한 내용',item.speaker],
      ['옵저버토리 적용 아이디어',item.application],
      ['주의 · 자동매매 신호 아님',item.caution]
    ].forEach(function(pair){
      var b=el('div','songLiveDetail');
      b.append(el('strong','',pair[0]),el('p','',pair[1]));
      body.append(b);
    });
    node.append(summary,body);
    return node;
  }
  function render(data){
    if(data.schema!=='SONG_LIVE_INSIGHTS_V1'||!Array.isArray(data.items)||!data.items.length)
      throw new Error('자료 형식 오류');
    var ids=new Set();
    data.items.forEach(function(x){
      if(!x.id||!x.category||!x.title||!x.speaker||!x.application||!x.caution||ids.has(x.id))throw new Error('용어 데이터 오류');
      ids.add(x.id);
    });
    cards.replaceChildren(...data.items.map(item));
    status.textContent=data.published_note_date+' 라이브 녹취 확인 · '+data.items.length+'개 인사이트 · 읽기 전용 참고';
  }
  fetch('./data/song-live-insights.json?v=20261121-v1',{cache:'no-store'})
    .then(function(r){if(!r.ok)throw new Error('자료 응답 '+r.status);return r.json();})
    .then(render)
    .catch(function(err){
      if(status)status.textContent='방송 참고자료를 불러올 수 없습니다 ('+err.message+'). 새로고침해 주세요.';
      if(cards)cards.replaceChildren();
    });
})();