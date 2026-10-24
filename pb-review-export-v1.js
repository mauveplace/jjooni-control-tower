(function(root){
'use strict';
if(!root.document||root.__JJOONI_PB_REVIEW_EXPORT)return;
root.__JJOONI_PB_REVIEW_EXPORT=true;
function exportView(){
 const copy=document.documentElement.cloneNode(true),sourceCanvases=[...document.querySelectorAll('canvas')];
 copy.querySelectorAll('canvas').forEach((c,i)=>{try{const img=document.createElement('img');img.src=sourceCanvases[i].toDataURL();img.alt='저장 시점 그래프';img.style.cssText='max-width:100%;height:auto';c.replaceWith(img)}catch(_){c.replaceWith(document.createTextNode('그래프 저장 불가'))}});
 // No executable account data, credentials, forms, callbacks or network refresh survive.
 copy.querySelectorAll('script,form,input,iframe,object,embed,#ctPbReviewTools,meta[http-equiv="refresh"]').forEach(e=>e.remove());
 copy.querySelectorAll('*').forEach(e=>{for(const a of [...e.attributes])if(/^on/i.test(a.name))e.removeAttribute(a.name);if(e.getAttribute('href')?.trim().toLowerCase().startsWith('javascript:'))e.removeAttribute('href')});
 copy.querySelectorAll('link[href]').forEach(e=>e.href=new URL(e.getAttribute('href'),location.href).href);
 const body=copy.querySelector('body'),banner=document.createElement('aside');banner.textContent='PB 화면 검수본 · '+new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' KST · 저장 시점 화면 · 실시간 갱신 없음 · 계좌정보 포함';banner.style.cssText='padding:18px;background:#fff1cc;color:#302500;font:700 16px system-ui';body.prepend(banner);
 const blob=new Blob(['<!doctype html>\n'+copy.outerHTML],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='JJOONI_PB_review_'+new Date().toISOString().slice(0,10)+'.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const box=document.createElement('div');box.id='ctPbReviewTools';box.style.cssText='display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin:12px;padding:8px';
const save=document.createElement('button');save.type='button';save.textContent='PB 검수본 저장';save.title='계좌정보가 포함된 현재 화면을 HTML 파일로 저장합니다. 공유할 PB에게 직접 전달하세요.';save.onclick=exportView;
const forget=document.createElement('button');forget.type='button';forget.textContent='기기 승인 해제';forget.onclick=async()=>{try{await root.JjooniTrustedDevice?.forget();sessionStorage.removeItem('jjooni_ct_session_pw');localStorage.removeItem('jjooni_ct_device_autofill');location.reload()}catch(_){forget.textContent='해제 실패 · 다시 시도'}};
for(const b of [save,forget]){b.style.cssText='min-height:44px;padding:8px 12px;border:1px solid #647a94;border-radius:9px;background:#fff;color:#142b45;font:700 13px system-ui';box.append(b)}(document.querySelector('.app')||document.body).append(box);
})(window);
