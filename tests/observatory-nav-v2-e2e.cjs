// Phase-1 contract: ?ui=v2 reaches all 13 legacy panels; default page unchanged.
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
    assert.equal(await page.locator('.navV2Bar').count(), 0, 'default page has no v2 nav');
    assert.ok(await page.locator('#tabs').isVisible(), 'legacy tabs visible by default');
    await page.goto(BASE + '?ui=v2', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelectorAll('#tabs button[data-tab]').length >= 13);
    assert.equal(await page.locator('#tabs').isVisible(), false, 'legacy tabs hidden under v2');
    const ia = await page.evaluate(() => window.__JJOONI_NAV_V2.IA);
    let reached = 0;
    for (const g of ia) {
      await page.locator(`.navV2Main button[data-group="${g.id}"]`).click();
      for (const tab of g.tabs) {
        if (g.tabs.length > 1) await page.locator(`.navV2Sub button[data-tab="${tab}"]`).click();
        await page.waitForFunction(t => document.getElementById(t)?.classList.contains('on'), tab, { timeout: 15000 });
        assert.equal(await page.locator(`.navV2Main button[data-group="${g.id}"]`).getAttribute('aria-current'), 'page');
        reached++;
      }
    }
    assert.equal(reached, 13);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(overflow <= 1, 'no horizontal overflow ' + overflow);
    const small = await page.evaluate(() => [...document.querySelectorAll('.navV2Main button')].filter(b => b.getBoundingClientRect().height < 44).length);
    assert.equal(small, 0, 'main tabs >= 44px');
    await page.goto(BASE + '?ui=v1', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.navV2Bar').count(), 0, '?ui=v1 rolls back');
    assert.deepEqual(errors, []);
    console.log('OBS_NAV_V2_PASS width=' + width + ' panels=' + reached);
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
