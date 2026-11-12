// Phase-2 contract: ?ui=v2 renders the 오늘 screen from published data; default page unchanged.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const BASE = process.env.URL || 'http://127.0.0.1:8123/market-observatory/';
(async () => {
  const browser = await chromium.launch();
  for (const width of [390, 1363]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('.todayV2').count(), 0, 'default page has no v2 today screen');
    await page.goto(BASE + '?ui=v2', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__JJOONI_TODAY_V2?.rendered === true, null, { timeout: 20000 });
    const vm = await page.evaluate(() => window.__JJOONI_TODAY_V2.vm);
    const glance = await page.evaluate(() => fetch('./data/daily-glance.json?cb=' + Date.now()).then(r => r.json()));
    assert.equal(vm.tripod.pod, glance.tripod.pod, 'TRI-POD state is the published one');
    const rows = glance.groups.reduce((n, g) => n + g.items.length, 0);
    assert.equal(await page.locator('.todayV2 tbody tr[data-key]').count(), rows, 'every published glance row shown');
    assert.ok(await page.locator('.todayV2 .tV2NoTrade').isVisible());
    assert.equal(await page.locator('.todayV2 .tV2Cond').count(), vm.tripod.conds.length);
    if (glance.brief_check?.official_status !== 'VERIFIED') {
      assert.ok(await page.locator('.todayV2 .tV2Alert').isVisible(), 'unverified NDX raises the alert band');
      assert.equal(await page.locator('.todayV2 tr[data-key="NASDAQ100"] .tV2Tag').getAttribute('title'), '? 검증 보류');
      assert.ok(await page.locator('.todayV2 tr[data-key="NASDAQ100"] .tV2Tag').isVisible(), 'state tag visible at ' + width);
    }
    const box = await page.locator('.todayV2').boundingBox();
    assert.ok(box && box.y < 1000, 'today screen near the top: y=' + (box && box.y));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(overflow <= 1, 'no horizontal overflow ' + overflow);
    await page.locator('.todayV2 [data-go="morning-brief"]').click();
    await page.waitForFunction(() => document.getElementById('morning-brief')?.classList.contains('on'));
    assert.ok(await page.locator('#overview').count(), 'legacy overview still present');
    assert.equal(await page.locator('.todayV2').isVisible(), false, 'today screen hidden on other tabs');
    await page.locator('.navV2Main button[data-group="today"]').click();
    await page.waitForFunction(() => !document.querySelector('.todayV2').hidden);
    assert.deepEqual(errors, []);
    console.log('OBS_TODAY_V2_PASS width=' + width + ' rows=' + rows + ' alerts=' + vm.alerts.length + ' y=' + Math.round(box.y));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
