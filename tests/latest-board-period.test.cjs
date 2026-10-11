const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function board(series) {
  const src = fs.readFileSync(path.join(__dirname, '../market-observatory/latest-board-v1.js'), 'utf8');
  const context = {
    DATA: {series}, window: {}, document: {createElement: () => ({}), head: {appendChild() {}}},
    setInterval() {}, clearInterval() {}, console,
  };
  vm.createContext(context);
  vm.runInContext(src.replace('let tries=0;', 'window.testPeriod={stat,standardTile,BY_KEY};let tries=0;'), context);
  return context.window.testPeriod;
}

test('Russell daily gain and weekly loss retain separate signs and bases', () => {
  const api = board({RUSSELL2000: [
    {date: '2026-10-02', value: 2832.89990234},
    {date: '2026-10-08', value: 2794.12988281},
    {date: '2026-10-09', value: 2806.97998047},
  ]});
  const item = api.BY_KEY.RUSSELL2000;
  assert.equal(api.stat(item, 'D1').change.toFixed(2), '0.46');
  assert.equal(api.stat(item, 'W1').change.toFixed(2), '-0.91');
  assert.equal(api.stat(item, 'W1').refDate, '2026-10-02');
  const html = api.standardTile(item);
  assert.match(html, /일간 \+0\.46%/);
  assert.match(html, /주간 -0\.91%/);
  assert.match(html, /2026-10-08 → 2026-10-09/);
});

test('holiday comparison uses latest close on or before weekly target', () => {
  const api = board({SP500: [
    {date: '2026-10-01', value: 100},
    {date: '2026-10-06', value: 104},
    {date: '2026-10-08', value: 105},
  ]});
  assert.equal(api.stat(api.BY_KEY.SP500, 'W1').refDate, '2026-10-01');
  assert.equal(api.stat(api.BY_KEY.SP500, 'W1').change.toFixed(2), '5.00');
});

test('missing weekly reference remains unavailable instead of using daily gain', () => {
  const api = board({RUSSELL2000: [
    {date: '2026-10-08', value: 100}, {date: '2026-10-09', value: 101},
  ]});
  assert.equal(api.stat(api.BY_KEY.RUSSELL2000, 'W1').change, null);
  assert.match(api.standardTile(api.BY_KEY.RUSSELL2000), /주간 —/);
});
