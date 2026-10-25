const assert=require('node:assert/strict'),fs=require('node:fs');
const {webcrypto}=require('node:crypto'),{chromium}=require('playwright');
(async()=>{
 const password='synthetic-browser-approval-only',b64=b=>Buffer.from(b).toString('base64');
 const salt=webcrypto.getRandomValues(new Uint8Array(16)),nonce=webcrypto.getRandomValues(new Uint8Array(12)),aad=Buffer.from('fixture');
 const raw=await webcrypto.subtle.importKey('raw',Buffer.from(password),'PBKDF2',false,['deriveKey']);
 const key=await webcrypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:1000,hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['encrypt']);
 const html='<html><head><title>Approved fixture</title></head><body><main class="app"><h1>AUTHORIZED FIXTURE</h1><canvas width="120" height="80"></canvas><button onclick="alert(1)">old control</button></main></body></html>';
 const ciphertext=await webcrypto.subtle.encrypt({name:'AES-GCM',iv:nonce,additionalData:aad},key,Buffer.from(html));
 const payload={salt:b64(salt),nonce:b64(nonce),aad:b64(aad),iterations:1000,ciphertext:b64(ciphertext)};
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true}),page=await context.newPage();let unavailable=false,wrong=false;
  await page.route('https://ct.test/**',route=>{
   const name=new URL(route.request().url()).pathname.slice(1);
   if(!name)return route.fulfill({contentType:'text/html',body:fs.readFileSync('index.html','utf8')});
   if(name==='payload.json')return route.fulfill({status:unavailable?503:200,contentType:'application/json',body:JSON.stringify(wrong?{...payload,ciphertext:b64(Buffer.alloc(100))}:payload)});
   if(['device-trust-v1.js','pb-review-export-v1.js'].includes(name))return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(name,'utf8')});
   return route.fulfill({contentType:name.endsWith('.css')?'text/css':'application/javascript',body:''});
  });
  const approved=()=>page.getByRole('heading',{name:'AUTHORIZED FIXTURE'}).waitFor();
  const capsule=()=>page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('jjooni-trusted-browser-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return new Promise(resolve=>{const tx=db.transaction('capsule');const r=tx.objectStore('capsule').get('unlock');r.onsuccess=()=>resolve(r.result?{version:r.result.version,expires:r.result.expires}:null);tx.oncomplete=()=>db.close()})});
  await page.goto('https://ct.test/');await page.locator('#loginForm').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#pw').fill(password);await page.getByRole('button',{name:'기기 승인',exact:true}).click();await approved();assert.equal((await capsule()).version,2);
  // A new tab has no session password: the persisted approval alone must open it.
  await page.evaluate(()=>sessionStorage.clear());await page.reload();await approved();assert.equal(await page.locator('#loginForm').count(),0);
  unavailable=true;await page.reload();await page.locator('#retryOpen').waitFor({state:'visible'});assert.equal(await page.locator('#loginForm').isVisible(),false);assert.equal((await capsule()).version,2);
  unavailable=false;await page.locator('#retryOpen').click();await approved();
  // Store an identifiable snapshot, export it, and inspect it with no credential/session.
  await page.evaluate(()=>{window.__JJOONI_CANONICAL_SSOT={snapshot_id:'fixture-001',accounts:{TOSS:{nav:123,quality:'BROKER_MEASURED',password:'NEVER_EXPORT_ME',positions:[{ticker:'TEST',qty:1}]}},total:{nav:123}};const c=document.querySelector('canvas');c.getContext('2d').fillRect(0,0,40,30)});
  const waitDownload=page.waitForEvent('download');await page.getByRole('button',{name:'PB 검수본 저장'}).click();const download=await waitDownload;const exported=fs.readFileSync(await download.path(),'utf8');
  assert(!exported.includes('<script'));assert(!exported.includes('NEVER_EXPORT_ME'));assert(!exported.includes(password));assert(exported.includes('fixture-001'));assert(exported.includes('data:image/png'));
  const fresh=await browser.newContext();const review=await fresh.newPage();await review.setContent(exported);assert.match(await review.locator('body').innerText(),/fixture-001/);assert.equal(await review.locator('script').count(),0);await fresh.close();
  wrong=true;await page.reload();await page.locator('#loginForm').waitFor({state:'visible'});assert.equal(await capsule(),null);
  wrong=false;await page.locator('#pw').fill(password);await page.getByRole('button',{name:'기기 승인',exact:true}).click();await approved();await page.getByRole('button',{name:'기기 승인 해제'}).click();await page.locator('#loginForm').waitFor({state:'visible'});assert.equal(await capsule(),null);
  await page.screenshot({path:'/tmp/ct-device-enrollment.png'});await context.close();
  console.log('PASS mobile enrollment; approved browser auto-open; transient retry retains approval; wrong key reapproval; revoke; credential-free PB review');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
