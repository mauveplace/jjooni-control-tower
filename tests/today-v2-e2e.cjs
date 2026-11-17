// Default-V2 contract: unflagged URL renders '오늘'; V1 remains accessible and isolated.
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
    await page.waitForFunction(() => window.__JJOONI_TODAY_V2?.rendered === true, null, { timeout: 20000 });
    assert.ok(await page.locator('.todayV2').isVisible(), 'unflagged URL renders new Today');
    const vm = await page.evaluate(() => window.__JJOONI_TODAY_V2.vm);
    const sectorSource = await page.evaluate(() => fetch('./data/sector-rotation-brief.json?cb=' + Date.now()).then(r => r.json()));
    const expectedSectorRows = sectorSource.groups.reduce((n, g) => n + g.rows.length, 0);
    if (expectedSectorRows === 34 && sectorSource.completed_cutoffs.US === vm.session) {
      assert.equal(vm.sectors.status, 'OK', 'completed same-session 34-sector summary');
      assert.equal(await page.locator('.tV2SectorRow').count(), 4, 'show two US and two KR movers');
      assert.ok(await page.locator('.todayV2 [data-go="sectors"]').isVisible());
    }
    assert.ok(await page.locator('.todayV2 [data-refresh="today"]').isVisible());
    const glance = await page.evaluate(() => fetch('./data/daily-glance.json?cb=' + Date.now()).then(r => r.json()));
    assert.equal(vm.tripod.pod, glance.tripod.pod, 'TRI-POD state is the published one');
    const rows = glance.groups.reduce((n, g) => n + g.items.length, 0);
    assert.equal(await page.locator('.todayV2 tbody tr[data-key]').count(), rows, 'every published glance row shown');
    const periodButtons = page.locator('.todayV2 [data-period]');
    assert.equal(await periodButtons.count(), 3, 'three comparable periods on desktop and phone');
    const ndxChange = page.locator('.todayV2 tr[data-key="NASDAQ100"] .tV2Change');
    assert.equal(await page.locator('.todayV2 [data-period="d1"]').getAttribute('aria-pressed'), 'true', '1D default');
    assert.equal(await ndxChange.textContent(), vm.groups[0].rows[0].d1);
    await page.locator('.todayV2 [data-period="w1"]').click();
    assert.equal(await page.locator('.todayV2 .tV2ChangeHead').textContent(), '1W');
    assert.equal(await ndxChange.textContent(), vm.groups[0].rows[0].w1);
    await page.locator('.todayV2 [data-period="m1"]').click();
    assert.equal(await page.locator('.todayV2 .tV2ChangeHead').textContent(), '1M');
    assert.equal(await ndxChange.textContent(), vm.groups[0].rows[0].m1);
    assert.equal(await page.locator('.todayV2 [data-period="m1"]').getAttribute('aria-pressed'), 'true');
    await page.locator('.todayV2 [data-period="d1"]').click();
    assert.equal(await ndxChange.textContent(), vm.groups[0].rows[0].d1);
    assert.ok(await page.locator('.todayV2 .tV2NoTrade').isVisible());
    assert.equal(await page.locator('.todayV2 .tV2Cond').count(), vm.tripod.conds.length);
    if (glance.brief_check?.official_status !== 'VERIFIED') {
      const sourceStatus = vm.alerts.find(a => a.title === 'NDX 공식 종가 미검증');
      assert.ok(sourceStatus, 'unverified official NDX must retain explicit warning');
      const banner = sourceStatus.level === 'HIGH' ? '.tV2Alert' : '.tV2Notice';
      assert.ok(await page.locator('.todayV2 ' + banner).isVisible(), 'source severity visible');
      const ndxRow = vm.groups.flatMap(g => g.rows).find(r => r.key === 'NASDAQ100');
      assert.ok(ndxRow && ['ref','hold','delay'].includes(ndxRow.state), 'never elevate missing official proof');
      assert.ok((await page.locator('.todayV2 tr[data-key="NASDAQ100"] .tV2Tag').getAttribute('title')).startsWith(ndxRow.tag+' · '));
      assert.ok(await page.locator('.todayV2 tr[data-key="NASDAQ100"] .tV2Tag').isVisible(), 'state tag visible at ' + width);
    }
    const box = await page.locator('.todayV2').boundingBox();
    assert.ok(box && box.y < 700, 'today screen near the top: y=' + (box && box.y));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(overflow <= 1, 'no horizontal overflow ' + overflow);
    const before = vm.judgment.title;
    await page.route('**/data/morning-brief/latest.json?*', async route => {
      const res = await route.fetch();
      const source = await res.json();
      source.title = 'E2E_REFRESHED_BRIEF_TITLE';
      await route.fulfill({ json: source });
    });
    await page.locator('.todayV2 [data-refresh="today"]').click();
    await page.waitForFunction(() => window.__JJOONI_TODAY_V2?.vm?.judgment.title === 'E2E_REFRESHED_BRIEF_TITLE');
    assert.notEqual(before, 'E2E_REFRESHED_BRIEF_TITLE');
    assert.ok(await page.locator('.todayV2').getByText('E2E_REFRESHED_BRIEF_TITLE').isVisible());
    await page.locator('.todayV2 [data-go="sectors"]').click();
    await page.waitForFunction(() => document.querySelector('#sectors')?.classList.contains('on'));
    await page.locator('.navV2Main button[data-group="today"]').click();
    await page.waitForFunction(() => document.querySelector('.todayV2') && !document.querySelector('.todayV2').hidden);
    await page.locator('.todayV2 [data-go="morning-brief"]').first().click();
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
