from pathlib import Path

live=Path('live-bridge.js')
s=live.read_text(encoding='utf-8')
old="try{TRADE_QUOTES=JSON.parse(kv.TRADE_QUOTES_JSON||'{}')}catch(_){TRADE_QUOTES={}};const live=await decryptEnvelope"
new="try{TRADE_QUOTES=JSON.parse(kv.TRADE_QUOTES_JSON||'{}')}catch(_){TRADE_QUOTES={}};try{window.__JJOONI_COST_SIDECAR=kv.COST_JSON?JSON.parse(kv.COST_JSON):null}catch(_){window.__JJOONI_COST_SIDECAR=null};const live=await decryptEnvelope"
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise SystemExit('LIVE_REFRESH_ANCHOR_NOT_FOUND')
live.write_text(s,encoding='utf-8')

cost=Path('cost-bridge.js')
c=cost.read_text(encoding='utf-8')
old2="function currentCost(){return (window.__JJOONI_LIVE_PAYLOAD||{}).cost||null}"
new2="function currentCost(){return window.__JJOONI_COST_SIDECAR||(window.__JJOONI_LIVE_PAYLOAD||{}).cost||null}"
if old2 in c:
    c=c.replace(old2,new2,1)
elif new2 not in c:
    raise SystemExit('COST_CURRENT_ANCHOR_NOT_FOUND')
old3='COST 화면은 기존 encrypted SSOT만 읽습니다. 별도 Google/BigQuery polling을 하지 않습니다.'
new3='COST는 기존 Sheet 응답의 COST_JSON sidecar를 우선 사용합니다. 별도 Google/BigQuery browser polling은 없습니다.'
c=c.replace(old3,new3)
cost.write_text(c,encoding='utf-8')

print('COST_SIDECAR_UI_PATCH_OK')
