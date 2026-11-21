const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { IA, groupOf, enabled } = require('../market-observatory/observatory-nav-v2.js');

const html = fs.readFileSync(path.join(__dirname, '../market-observatory/index.html'), 'utf8');
const staticTabs = [...html.matchAll(/data-tab="([^"]+)"/g)].map(m => m[1]);
// Inserted at runtime by analysis-lab-v1.js and index-explorer-v1.js.
const LEGACY = [...new Set([...staticTabs, 'analysis-lab', 'indices'])];

test('14 legacy tabs, every one mapped to exactly one v2 tab (0 deletions)', () => {
  assert.equal(LEGACY.length, 14, LEGACY.join(','));
  for (const tab of LEGACY) {
    const owners = IA.filter(g => g.tabs.includes(tab));
    assert.equal(owners.length, 1, tab);
  }
});

test('v2 mapping has no unknown tabs and exactly five groups', () => {
  assert.deepEqual(IA.map(g => g.label), ['오늘', '시장', '전략', '일정', '시황']);
  for (const g of IA) for (const t of g.tabs) assert.ok(LEGACY.includes(t), t);
});

test('both TRI-POD tracks stay separate tabs under 전략', () => {
  assert.equal(groupOf('tripod').id, 'strategy');
  assert.equal(groupOf('jjooni-tripod').id, 'strategy');
});

test('V3 default navigation; explicit V1/V2 override old localStorage', () => {
  assert.equal(enabled('', null), true);
  assert.equal(enabled('', 'v2'), true);
  assert.equal(enabled('', 'v1'), true);
  assert.equal(enabled('?ui=v1', null), false);
  assert.equal(enabled('?ui=v1', 'v2'), false);
  assert.equal(enabled('?ui=v2', 'v1'), true);
  assert.equal(enabled('?ui=v2', null), true);
  assert.equal(enabled('?ui=v3', 'v1'), true); // opt-in preview overrides legacy preference
  assert.equal(enabled('?ui=v3', null), true);
});

test('module is loaded after the legacy runtime', () => {
  const nav = html.indexOf('observatory-nav-v2.js');
  assert.ok(nav > html.indexOf('latest-board-v1.js') && nav > html.indexOf('analysis-lab-v1.js'));
});

test('Song word-study stays under 시황 group without sixth primary nav', () => {
  assert.equal(IA.length,5);
  assert.equal(groupOf('song-terms').id,'brief');
  assert.ok(LEGACY.includes('song-terms'));
  assert.match(html, /id="song-terms"/);
  assert.match(html, /song-word-study-v1\.js/);
});
