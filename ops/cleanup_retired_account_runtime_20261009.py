#!/usr/bin/env python3
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]

def rd(p): return (ROOT/p).read_text(encoding='utf-8')
def wr(p,s): (ROOT/p).write_text(s,encoding='utf-8')
def must_replace(p,s,old,new,count=1):
    n=s.count(old)
    if n!=count: raise SystemExit(f'{p}: expected {count} x {old!r}, found {n}')
    return s.replace(old,new)
def sub1(p,s,pat,repl,flags=0):
    out,n=re.subn(pat,repl,s,count=1,flags=flags)
    if n!=1: raise SystemExit(f'{p}: regex matches={n}: {pat}')
    return out

def account_expr(var='t'):
    return f"String({var}.account||{var}.account_type||'').trim().toUpperCase()"
def non_retired(var='t'):
    return f"!['AI','AIBOT','AI_BOT'].includes({account_expr(var)})"

# live-bridge: do not recreate legacy AI trade mirror. Keep removeRetiredAccountUi() as a defensive scrubber.
p='live-bridge.js'; s=rd(p)
s=sub1(p,s,r"\n D\.ai=D\.ai\|\|\{\};D\.ai\.latest=D\.ai\.latest\|\|\{\};const at=.*?\n",'\n',re.S)
# Also filter stale retired-account trades that may exist in static D.human history.
s=s.replace("const old=Array.isArray(D.human.trades)?D.human.trades:[],fresh=Array.isArray(live.recent_trades)?live.recent_trades:[]", "const old=(Array.isArray(D.human.trades)?D.human.trades:[]).filter(t=>!['AI','AIBOT','AI_BOT'].includes(String(t.account||t.account_type||'').trim().toUpperCase())),fresh=(Array.isArray(live.recent_trades)?live.recent_trades:[]).filter(t=>!['AI','AIBOT','AI_BOT'].includes(String(t.account||t.account_type||'').trim().toUpperCase()))")
wr(p,s)

# data-integrity: normalize active Human/current accounts only; no D.ai current-account object.
p='data-integrity-v4.js'; s=rd(p)
s=sub1(p,s,r"\n      const ai=D\.ai\?\.latest\|\|\{\};\n      \(ai\.trades\|\|\[\]\)\.forEach\(.*?\n      \(ai\.holdings_us\|\|\[\]\)\.forEach\(.*?\n",'\n',re.S)
# Exclude stale retired-account rows from human historical arrays in-place before normalization.
s=s.replace("(h.trades||[]).forEach(x=>{normalizeRecord(x);trades++});", "(h.trades||[]).filter(x=>!['AI','AIBOT','AI_BOT'].includes(accountOf(x))).forEach(x=>{normalizeRecord(x);trades++});")
s=s.replace("(h.positions||[]).forEach(x=>{normalizeRecord(x);positions++});", "(h.positions||[]).filter(x=>!['AI','AIBOT','AI_BOT'].includes(accountOf(x))).forEach(x=>{normalizeRecord(x);positions++});")
wr(p,s)

# trade-review: remove retired secondary tab and legacy D.ai ledger; filter historical human rows.
p='trade-review-v2.js'; s=rd(p)
s=s.replace("secondary:['compare','ai','tripod','decisions','quality','watchlist','cost']", "secondary:['compare','tripod','decisions','quality','watchlist','cost']")
s=s.replace("try{if(typeof D!=='undefined'&&D.human&&Array.isArray(D.human.trades))out.push(...D.human.trades)}catch(_){}", "try{if(typeof D!=='undefined'&&D.human&&Array.isArray(D.human.trades))out.push(...D.human.trades.filter(t=>!['AI','AIBOT','AI_BOT'].includes(account(t))))}catch(_){}")
s=sub1(p,s,r"\n  try\{if\(typeof D!=='undefined'&&D\.ai&&D\.ai\.latest&&Array\.isArray\(D\.ai\.latest\.trades\)\)out\.push\(\.\.\.D\.ai\.latest\.trades\.map\(.*?\)\)\}catch\(_\)\{\}", '', re.S)
wr(p,s)

