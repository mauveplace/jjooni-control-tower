#!/usr/bin/env python3
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]

def rd(p): return (ROOT/p).read_text(encoding='utf-8')
def wr(p,s): (ROOT/p).write_text(s,encoding='utf-8')
def sub(p,s,pat,repl='',flags=0):
    out,n=re.subn(pat,repl,s,flags=flags)
    wr(p,out)
    return out,n

def active_acct_expr(v='t'):
    return f"!['AI','AIBOT','AI_BOT'].includes(String({v}.account||{v}.account_type||'').trim().toUpperCase())"

# live bridge: phase-1 already removes current AI account objects. Filter historical retired rows as well.
p='live-bridge.js'; s=rd(p)
s=s.replace("const old=Array.isArray(D.human.trades)?D.human.trades:[],fresh=Array.isArray(live.recent_trades)?live.recent_trades:[]", "const old=(Array.isArray(D.human.trades)?D.human.trades:[]).filter(t=>!['AI','AIBOT','AI_BOT'].includes(String(t.account||t.account_type||'').trim().toUpperCase())),fresh=(Array.isArray(live.recent_trades)?live.recent_trades:[]).filter(t=>!['AI','AIBOT','AI_BOT'].includes(String(t.account||t.account_type||'').trim().toUpperCase()))")
# Any remaining legacy mirror statement is removed if present; defensive DOM scrubber is intentionally retained.
s=re.sub(r"\n\s*D\.ai=D\.ai\|\|\{\};D\.ai\.latest=.*?(?=\n)",'',s)
wr(p,s)

# data integrity: strip legacy D.ai normalization; human rows remain but retired account rows are excluded.
p='data-integrity-v4.js'; s=rd(p)
s=re.sub(r"\n\s*const ai=D\.ai\?\.latest\|\|\{\};\n\s*\(ai\.trades\|\|\[\]\)\.forEach\([^\n]*\);\n\s*\(ai\.holdings_kr\|\|\[\]\)\.forEach\([^\n]*\);\n\s*\(ai\.holdings_us\|\|\[\]\)\.forEach\([^\n]*\);",'',s)
s=s.replace("(h.trades||[]).forEach(x=>{normalizeRecord(x);trades++});", "(h.trades||[]).filter(x=>!['AI','AIBOT','AI_BOT'].includes(accountOf(x))).forEach(x=>{normalizeRecord(x);trades++});")
s=s.replace("(h.positions||[]).forEach(x=>{normalizeRecord(x);positions++});", "(h.positions||[]).filter(x=>!['AI','AIBOT','AI_BOT'].includes(accountOf(x))).forEach(x=>{normalizeRecord(x);positions++});")
wr(p,s)

# Trade review base: remove retired tab and current/legacy AI ledger merge.
p='trade-review-v2.js'; s=rd(p)
s=s.replace("secondary:['compare','ai','tripod','decisions','quality','watchlist','cost']", "secondary:['compare','tripod','decisions','quality','watchlist','cost']")
s=s.replace("try{if(typeof D!=='undefined'&&D.human&&Array.isArray(D.human.trades))out.push(...D.human.trades)}catch(_){}", "try{if(typeof D!=='undefined'&&D.human&&Array.isArray(D.human.trades))out.push(...D.human.trades.filter(t=>!['AI','AIBOT','AI_BOT'].includes(account(t))))}catch(_){}")
s=re.sub(r"\n\s*try\{if\(typeof D!=='undefined'&&D\.ai&&D\.ai\.latest&&Array\.isArray\(D\.ai\.latest\.trades\)\)out\.push\([^\n]*\)\}catch\(_\)\{\}",'',s)
wr(p,s)

