// Live, unauthenticated production browser measurement. NO private/account APIs.
const { chromium }=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const url=process.env.OBS_AUDIT_BASE_URL||'https://mauveplace.github.io/jjooni-control-tower/market-observatory/';
const cases=[{name:'mobile390',width:390,height:844},{name:'tablet800',width:800,height:1024},{name:'desktop1440',width:1440,height:900}];
function box(e){if(!e)return null;const r=e.getBoundingClientRect();return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),right:+r.right.toFixed(1)};}
(async()=>{
 const browser=await chromium.launch({headless:true});
 fs.mkdirSync('artifacts/observatory-v3-live-screen',{recursive:true});
 let failures=0;
 try{
  for(const tc of cases){
   const page=await browser.newPage({viewport:{width:tc.width,height:tc.height},deviceScaleFactor:1,hasTouch:tc.width<=430,isMobile:tc.width<=430});
   const pageerrors=[]; page.on('pageerror',e=>pageerrors.push(e.message));
   const failuresReq=[];page.on('requestfailed',r=>failuresReq.push(r.url()+' '+r.failure()?.errorText));
   try{
    await page.goto(url+'?live_audit=20261121',{waitUntil:'domcontentloaded',timeout:90000});
    // Post-merge main push may start before GitHub Pages publishes its HTML.
    // Require the new board asset before assessing the mobile chip fit.
    if(process.env.GITHUB_EVENT_NAME==='push'){
     const localHtml=fs.readFileSync('market-observatory/index.html','utf8');
     const expectedBoard=localHtml.match(/latest-board-v1\.js\?v=([^"]+)/)?.[1];
     const expectedRegime=localHtml.match(/market-regime-v1\.js\?v=([^"]+)/)?.[1];
     assert(expectedBoard&&expectedRegime,'Missing versioned live board/regime source in checked-in HTML');
     for(let attempt=0;attempt<18;attempt++){
      const board=await page.locator('script[src*="latest-board-v1.js"]').getAttribute('src');
      const regime=await page.locator('script[src*="market-regime-v1.js"]').getAttribute('src');
      if(board?.includes(expectedBoard)&&regime?.includes(expectedRegime))break;
      assert(attempt<17,'Live Pages still has old board/regime asset after bounded publication retry');
      await page.waitForTimeout(7000);
      await page.reload({waitUntil:'domcontentloaded',timeout:90000});
     }
    }
    await page.waitForFunction(()=>document.body.classList.contains('obsV3') && window.__JJOONI_OBS_V3?.enabled?.(location.search)===true,{timeout:45000});
    await page.waitForSelector('#ov3TripodRail .ov3Rail',{timeout:65000});
    await page.waitForSelector('#ov3MarketStrip [data-ov3-quote="NASDAQ100"]',{timeout:30000});
    const model=await page.evaluate(async()=>{
     const fetchJson=async p=>{const r=await fetch(p+'?audit='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(p+' HTTP '+r.status);return r.json()};
     const [g,f,s,d]=await Promise.all(['./data/daily-glance.json','./data/freshness-status.json','./data/sector-rotation-brief.json','../public-market-daily.json'].map(fetchJson));
     const m=window.__JJOONI_OBS_V3.model(g,f,s,Date.now(),d);
     const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
     const rail=document.querySelector('#ov3TripodRail .ov3Rail');
     const strip=document.querySelector('#ov3MarketStrip');
     const marks=[...rail.querySelectorAll('.ov3Mark')].map(e=>({point:e.dataset.ov3Point,rect:rect(e)}));
     const cards=[...rail.querySelectorAll('.ov3Threshold')].map(e=>({text:e.innerText.slice(0,100),rect:rect(e)}));
     const tiles=[...strip.querySelectorAll('.ov3StripTile')].map(e=>({key:e.dataset.ov3Quote,kind:e.dataset.quoteKind,text:e.innerText.slice(0,150),rect:rect(e)}));
     return {ready:m.ready,reason:m.reason,session:m.session,pod:m.pod,ndx:m.ndx,ma250:m.ma250,sectorReady:m.sectorReady,freshnessCurrent:m.freshnessCurrent,
      ledgerSession:g.us_session,ledgerPod:g.tripod.pod,ledgerNdx:g.tripod.ndx,sidecarSession:d.tripod_signal.date,sidecarPod:d.tripod_signal.target,
      sessionAligned:f.session_alignment.aligned,sourceGenerated:f.generated_kst,railText:rail.innerText.slice(0,950),
      stripText:strip.innerText.slice(0,750),marks,cards,tiles,
      headerChips:[...document.querySelectorAll('header.top #pulse .chip')].map(e=>({text:e.textContent.trim(),clientWidth:e.clientWidth,scrollWidth:e.scrollWidth})),
      viewport:innerWidth,docWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,
      railBox:rect(rail),stripBox:rect(strip),currentVersion:document.querySelector('script[src*="observatory-v3.js"]')?.getAttribute('src'),
      chartJs:typeof window.Chart,extraWarn:[...document.querySelectorAll('.ov3Pending,.ov3Stale')].map(e=>e.textContent.slice(0,200))};
    });
    assert.equal(model.ready,true,'canonical EOD TRI-POD model must be ready');
    assert.equal(model.session,model.ledgerSession);
    assert.equal(model.session,model.sidecarSession);
    assert.equal(model.pod,model.ledgerPod);
    assert(Math.abs(model.ndx-model.ledgerNdx)<0.06);
    assert.equal(model.sessionAligned,true);
    assert.equal(model.marks.length,4);
    assert(model.railText.includes(model.session),'TRI-POD rail date not visibly shown');
    assert(model.railText.includes(model.pod),'TRI-POD rail pod not visible');
    // PR CI audits the *already deployed* public site, not the unmerged PR.
    // On post-merge push, require Pages to serve the exact checked-in V3 asset.
    // Never hardcode a historical cache token: a legitimate release bumps it.
    const localHtml=fs.readFileSync('market-observatory/index.html','utf8');
    const expectedV3=localHtml.match(/observatory-v3\.js\?v=([^"]+)/)?.[1];
    assert(expectedV3,'checked-in V3 asset lacks version');
    assert(model.currentVersion?.includes('observatory-v3.js?v='),'V3 Javascript not loaded/versioned');
    if(process.env.GITHUB_EVENT_NAME==='push'){
      assert(model.currentVersion.includes(expectedV3),
        'Pages V3 JS release asset differs from merged source; deployment not yet verified');
    }
    assert(model.docWidth<=tc.width+3,'V3 homepage horizontal overflow '+model.docWidth);
    assert(model.bodyWidth<=tc.width+3,'V3 homepage body overflow '+model.bodyWidth);
    for(const o of [...model.cards,...model.tiles]){
      assert(o.rect.x>=-3&&o.rect.right<=tc.width+3,'card outside viewport '+JSON.stringify(o));
    }
    assert.equal(model.tiles.length,4,'NDX/S&P/SOX/VIX quote tiles are missing');
    if(tc.width<=430 && process.env.GITHUB_EVENT_NAME==='push'){
     assert(model.headerChips.some(x=>x.text.startsWith('NDX 25,028')||x.text.startsWith('NDX ')),'V3 mobile header must show compact NDX label');
     assert(model.headerChips.every(x=>x.scrollWidth<=x.clientWidth+1),'Header pulse value truncated '+JSON.stringify(model.headerChips));
    }
    const pageShot=await page.screenshot({path:'artifacts/observatory-v3-live-screen/'+tc.name+'-overview.png',fullPage:false});
    if(tc.name==='mobile390'||tc.name==='desktop1440'){
     console.log('AUDIT_IMAGE '+tc.name+'-overview '+(await page.screenshot({type:'jpeg',quality:47})).toString('base64'));
    }
    await page.locator('.navV2Main button[data-group="strategy"]').click();
    await page.locator('.navV2Sub button[data-tab="tripod"]').click();
    await page.waitForSelector('#ov3TripodDetail .ov3Rail',{timeout:30000});
    const detail=await page.evaluate(()=>{
      const root=document.querySelector('#ov3TripodDetail .ov3Rail');
      const content=root?.innerText||'';
      return {visible:!!root&&root.getBoundingClientRect().width>0,text:content.slice(0,900),date:document.querySelector('#ov3TripodDetail .ov3RailHeading small')?.textContent,
       marks:root?.querySelectorAll('[data-ov3-point]')?.length,docWidth:document.documentElement.scrollWidth};
    });
    assert.equal(detail.visible,true);
    assert(detail.text.includes(model.session),'TRI-POD tab date behind canonical session');
    assert(detail.text.includes(model.pod),'TRI-POD tab pod behind canonical session');
    assert.equal(detail.marks,4);
    assert(detail.docWidth<=tc.width+3,'TRI-POD tab horizontal overflow '+detail.docWidth);
    await page.screenshot({path:'artifacts/observatory-v3-live-screen/'+tc.name+'-tripod.png',fullPage:false});
    if(tc.name==='mobile390')console.log('AUDIT_IMAGE '+tc.name+'-tripod '+(await page.screenshot({type:'jpeg',quality:47})).toString('base64'));
    await page.locator('.navV2Sub button[data-tab="jjooni-tripod"]').click();
    await page.waitForSelector('#tcBody:not([hidden])',{timeout:70000});
    const comparison=await page.evaluate(async()=>{
     const d=await (await fetch('./data/tripod-comparison.json?audit='+Date.now(),{cache:'no-store'})).json();
     const e=document.querySelector('#tcStatus'),c=document.querySelector('#tcPrice');
     return {status:e?.innerText,bodyVisible:!document.querySelector('#tcBody')?.hidden,session:d.session,canonical_session:d.canonical_session,
      rows:d.rows?.length,lastDate:d.rows?.at(-1)?.[0],priceCanvas:{width:c?.width,height:c?.height},docWidth:document.documentElement.scrollWidth};
    });
    assert.equal(comparison.session,model.session,'comparison not synced to published canonical session');
    assert.equal(comparison.canonical_session,model.session);
    assert.equal(comparison.lastDate,model.session);
    assert(comparison.rows>=1000,'truncated comparison history');
    assert(comparison.priceCanvas.width>0&&comparison.priceCanvas.height>0,'comparison chart not rendered');
    assert(comparison.docWidth<=tc.width+3,'comparison panel horizontal overflow '+comparison.docWidth);
    await page.screenshot({path:'artifacts/observatory-v3-live-screen/'+tc.name+'-comparison.png',fullPage:false});
    if(tc.name==='mobile390')console.log('AUDIT_IMAGE '+tc.name+'-comparison '+(await page.screenshot({type:'jpeg',quality:43})).toString('base64'));
    // Verify the REAL public morning report after the last published report
    // changes; an unrelated V3/market green check is not publication proof.
    const expected=JSON.parse(fs.readFileSync('market-observatory/data/morning-brief/latest.json','utf8'));
    await page.locator('.navV2Main button[data-group="brief"]').click();
    await page.waitForSelector('#briefArticle h2',{timeout:45000});
    let morning=null;
    for(let attempt=0;attempt<18;attempt++){
     morning=await page.evaluate(async()=>{
      const r=await fetch('./data/morning-brief/latest.json?audit='+Date.now(),{cache:'no-store'});
      if(!r.ok)throw Error('Morning live latest HTTP '+r.status);
      const d=await r.json();
      const body=document.querySelector('#briefArticle');
      const sel=document.querySelector('#briefHistory');
      return {report_date_kst:d.report_date_kst,market_date_us:d.market_date_us,original_published_kst:d.published_kst,
       body_markdown:d.body_markdown,revision_count:d.revisions?.length||0,
       badge:document.querySelector('#briefBadge')?.textContent?.trim(),
       meta:document.querySelector('#briefMeta')?.innerText?.slice(0,350),
       title:document.querySelector('#briefTitle')?.textContent?.trim(),
       sections:body?.querySelectorAll('h2')?.length||0,
       tables:body?.querySelectorAll('table')?.length||0,
       status:document.querySelector('#briefLoadStatus')?.textContent?.slice(0,240),
       optionExists:[...sel?.options||[]].some(o=>o.textContent.includes(d.report_date_kst+' · 미국 '+d.market_date_us)&&!o.disabled),
       todayUnpublished:[...sel?.options||[]].some(o=>o.textContent.includes(d.report_date_kst+' · 미게시')),
       pageWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth};
     });
     if(morning.report_date_kst>expected.report_date_kst)break; // newer edition superseded this run
     if(morning.report_date_kst===expected.report_date_kst
         &&morning.revision_count >= (expected.revisions?.length||0)
         &&(morning.revision_count > (expected.revisions?.length||0) || morning.body_markdown===expected.body_markdown))break;
     assert(attempt<17,'Pages latest morning report not published after bounded retry');
     await page.waitForTimeout(5500);
     await page.reload({waitUntil:'domcontentloaded',timeout:90000});
     await page.locator('.navV2Main button[data-group="brief"]').click();
     await page.waitForSelector('#briefArticle h2',{timeout:45000});
    }
    assert(morning.report_date_kst>=expected.report_date_kst,'Pages report date regressed');
    assert(morning.market_date_us>=expected.market_date_us,'Pages completed US market date regressed');
    assert(morning.optionExists,'current published day must be selectable in report history');
    assert(!morning.todayUnpublished,'selected published day must not appear as missing');
    assert(morning.badge&& !morning.badge.includes('미게시'),'published morning badge still missing');
    assert.equal(morning.sections,8,'published morning article must render 8 sections');
    assert(morning.tables>=5,'5 market+sector tables missing from report article');
    assert(morning.pageWidth<=tc.width+3 && morning.bodyWidth<=tc.width+3,'morning article overflows '+JSON.stringify(morning));
    await page.screenshot({path:'artifacts/observatory-v3-live-screen/'+tc.name+'-brief.png',fullPage:false});
    console.log('V3_MORNING_BRIEF_PUBLICATION_PASS '+JSON.stringify({viewport:tc.name,date:morning.report_date_kst,us:morning.market_date_us,badge:morning.badge,sections:morning.sections,tables:morning.tables,revisions:morning.revision_count}));
    assert.equal(pageerrors.length,0,'uncaught JS errors '+pageerrors.join('; '));
    console.log('V3_PRODUCTION_VISUAL_PASS '+JSON.stringify({viewport:tc,model,detail,comparison,pageerrors,failed_requests:failuresReq.slice(0,12)}));
   }catch(e){
    failures++;
    console.error('V3_PRODUCTION_VISUAL_FAIL '+JSON.stringify({viewport:tc,error:String(e),pageerrors,failed_requests:failuresReq.slice(0,15)}));
    try{await page.screenshot({path:'artifacts/observatory-v3-live-screen/'+tc.name+'-FAILED.png',fullPage:false});}catch(_){}
   }finally{await page.close()}
  }
 }finally{await browser.close()}
 if(failures)process.exitCode=1;
})().catch(e=>{console.error('V3_PRODUCTION_AUDIT_FATAL',e);process.exitCode=1});