# readable trade view: use human/current trade ledger only.
p='trade-review-readable-v3.js'; s=rd(p)
s=s.replace("try{if(typeof D!=='undefined'&&D.human&&Array.isArray(D.human.trades))out.push(...D.human.trades)}catch(_){}", "try{if(typeof D!=='undefined'&&D.human&&Array.isArray(D.human.trades))out.push(...D.human.trades.filter(t=>!['AI','AIBOT','AI_BOT'].includes(String(t.account||t.account_type||'').trim().toUpperCase())))}catch(_){}")
s=sub1(p,s,r"\n  try\{if\(typeof D!=='undefined'&&D\.ai&&D\.ai\.latest&&Array\.isArray\(D\.ai\.latest\.trades\)\)out\.push\(\.\.\.D\.ai\.latest\.trades\)\}catch\(_\)\{\}", '', re.S)
wr(p,s)

# Decision impact: remove legacy AI ledger import and exclude any stale AI history in D.human.
p='decision-impact-v5.js'; s=rd(p)
s=s.replace("try{if(typeof D!=='undefined'&&Array.isArray(D.human?.trades))out.push(...D.human.trades)}catch(_){}", "try{if(typeof D!=='undefined'&&Array.isArray(D.human?.trades))out.push(...D.human.trades.filter(t=>!['AI','AIBOT','AI_BOT'].includes(acct(t))))}catch(_){}")
s=sub1(p,s,r"\n try\{if\(typeof D!=='undefined'&&Array\.isArray\(D\.ai\?\.latest\?\.trades\)\)out\.push\(\.\.\.D\.ai\.latest\.trades\.map\(.*?\)\)\}catch\(_\)\{\}", '', re.S)
wr(p,s)

# Realized ledger: active trade groups only.
p='realized-ledger-v7.js'; s=rd(p)
old="function recentTrades(){const out=[];try{if(typeof D!=='undefined'&&Array.isArray(D.human?.trades))out.push(...D.human.trades)}catch(_){}try{if(typeof D!=='undefined'&&Array.isArray(D.ai?.latest?.trades))out.push(...D.ai.latest.trades.map(x=>({...x,account:x.account||'AI'})))}catch(_){}return out}"
new="function recentTrades(){const out=[];try{if(typeof D!=='undefined'&&Array.isArray(D.human?.trades))out.push(...D.human.trades.filter(t=>!['AI','AIBOT','AI_BOT'].includes(acct(t))))}catch(_){}return out}"
s=must_replace(p,s,old,new)
wr(p,s)

# Trade money: same active-only ledger.
p='trade-money-v6.js'; s=rd(p)
s=sub1(p,s,r"function trades\(\)\{const a=\[\];try\{if\(Array\.isArray\(D\?\.human\?\.trades\)\)a\.push\(\.\.\.D\.human\.trades\)\}catch\(_\)\{\}try\{if\(Array\.isArray\(D\?\.ai\?\.latest\?\.trades\)\)a\.push\(\.\.\.D\.ai\.latest\.trades\.map\(.*?\)\)\}catch\(_\)\{\}", "function trades(){const a=[];try{if(Array.isArray(D?.human?.trades))a.push(...D.human.trades.filter(t=>!['AI','AIBOT','AI_BOT'].includes(acct(t))))}catch(_){}", re.S)
wr(p,s)

# Trade outcomes: filter retired rows and remove AI from quote fanout.
p='trade-review-outcomes-v26.js'; s=rd(p)
s=s.replace("try{if(d?.human&&Array.isArray(d.human.trades))out.push(...d.human.trades)}catch(_){}", "try{if(d?.human&&Array.isArray(d.human.trades))out.push(...d.human.trades.filter(t=>!['AI','AIBOT','AI_BOT'].includes(acct(t))))}catch(_){}")
s=sub1(p,s,r"\n try\{if\(d\?\.ai\?\.latest&&Array\.isArray\(d\.ai\.latest\.trades\)\)out\.push\(\.\.\.d\.ai\.latest\.trades\.map\(.*?\)\)\}catch\(_\)\{\}", '', re.S)
s=s.replace("['TOSS','ISA','PENSION','IRP','AI','TRIPOD']", "['TOSS','ISA','PENSION','IRP','TRIPOD']")
wr(p,s)

