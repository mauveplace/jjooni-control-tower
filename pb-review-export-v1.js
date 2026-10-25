(function(root){
'use strict';
if(!root.document||root.__JJOONI_PB_REVIEW_EXPORT)return;
root.__JJOONI_PB_REVIEW_EXPORT=true;
function exportView(){
 const copy=document.documentElement.cloneNode(true),sourceCanvases=[...document.querySelectorAll('canvas')];
 let missingStyles=0;
 // Inline available styles so a PB can inspect the saved view without logging in.
 copy.querySelectorAll('link[rel="stylesheet"]').forEach(link=>{
  const original=[...document.styleSheets].find(s=>s.href===new URL(link.getAttribute('href'),location.href).href);
  try{if(!original)throw Error('stylesheet unavailable');const style=document.createElement('style');style.textContent=[...original.cssRules].map(r=>r.cssText).join('\n');link.replaceWith(style)}catch(_){missingStyles++;link.remove()}
 });
 copy.querySelectorAll('canvas').forEach((c,i)=>{try{const img=document.createElement('img');img.src=sourceCanvases[i].toDataURL();img.alt='저장 시점 그래프';img.style.cssText='max-width:100%;height:auto';c.replaceWith(img)}catch(_){c.replaceWith(document.createTextNode('그래프 저장 불가'))}});
 // No executable account data, credentials, forms, callbacks or network refresh survive.
 copy.querySelectorAll('script,form,input,iframe,object,embed,#ctPbReviewTools,meta[http-equiv="refresh"]').forEach(e=>e.remove());
 copy.querySelectorAll('*').forEach(e=>{for(const a of [...e.attributes])if(/^on/i.test(a.name))e.removeAttribute(a.name);if(e.getAttribute('href')?.trim().toLowerCase().startsWith('javascript:'))e.removeAttribute('href')});
 copy.querySelectorAll('button,select,textarea').forEach(e=>e.disabled=true);
 copy.querySelectorAll('link').forEach(e=>e.remove());
 const body=copy.querySelector('body'),banner=document.createElement('aside');banner.textContent='PB 화면 검수본 · '+new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' KST · 저장 시점 화면 · 실시간 갱신 없음 · 계좌정보 포함';banner.style.cssText='padding:18px;background:#fff1cc;color:#302500;font:700 16px system-ui';body.prepend(banner);
 if(missingStyles)banner.append(document.createTextNode(' · 일부 외부 스타일 저장 불가'));
 const source=root.__JJOONI_CANONICAL_SSOT;
 const section=document.createElement('section');section.style.cssText='margin:20px;padding:18px;background:#fff;color:#111;border:1px solid #aaa';
 const title=document.createElement('h2');title.textContent='PB 분석용 계좌 스냅샷 · 저장 시점';section.append(title);
 const pre=document.createElement('pre');pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 monospace';
 // Explicit source whitelist. Never export the runtime window, password or API proofs.
 const snapshot={schema:'JJOONI_PB_REVIEW_V1',exported_at:new Date().toISOString(),live_refresh:false,scope:'CURRENT_RENDERED_VIEW_AND_CANONICAL_ACCOUNTS',snapshot:source?Object.fromEntries(['snapshot_id','generated_kst','observed_at','freshness','quality','accounts','total','fx'].filter(k=>source[k]!==undefined).map(k=>[k,source[k]])):null};
 pre.textContent=source?JSON.stringify(snapshot,(k,v)=>/password|credential|secret|token|api.?key|authorization|session_pw/i.test(k)?undefined:v,2):'계좌 스냅샷 미연결 · 화면만 저장됨. 현재 보유·최신성은 별도 확인이 필요합니다.';
 section.append(pre);body.append(section);
 const blob=new Blob(['<!doctype html>\n'+copy.outerHTML],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='JJOONI_PB_review_'+new Date().toISOString().slice(0,10)+'.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const box=document.createElement('div');box.id='ctPbReviewTools';box.style.cssText='display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin:12px;padding:8px';
const save=document.createElement('button');save.type='button';save.textContent='PB 검수본 저장';save.title='로그인 없이 열 수 있는 현재 화면과 계좌 스냅샷을 HTML로 저장합니다. 로이·짱구 채팅에 파일을 첨부하세요.';save.onclick=exportView;
const forget=document.createElement('button');forget.type='button';forget.textContent='기기 승인 해제';forget.onclick=async()=>{try{await root.JjooniTrustedDevice?.forget();sessionStorage.removeItem('jjooni_ct_session_pw');localStorage.removeItem('jjooni_ct_device_autofill');location.reload()}catch(_){forget.textContent='해제 실패 · 다시 시도'}};
for(const b of [save,forget]){b.style.cssText='min-height:44px;padding:8px 12px;border:1px solid #647a94;border-radius:9px;background:#fff;color:#142b45;font:700 13px system-ui';box.append(b)}(document.querySelector('.app')||document.body).append(box);
if(root.__CT_DEVICE_APPROVAL_WARNING){const warning=document.createElement('p');warning.textContent=root.__CT_DEVICE_APPROVAL_WARNING;warning.setAttribute('role','status');box.append(warning)}
})(window);
