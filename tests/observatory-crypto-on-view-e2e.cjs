const {chromium} = require('playwright');
const assert = require('node:assert/strict');

const url = process.env.URL;
const binance = 'https://data-api.binance.vision/api/v3/trades?*';
const klines = 'https://data-api.binance.vision/api/v3/klines?*';
const tile = key => `#latestBoardGrid [data-metric="${key}"]`;

async function open(page) {
  await page.goto(url, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => ['COMPLETE', 'PARTIAL', 'FAILED']
    .includes(window.__JJOONI_CRYPTO_ON_VIEW?.status));
  await page.locator(tile('BTCUSD')).waitFor({state: 'attached'});
}

async function testFallback(browser, width) {
  const page = await browser.newPage({viewport: {width, height: 900}, hasTouch: width < 600});
  try {
    // Exercise the runtime in a browser without AbortSignal.timeout().
    await page.addInitScript(() => { delete AbortSignal.timeout; });
    let blocked = true;
    let reads = 0;
    let closes = 0;
    await page.route(klines, route => {
      closes++;
      const start = Number(new URL(route.request().url()).searchParams.get('startTime'));
      return route.fulfill({headers: {'access-control-allow-origin': '*'},
        json: [[start, '12000', '12600', '11000', '12000', '1', start + 86400000 - 1]]});
    });
    await page.route(binance, route => {
      reads++;
      return route.fulfill({
        status: blocked ? 451 : 200,
        headers: {'access-control-allow-origin': '*'},
        json: blocked ? {} : [{price: '12345.67', time: Date.now() - 1000}],
      });
    });
    await open(page);
    const btc = page.locator(tile('BTCUSD'));
    const eth = page.locator(tile('ETHUSD'));
    assert.equal(await page.evaluate(() => typeof AbortSignal.timeout), 'undefined');
    assert.match(await btc.locator('.latestQuoteContext').innerText(), /접속 제한 · 게시값 표시/);
    assert.match(await eth.locator('.latestQuoteContext').innerText(), /접속 제한 · 게시값 표시/);
    const published = await btc.locator('.latestLevelValue').innerText();
    assert.notEqual(published, '—');
    assert.equal(reads, 2);
    await btc.screenshot({path: `crypto-view-fallback-${width}.png`});
    blocked = false;
    await page.locator('#obsForceRefresh').click();
    await btc.locator('[data-live-quote]').waitFor({state: 'attached'});
    await page.waitForFunction(() => window.__JJOONI_CRYPTO_ON_VIEW.status === 'COMPLETE');
    assert.match(await btc.locator('.latestLevelValue').innerText(), /12,345\.67 USDT/);
    assert.match(await btc.locator('[data-live-quote]').innerText(), /Binance BTCUSDT/);
    assert.match(await eth.locator('[data-live-quote]').innerText(), /Binance ETHUSDT/);
    assert.match(await btc.locator('time').innerText(), /KST/);
    assert.match(await btc.innerText(), /2\.88%/);
    assert.match(await page.locator('[data-glance-crypto="BTCUSD"]').innerText(), /12,345\.67/);
    assert.equal(reads, 4);
    assert.equal(closes, 2);
    await btc.screenshot({path: `crypto-view-recovery-${width}.png`});
    blocked = true;
    await open(page);
    assert.match(await btc.locator('.latestLevelValue').innerText(), /12,345\.67 USDT/);
    assert.match(await btc.locator('[data-live-quote]').innerText(), /이전 관측 유지/);
    assert.match(await btc.innerText(), /2\.88%/);
    assert.equal(closes, 2);
    console.log('CRYPTO_BROWSER_FALLBACK_AND_RECOVERY=PASS width=' + width);
  } finally {
    await page.close();
  }
}

async function probeProvider(browser, width) {
  const page = await browser.newPage({viewport: {width, height: 900}, hasTouch: width < 600});
  const responses = {};
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.hostname === 'data-api.binance.vision' && url.pathname === '/api/v3/trades') {
      responses[url.searchParams.get('symbol')] = response.status();
    }
  });
  try {
    await open(page);
    const result = await page.evaluate(() => {
      const crypto = window.__JJOONI_CRYPTO_ON_VIEW;
      return Object.fromEntries(['BTCUSD', 'ETHUSD'].map(key => {
        const card = document.querySelector(`[data-metric="${key}"]`);
        const quote = crypto.get(key);
        return [key, {currency: quote?.quote_currency, observed: quote?.observed_at,
          source: card?.querySelector('[data-live-quote]')?.textContent,
          note: card?.querySelector('.latestQuoteContext')?.textContent}];
      }));
    });
    const pass = Object.values(result).every(row => row.currency === 'USDT' && row.observed &&
      /Binance (BTC|ETH)USDT/.test(row.source || ''));
    console.log('CRYPTO_BROWSER_LIVE=' + (pass ? 'PASS' : 'UNVERIFIED'), JSON.stringify({width, responses, result}));
    if (pass) await page.screenshot({path: `crypto-view-live-${width}.png`});
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH});
  try {
    for (const width of [390, 1363]) {
      await testFallback(browser, width);
      await probeProvider(browser, width);
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