# Tablet desktop runtime: active IDs are already patched by phase 1; remove old AI ledger merge and fix wording.
p='tablet-runtime-v8.js'; s=rd(p)
old="function allTrades(){const a=[];try{if(typeof D!=='undefined'&&Array.isArray(D.human&&D.human.trades))a.push(...D.human.trades)}catch(_){}try{if(typeof D!=='undefined'&&Array.isArray(D.ai&&D.ai.latest&&D.ai.latest.trades))a.push(...D.ai.latest.trades.map(x=>({...x,account:x.account||'AI'})))}catch(_){}const seen=new Set(),out=[];"
new="function allTrades(){const a=[];try{if(typeof D!=='undefined'&&Array.isArray(D.human&&D.human.trades))a.push(...D.human.trades.filter(t=>!['AI','AIBOT','AI_BOT'].includes(String(t.account||t.account_type||'').trim().toUpperCase())))}catch(_){}const seen=new Set(),out=[];"
s=must_replace(p,s,old,new)
s=s.replace('6계좌 합산 완료','5계좌 합산 완료').replace('6계좌','5계좌')
wr(p,s)

# Recent trade drilldown: remove all current-account AI branches; active account modals use Human ledger.
p='recent-trade-metric-drilldown-v9.js'; s=rd(p)
s=s.replace("const normAcct=v=>{const s=String(v||'').trim().toUpperCase();if(['AIBOT','AI_BOT'].includes(s))return'AI';if(s==='PENSION'||s==='연금저축')return'PENSION';return s};", "const normAcct=v=>{const s=String(v||'').trim().toUpperCase();if(s==='PENSION'||s==='연금저축')return'PENSION';return s};")
s=s.replace(" if(h.includes('AI BOT'))return'AI';",'')
s=sub1(p,s,r"\nfunction aiTrades\(\)\{.*?\n\}\nfunction aiPositions\(\)\{.*?\n\}", '', re.S)
s=s.replace(" if(acct==='AI')return null;",'')
s=s.replace(" acct=normAcct(acct);const trades=acct==='AI'?aiTrades():humanTrades(acct),positions=acct==='AI'?aiPositions():humanPositions(acct),excluded=[];", " acct=normAcct(acct);const trades=humanTrades(acct),positions=humanPositions(acct),excluded=[];")
wr(p,s)

# Metric router: eliminate remaining retired-account routes from route() and mainRows().
p='metric-drilldown-router-v12.js'; s=rd(p)
s=sub1(p,s,r"if\(t\.startsWith\('AI Bot'\).*?if\(t\.startsWith\('AI 체결'\)\)return\['ai-trades'\];", '', re.S)
s=s.replace('전체 6계좌 NAV','전체 5계좌 NAV').replace('Canonical 6계좌 NAV','Canonical 5계좌 NAV').replace('6계좌 누적손익','5계좌 누적손익').replace('6계좌 누적수익률','5계좌 누적수익률')
wr(p,s)

# Account source truth and runtime integrity wording/contract names.
p='account-source-truth-v22.js'; s=rd(p).replace('6계좌','5계좌'); wr(p,s)
p='runtime-integrity-v15.js'; s=rd(p).replace('6계좌 통합 DD','5계좌 통합 DD').replace('FLOW_ADJUSTED_6_ACCOUNT_HISTORY','FLOW_ADJUSTED_5_ACCOUNT_HISTORY'); wr(p,s)

# Generic safety filter for D.human trade utilities that still have a single D.ai append.
for p in ['recent-trade-metric-drilldown-v9.js','realized-ledger-v7.js','trade-money-v6.js','trade-review-v2.js','trade-review-readable-v3.js','decision-impact-v5.js','trade-review-outcomes-v26.js','tablet-runtime-v8.js']:
    s=rd(p)
    if 'D.ai' in s or 'd.ai' in s:
        raise SystemExit(f'{p}: legacy AI object still referenced after cleanup')

print('RETIRED_ACCOUNT_RUNTIME_CLEANUP=PASS')
