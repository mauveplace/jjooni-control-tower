/* JJOONI Observatory · Song Word Study. Static source-verified educational content only. */
(function () {
  "use strict";
  var root = document.getElementById("song-terms");
  if (!root) return;
  var DATA = null;
  var state = { mode:"list", q:"", category:"all", filter:"all", sort:"recent",
    flashIndex:0, revealed:false, quizItems:[], quizIndex:0, quizSelected:null, quizScore:0 };
  var KEY = "jjooni.songwords.learned.v1";
  var learned = {};
  try { learned = JSON.parse(localStorage.getItem(KEY) || "{}"); if (!learned || Array.isArray(learned)) learned = {}; } catch(_) { learned = {}; }
  var $ = function(id){ return document.getElementById(id); };
  var enc = function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});};
  var total = function(){ return DATA && DATA.entries ? DATA.entries.length : 0; };
  function save() { try { localStorage.setItem(KEY,JSON.stringify(learned)); } catch(_) {} }
  function visible(){
    if(!DATA) return [];
    var q=state.q.toLocaleLowerCase("ko");
    var items=DATA.entries.filter(function(x){
      return (state.category==="all"||x.category===state.category) &&
        (state.filter!=="pending"||!learned[x.id]) &&
        (!q || (x.term+" "+x.english+" "+x.meaning+" "+x.category).toLocaleLowerCase("ko").indexOf(q)>-1);
    });
    if(state.sort==="oldest") items.sort(function(a,b){return a.date.localeCompare(b.date);});
    else if(state.sort==="alphabetical") items.sort(function(a,b){return a.term.localeCompare(b.term,"ko");});
    else items.sort(function(a,b){return b.date.localeCompare(a.date);});
    return items;
  }
  function counts(){
    if(!DATA)return;
    var done=DATA.entries.filter(function(x){return !!learned[x.id];}).length;
    $("sw-count").textContent=String(total());
    $("sw-progress").textContent=done+" / "+total();
    $("sw-categories").textContent=String(new Set(DATA.entries.map(function(x){return x.category;})).size);
    $("sw-hero-count").textContent=total()+"개";
  }
  function card(x){
    var done=!!learned[x.id], open = state.expandedId===x.id;
    return '<article class="sw-card'+(open?' expanded':'')+'" role="listitem">'+
      '<div class="sw-card-head"><div><span class="sw-date">'+enc(x.date)+'</span><span class="sw-cat">'+enc(x.category)+'</span></div><span class="sw-date">'+(done?"✓ 학습 완료":"원문 확인")+'</span></div>'+
      '<h3>'+enc(x.term)+'</h3><div class="sw-english">'+enc(x.english)+'</div>'+
      '<p class="sw-def">'+enc(x.meaning)+'</p>'+
      '<div class="sw-actions"><button class="sw-btn '+(open?"sw-primary":"")+'" data-sw-action="expand" data-id="'+enc(x.id)+'" aria-expanded="'+(open?"true":"false")+'">'+(open?"설명 접기":"송팀장 맥락·예시 보기")+'</button>'+
      '<button class="sw-btn '+(done?"sw-done":"")+'" data-sw-action="learn" data-id="'+enc(x.id)+'" aria-label="'+enc(x.term)+' 학습 상태 전환">'+(done?"✓ 익힘":"공부했어요")+'</button></div>'+
      '<div class="sw-detail"><strong>송팀장 원문에서의 설명 맥락</strong><p>'+enc(x.speaker_context)+'</p>'+
      '<strong>학습 예시 · 원문 인용 아님</strong><p>'+enc(x.study_example)+'</p>'+
      '<div class="sw-warn"><strong>실무 해설 · 오해 방지</strong><p style="margin-bottom:0">'+enc(x.caution)+'</p></div>'+
      '<p class="sw-smallnote">출처: '+enc(x.date)+' 송팀장 일일시황 '+(x.source_type==="TRANSCRIPT"?"녹취록":"PDF 텍스트")+
      '. 원문 전체는 공개하지 않으며, 설명은 교육용으로 재서술했습니다.</p></div></article>';
  }
  function renderList(){
    var list=visible();
    $("sw-results").textContent=list.length+"개 용어";
    $("sw-item-list").innerHTML = list.length ? list.map(card).join("") :
      '<div class="sw-blank">조건에 맞는 용어가 없습니다. 검색어 또는 필터를 변경해 보세요.</div>';
  }
  function flash(){
    var items=visible(), box=$("sw-flash-body");
    if(!items.length){box.innerHTML='<div class="sw-blank">암기할 용어가 없습니다. 필터를 변경하세요.</div>';return;}
    state.flashIndex=((state.flashIndex%items.length)+items.length)%items.length;
    var x=items[state.flashIndex];
    $("sw-flash-counter").textContent=(state.flashIndex+1)+" / "+items.length+"개";
    box.innerHTML='<button class="sw-flash" id="sw-card-flip" type="button" aria-label="플래시카드 뒤집기">'+
      '<small>'+enc(x.category)+' · '+enc(x.date)+'</small><b>'+enc(state.revealed?x.meaning:x.term)+'</b>'+
      '<span>'+(state.revealed?enc(x.term)+" · "+enc(x.english):"카드를 눌러 뜻을 확인하세요")+'</span>'+
      '</button><div class="sw-flash-actions">'+
      '<button class="sw-btn" data-sw-action="previous">이전</button>'+
      '<button class="sw-btn sw-primary" data-sw-action="flip">'+(state.revealed?"단어 보기":"뜻 확인")+'</button>'+
      '<button class="sw-btn" data-sw-action="next">다음</button>'+
      '<button class="sw-btn '+(learned[x.id]?"sw-done":"")+'" data-sw-action="flashlearn">'+(learned[x.id]?"✓ 익힘":"공부했어요")+'</button></div>';
  }
  function buildQuiz(){
    var items=visible();
    if(!items.length){$("sw-quiz-content").innerHTML='<div class="sw-blank">퀴즈를 낼 용어가 없습니다. 필터를 변경하세요.</div>';return;}
    state.quizItems=items.slice().sort(function(){return Math.random()-.5;}).slice(0,Math.min(10,items.length));
    state.quizIndex=0;state.quizScore=0;state.quizSelected=null;
    showQuiz();
  }
  function showQuiz(){
    var box=$("sw-quiz-content");
    if(state.quizIndex>=state.quizItems.length){
      box.innerHTML='<div class="sw-quiz-box"><small class="sw-date">학습 완료</small><h2>복습 결과 '+state.quizScore+' / '+state.quizItems.length+'</h2>'+
        '<p class="sw-def">틀린 문제도 용어집에서 다시 확인할 수 있습니다. 결과는 투자판단의 신호가 아닙니다.</p>'+
        '<button class="sw-btn sw-primary" data-sw-action="restart">다시 도전하기</button></div>';return;
    }
    var x=state.quizItems[state.quizIndex];
    var peers=DATA.entries.filter(function(v){return v.id!==x.id;});
    var same=peers.filter(function(v){return v.category===x.category;});
    var others=same.concat(peers.filter(function(v){return v.category!==x.category;}));
    var n=state.quizIndex;var picks=[x];
    for(var z=0;z<others.length&&picks.length<4;z++){var j=(z+n*3)%others.length;var option=others[j];if(!picks.some(function(a){return a.term===option.term;})) picks.push(option);}
    var options=picks.slice().sort(function(a,b){return (a.term.charCodeAt(0)+n)%7-(b.term.charCodeAt(0)+n)%7;});
    var answered=state.quizSelected!==null;
    var buttons=options.map(function(v,i){
      var className="sw-option"+(answered&&v.id===x.id?" correct":"")+(answered&&state.quizSelected===v.id&&v.id!==x.id?" wrong":"");
      return '<button class="'+className+'" data-sw-action="answer" data-id="'+enc(v.id)+'"'+(answered?" disabled":"")+'>'
       +(i+1)+'. '+enc(v.term)+'</button>';
    }).join("");
    box.innerHTML='<div class="sw-quiz-box"><div class="sw-date">문제 '+(state.quizIndex+1)+' / '+state.quizItems.length+' · 정답 '+state.quizScore+'개</div>'+
      '<div class="sw-quiz-prompt">다음 설명에 해당하는 단어는 무엇일까요?</div>'+
      '<p class="sw-def">'+enc(x.meaning)+'</p><div class="sw-options">'+buttons+'</div>'+
      (answered?'<div class="sw-feedback"><b>'+(state.quizSelected===x.id?"정답입니다!":"다시 살펴봐요: "+enc(x.term))+
      '</b><div>'+enc(x.caution)+'</div></div><div class="sw-actions"><button class="sw-btn sw-primary" data-sw-action="quiznext">다음 문제</button></div>':"")+'</div>';
  }
  function switchMode(mode){
    state.mode=mode;
    Array.from(root.querySelectorAll("[data-sw-mode]")).forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.swMode===mode));});
    $("sw-list-view").hidden=mode!=="list";
    $("sw-flash-view").hidden=mode!=="flash";
    $("sw-quiz-view").hidden=mode!=="quiz";
    if(mode==="list")renderList();
    if(mode==="flash"){state.flashIndex=0;state.revealed=false;flash();}
    if(mode==="quiz")buildQuiz();
  }
  function toggleLearn(id){learned[id]=!learned[id];save();counts();if(state.mode==="list")renderList();else flash();}
  function wire(){
    root.addEventListener("click",function(e){
      var mode=e.target.closest("[data-sw-mode]");
      if(mode){switchMode(mode.dataset.swMode);return;}
      var b=e.target.closest("[data-sw-action]");
      if(!b)return;
      var a=b.dataset.swAction,id=b.dataset.id;
      if(a==="expand"){state.expandedId=state.expandedId===id?null:id;renderList();}
      else if(a==="learn")toggleLearn(id);
      else if(a==="flip"){state.revealed=!state.revealed;flash();}
      else if(a==="previous"||a==="next"){state.flashIndex+=(a==="next"?1:-1);state.revealed=false;flash();}
      else if(a==="flashlearn"){var items=visible();if(items.length)toggleLearn(items[(state.flashIndex%items.length+items.length)%items.length].id);}
      else if(a==="answer"&&state.quizSelected===null){
        state.quizSelected=id;if(id===state.quizItems[state.quizIndex].id)state.quizScore++;showQuiz();
      }
      else if(a==="quiznext"){state.quizIndex++;state.quizSelected=null;showQuiz();}
      else if(a==="restart")buildQuiz();
    });
    $("sw-search").addEventListener("input",function(e){state.q=e.target.value.trim();state.flashIndex=0;renderList();});
    $("sw-category").addEventListener("change",function(e){state.category=e.target.value;state.flashIndex=0;renderList();});
    $("sw-filter").addEventListener("change",function(e){state.filter=e.target.value;state.flashIndex=0;renderList();});
    $("sw-sort").addEventListener("change",function(e){state.sort=e.target.value;state.flashIndex=0;renderList();});
  }
  var loading=null;
  function load(){
    if(DATA)return Promise.resolve(DATA);
    if(loading)return loading;
    $("sw-status").textContent="원본에서 검증된 학습자료를 불러오는 중입니다…";
    loading=fetch("./data/song-word-study.json?v=20261121-1",{cache:"no-store"})
      .then(function(r){if(!r.ok)throw new Error("데이터 응답 오류 "+r.status);return r.json();})
      .then(function(d){
        if(d.schema!=="SONG_WORD_STUDY_V1"||!Array.isArray(d.entries)||!d.entries.length)throw new Error("학습자료 형식 오류");
        var ids=new Set();
        d.entries.forEach(function(x){
          if(!x.id||!x.date||!x.term||!x.meaning||!x.speaker_context||ids.has(x.id))throw new Error("필수 용어 정보 누락 또는 중복");
          ids.add(x.id);
        });
        DATA=d;
        var cats=[...new Set(d.entries.map(function(x){return x.category;}))].sort();
        $("sw-category").innerHTML='<option value="all">전체 분야</option>'+cats.map(function(c){return '<option value="'+enc(c)+'">'+enc(c)+'</option>';}).join("");
        $("sw-status").textContent="원본 확인된 "+d.entries.length+"개 용어 · "+d.as_of_kst+" 기준";
        counts();wire();switchMode("list");
        return DATA;
      }).catch(function(e){
        $("sw-status").textContent="학습자료 불러오기 실패: "+e.message;
        $("sw-item-list").innerHTML='<div class="sw-blank">일시적으로 학습 데이터를 가져올 수 없습니다. 연결 상태를 확인하고 다시 열어 주세요.</div>';
        loading=null;throw e;
      });
    return loading;
  }
  document.addEventListener("click",function(e){if(e.target.closest('#tabs button[data-tab="song-terms"]')) load().catch(function(){});});
  function direct(){
    if(location.hash==="#song-terms"){
      var b=document.querySelector('#tabs button[data-tab="song-terms"]');
      if(b)b.click();
    }else if(document.querySelector("#song-terms.panel.on"))load().catch(function(){});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",direct);else direct();
  window.__JJOONI_SONG_WORD_STUDY_V1 = {version:"1.0",load:load};
})();