const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const src=fs.readFileSync(path.join(__dirname,'../position-completeness-v25.js'),'utf8');
const loader=fs.readFileSync(path.join(__dirname,'../trade-review-loader.js'),'utf8');

test('mobile drilldown stays viewport-bound and non-duplicated',()=>{
  assert.match(src,/version:'25\.1\.2'/);
  assert.match(src,/#accountDrillModal,#metricInfoModal\{position:fixed!important/);
  assert.match(src,/#accountDrillModal #ctAccountPositionCompletenessV25\{display:none!important\}/);
  assert.match(src,/if\(mobile\)\{box\?\.remove\(\);return\}/);
  assert.match(src,/grid-template-areas:'name value' 'cum cum' 'today dayret'!important/);
  assert.match(src,/#accountDrillModal \.v2Table,#metricInfoModal \.v2Table\{min-width:0!important/);
});

test('verified boot pins the same mobile drilldown release',()=>{
  assert.match(loader,/version:'14\.19'/);
  assert.match(loader,/position-completeness-v25\.js\?v=25\.1\.2/);
});
