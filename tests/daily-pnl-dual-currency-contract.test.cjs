const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const src=fs.readFileSync('daily-pnl-attribution-v27.js','utf8');

test('US 종목은 USD를 먼저 표시하고 원화 환산액을 병기한다',()=>{
  assert.match(src,/const usd=v=>/);
  assert.match(src,/if\(x\.nativeUsd!=null\)return `\$\{usd\(x\.nativeUsd\)\} <span class="ctDp27KrwEq">\(원화 \$\{won\(x\.day\)\}\)<\/span>`/);
  assert.match(src,/function nativeDayUsd\(/);
});

test('계좌 합계와 Bridge는 KRW 대사 기준을 유지한다',()=>{
  assert.match(src,/계좌 오늘손익[\s\S]*won\(acct\)/);
  assert.match(src,/보유종목 확인합계[\s\S]*won\(knownSum\)/);
  assert.match(src,/Bridge[\s\S]*won\(bridge\)/);
  assert.match(src,/계좌 합계·대사·Bridge는 기존처럼 KRW 기준을 유지합니다/);
});
