/* Browser-scoped unlock capsule. Never fingerprints hardware or transmits secrets. */
(function(root){
'use strict';
const DB='jjooni-trusted-browser-v1',STORE='capsule';
function database(){return new Promise((resolve,reject)=>{
 let settled=false;const q=indexedDB.open(DB,1);
 const fail=error=>{if(settled)return;settled=true;clearTimeout(timer);reject(error)};
 const timer=setTimeout(()=>fail(Error('DEVICE_STORAGE_TIMEOUT')),4000);
 q.onblocked=()=>fail(Error('DEVICE_STORAGE_BLOCKED'));
 q.onupgradeneeded=()=>{if(settled){q.transaction?.abort();return}q.result.createObjectStore(STORE)};
 q.onsuccess=()=>{if(settled){q.result.close();return}settled=true;clearTimeout(timer);resolve(q.result)};
 q.onerror=()=>fail(q.error);
})}
async function record(mode,operation){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),q=operation(tx.objectStore(STORE));let result;q.onsuccess=()=>{result=q.result};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}}
async function forget(){await record('readwrite',s=>s.delete('unlock'))}
async function remember(password){const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']),iv=crypto.getRandomValues(new Uint8Array(12)),aad=new TextEncoder().encode(location.origin),ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,new TextEncoder().encode(password));await record('readwrite',s=>s.put({version:2,key,iv,ciphertext,origin:location.origin,approved_at:Date.now()},'unlock'))}
async function restore(){
 const r=await record('readonly',s=>s.get('unlock'));if(!r)return null;
 // Migrate valid v1 approvals only; revoked/expired legacy approvals stay invalid.
 const legacy=r.version===undefined;
 if(r.origin!==location.origin||(!legacy&&r.version!==2)||(legacy&&(!Number.isFinite(r.expires)||Date.now()>=r.expires))){await forget();return null}
 let password;try{password=new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:r.iv,additionalData:new TextEncoder().encode(location.origin)},r.key,r.ciphertext))}catch(_){await forget();return null}
 if(legacy){const migrated={...r,version:2,approved_at:Date.now()};delete migrated.expires;await record('readwrite',s=>s.put(migrated,'unlock'))}
 return password;
}
root.JjooniTrustedDevice={remember,restore,forget,approval_mode:'UNTIL_REVOKED'};
})(window);