# Mobile readable trade view.
p='trade-review-readable-v3.js'; s=rd(p)
s=s.replace("try{if(typeof D!=='undefined'&&D.human&&Array.isArray(D.human.trades))out.push(...D.human.trades)}catch(_){}", "try{if(typeof D!=='undefined'&&D.human&&Array.isArray(D.human.trades))out.push(...D.human.trades.filter(t=>!['AI','AIBOT','AI_BOT'].includes(String(t.account||t.account_type||'').trim().toUpperCase())))}catch(_){}")
s=re.sub(r"\n\s*try\{if\(typeof D!=='undefined'&&D\.ai&&D\.ai\.latest&&Array\.isArray\(D\.ai\.latest\.trades\)\)out\.push\([^\n]*\)\}catch\(_\)\{\}",'',s)
wr(p,s)

# Decision impact.
p='decision-impact-v5.js'; s=rd(p)
s=s.replace("try{if(typeof D!=='undefined'&&Array.isArray(D.human?.trades))out.push(...D.human.trades)}catch(_){}", "try{if(typeof D!=='undefined'&&Array.isArray(D.human?.trades))out.push(...D.human.trades.filter(t=>!['AI','AIBOT','AI_BOT'].includes(acct(t))))}catch(_){}")
s=re.sub(r"\n\s*try\{if\(typeof D!=='undefined'&&Array\.isArray\(D\.ai\?\.latest\?\.trades\)\)out\.push\([^\n]*\)\}catch\(_\)\{\}",'',s)
wr(p,s)

# Realized ledger.
p='realized-ledger-v7.js'; s=rd(p)
s=re.sub(r"function recentTrades\(\)\{const out=\[\];try\{if\(typeof D!=='undefined'&&Array\.isArray\(D\.human\?\.trades\)\)out\.push\(\.\.\.D\.human\.trades\)\}catch\(_\)\{\}try\{if\(typeof D!=='undefined'&&Array\.isArray\(D\.ai\?\.latest\?\.trades\)\)out\.push\(\.\.\.D\.ai\.latest\.trades\.map\([^\n]*?\)\)\}catch\(_\)\{\}return out\}", "function recentTrades(){const out=[];try{if(typeof D!=='undefined'&&Array.isArray(D.human?.trades))out.push(...D.human.trades.filter(t=>!['AI','AIBOT','AI_BOT'].includes(acct(t))))}catch(_){}return out}", s)
wr(p,s)

# Trade money.
p='trade-money-v6.js'; s=rd(p)
s=re.sub(r"function trades\(\)\{const a=\[\];try\{if\(Array\.isArray\(D\?\.human\?\.trades\)\)a\.push\(\.\.\.D\.human\.trades\)\}catch\(_\)\{\}try\{if\(Array\.isArray\(D\?\.ai\?\.latest\?\.trades\)\)a\.push\(\.\.\.D\.ai\.latest\.trades\.map\([^\n]*?\)\)\}catch\(_\)\{\}", "function trades(){const a=[];try{if(Array.isArray(D?.human?.trades))a.push(...D.human.trades.filter(t=>!['AI','AIBOT','AI_BOT'].includes(acct(t))))}catch(_){}", s)
wr(p,s)

# Trade outcome table.
p='trade-review-outcomes-v26.js'; s=rd(p)
s=s.replace("try{if(d?.human&&Array.isArray(d.human.trades))out.push(...d.human.trades)}catch(_){}", "try{if(d?.human&&Array.isArray(d.human.trades))out.push(...d.human.trades.filter(t=>!['AI','AIBOT','AI_BOT'].includes(acct(t))))}catch(_){}")
s=re.sub(r"\n\s*try\{if\(d\?\.ai\?\.latest&&Array\.isArray\(d\.ai\.latest\.trades\)\)out\.push\([^\n]*\)\}catch\(_\)\{\}",'',s)
s=s.replace("['TOSS','ISA','PENSION','IRP','AI','TRIPOD']", "['TOSS','ISA','PENSION','IRP','TRIPOD']")
wr(p,s)

