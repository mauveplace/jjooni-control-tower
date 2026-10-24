(function(root){
'use strict';
const cache=new Map();
function read(path,ttl=30000){
 const url=new URL(path,root.location.href);url.searchParams.delete('cb');url.searchParams.delete('refresh');const key=url.href,old=cache.get(key),now=Date.now();
 if(old&&(old.pending||now-old.at<ttl))return old.promise;
 const item={at:now,pending:true};
 item.promise=fetch(key,{cache:'no-cache',signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(data=>{item.pending=false;item.at=Date.now();return data},error=>{if(cache.get(key)===item)cache.delete(key);throw error});cache.set(key,item);return item.promise;
}
root.JjooniDataReads={read};
})(window);
