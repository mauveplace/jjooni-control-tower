// v2 skin contract: shared blocks appear once on their owning tab; panels start near the nav.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const BASE = process.env.URL || 'http://127.0.0.1:8123/market-observatory/';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  assert.ok(await page.locator('#dailyGlance').isVisible(), 'v1 default keeps Daily Glance visible');
  await page.goto(BASE + '?ui=v2', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.dataset.v2tab && getComputedStyle(document.querySelector('header.top .sub')).display === 'none');
  const tabs = await page.evaluate(() => [...document.querySelectorAll('#tabs button[data-tab]')].map(b => b.dataset.tab));
  for (const t of tabs) {
    await page.evaluate(t => document.querySelector(`#tabs button[data-tab="${t}"]`).click(), t);
    await page.waitForFunction(t => document.body.dataset.v2tab === t, t);
    const r = await page.evaluate(t => ({ glance: !!document.getElementById('dailyGlance')?.offsetParent, fresh: !!document.getElementById('obsFreshnessPanel')?.offsetParent,
      gap: document.getElementById(t).getBoundingClientRect().top - document.querySelector('.navV2Bar').getBoundingClientRect().bottom,
      constNote: [...document.querySelectorAll('#latestBoardGrid .constNote')].filter(e => e.offsetParent).length }), t);
    assert.equal(r.glance, t === 'overview', 'Daily Glance only on 오늘: ' + t);
    assert.equal(r.fresh, t === 'overview', 'freshness only on 오늘: ' + t);
    assert.equal(r.constNote, 0, 'constant note not repeated per tile: ' + t);
    if (!['overview', 'tripod'].includes(t)) assert.ok(r.gap < 1800, t + ' panel gap ' + Math.round(r.gap));
  }
  const tileH = await page.evaluate(() => { document.querySelector('#tabs button[data-tab="indices"]').click(); return new Promise(r => setTimeout(() => r(Math.max(...[...document.querySelectorAll('#latestBoardGrid .latestTile')].map(t => t.getBoundingClientRect().height))), 1500)); });
  assert.ok(tileH < 240, 'tile height ' + tileH);
  assert.deepEqual(errors, []);
  console.log('OBS_V2_SKIN_PASS tabs=' + tabs.length + ' maxTile=' + Math.round(tileH));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