# Tablet runtime: active five IDs are set by phase 1; remove retired ledger import and old wording.
p='tablet-runtime-v8.js'; s=rd(p)
s=re.sub(r"function allTrades\(\)\{const a=\[\];try\{if\(typeof D!=='undefined'&&Array\.isArray\(D\.human&&D\.human\.trades\)\)a\.push\(\.\.\.D\.human\.trades\)\}catch\(_\)\{\}try\{if\(typeof D!=='undefined'&&Array\.isArray\(D\.ai&&D\.ai\.latest&&D\.ai\.latest\.trades\)\)a\.push\(\.\.\.D\.ai\.latest\.trades\.map\([^\n]*?\)\)\}catch\(_\)\{\}", "function allTrades(){const a=[];try{if(typeof D!=='undefined'&&Array.isArray(D.human&&D.human.trades))a.push(...D.human.trades.filter(t=>!['AI','AIBOT','AI_BOT'].includes(String(t.account||t.account_type||'').trim().toUpperCase())))}catch(_){}", s)
s=s.replace('6계좌 합산 완료','5계좌 합산 완료').replace('6계좌','5계좌')
wr(p,s)

# Recent trade drilldown: active account modal only; remove current AI branches/functions.
p='recent-trade-metric-drilldown-v9.js'; s=rd(p)
s=s.replace("const normAcct=v=>{const s=String(v||'').trim().toUpperCase();if(['AIBOT','AI_BOT'].includes(s))return'AI';if(s==='PENSION'||s==='연금저축')return'PENSION';return s};", "const normAcct=v=>{const s=String(v||'').trim().toUpperCase();if(s==='PENSION'||s==='연금저축')return'PENSION';return s};")
s=s.replace(" if(h.includes('AI BOT'))return'AI';",'')
s=re.sub(r"\nfunction aiTrades\(\)\{.*?\n\}\nfunction aiPositions\(\)\{.*?\n\}",'',s,flags=re.S)
s=s.replace(" if(acct==='AI')return null;",'')
s=s.replace(" acct=normAcct(acct);const trades=acct==='AI'?aiTrades():humanTrades(acct),positions=acct==='AI'?aiPositions():humanPositions(acct),excluded=[];", " acct=normAcct(acct);const trades=humanTrades(acct),positions=humanPositions(acct),excluded=[];")
wr(p,s)

# Metric router: phase 1 removed main AI rows; remove any surviving AI route branch and update total labels.
p='metric-drilldown-router-v12.js'; s=rd(p)
s=re.sub(r"if\(t\.startsWith\('AI Bot'\).*?if\(t\.startsWith\('AI 체결'\)\)return\['ai-trades'\];",'',s,flags=re.S)
s=s.replace('전체 6계좌 NAV','전체 5계좌 NAV').replace('Canonical 6계좌 NAV','Canonical 5계좌 NAV').replace('6계좌 누적손익','5계좌 누적손익').replace('6계좌 누적수익률','5계좌 누적수익률')
wr(p,s)

# Remaining wording contracts.
for p in ['account-source-truth-v22.js','runtime-integrity-v15.js']:
    s=rd(p).replace('6계좌','5계좌').replace('FLOW_ADJUSTED_6_ACCOUNT_HISTORY','FLOW_ADJUSTED_5_ACCOUNT_HISTORY')
    wr(p,s)

# Fail if any active module still creates/reads retired account objects. Hidden exclusion filters are allowed.
for p in ['live-bridge.js','data-integrity-v4.js','trade-review-v2.js','trade-review-readable-v3.js','decision-impact-v5.js','realized-ledger-v7.js','trade-money-v6.js','trade-review-outcomes-v26.js','tablet-runtime-v8.js','recent-trade-metric-drilldown-v9.js','metric-drilldown-router-v12.js']:
    s=rd(p)
    if re.search(r'(?:CANON\.)?accounts\.AI|(?:D|d)\.ai',s):
        raise SystemExit(f'{p}: retired account object remains')

print('RETIRED_ACCOUNT_RUNTIME_CLEANUP_V2=PASS')
