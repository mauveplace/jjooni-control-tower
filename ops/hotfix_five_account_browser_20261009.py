#!/usr/bin/env python3
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def read(path): return (ROOT/path).read_text(encoding='utf-8')
def write(path,s): (ROOT/path).write_text(s,encoding='utf-8')
def exact(path,old,new,expected=1):
    s=read(path); n=s.count(old)
    if n!=expected: raise SystemExit(f'{path}: expected {expected} x {old!r}, found {n}')
    write(path,s.replace(old,new))
def block(s,start,end,new=''):
    a=s.find(start)
    if a<0: raise SystemExit(f'missing block start {start!r}')
    b=s.find(end,a)
    if b<0: raise SystemExit(f'missing block end {end!r}')
    return s[:a]+new+s[b:]
def sub1(path,s,pattern,repl,flags=0):
    out,n=re.subn(pattern,repl,s,count=1,flags=flags)
    if n!=1: raise SystemExit(f'{path}: regex expected 1 match, found {n}: {pattern}')
    return out

def common_five_account(path):
    s=read(path)
    s=s.replace("['TOSS','ISA','PENSION','IRP','AI','TRIPOD']","['TOSS','ISA','PENSION','IRP','TRIPOD']")
    s=s.replace("{TOSS:'Toss',ISA:'ISA',PENSION:'연금저축',IRP:'IRP',AI:'AI BOT',TRIPOD:'TRI-POD'}","{TOSS:'Toss',ISA:'ISA',PENSION:'연금저축',IRP:'IRP',TRIPOD:'TRI-POD'}")
    s=s.replace("ai:'AI BOT',",'').replace(",ai:'AI BOT'",'')
    s=s.replace("if(t.includes('AI BOT'))return'AI';",'')
    s=s.replace("if(h.includes('AI BOT'))return'AI';",'')
    s=s.replace("if(a==='AI')return 'AI BOT';",'')
    s=s.replace('6계좌','5계좌')
    write(path,s)

# 1) Shared canonical contract: exactly five active accounts.
exact('canonical-metrics.js',"const IDS=['TOSS','ISA','PENSION','IRP','AI','TRIPOD'];","const IDS=['TOSS','ISA','PENSION','IRP','TRIPOD'];")
exact('index.html','canonical-metrics.js?v=33.3','canonical-metrics.js?v=33.4')

# 2) Mobile authoritative total NAV must use the same five-account contract.
s=read('mobile-stability-v4.js')
for old,new in [
    ("version:'4.3'","version:'4.4'"),
    ("const SIX_NAV_SOURCES_V43=new Set(['ACCOUNT_SUM_6','FAST_EFFECTIVE_SUM_6_ACCOUNT_NAV']);","const FIVE_NAV_SOURCES_V44=new Set(['ACCOUNT_SUM_5','FAST_EFFECTIVE_SUM_5_ACCOUNT_NAV']);"),
    ('function trustedSixNavV43(L){','function trustedFiveNavV44(L){'),
    ('!SIX_NAV_SOURCES_V43.has(source)','!FIVE_NAV_SOURCES_V44.has(source)'),
    ("source==='FAST_EFFECTIVE_SUM_6_ACCOUNT_NAV'","source==='FAST_EFFECTIVE_SUM_5_ACCOUNT_NAV'"),
    ('count!==6','count!==5'),
    ('trustedSixNavV43(L)','trustedFiveNavV44(L)'),
    ("const ids=['TOSS','ISA','PENSION','IRP','AI','TRIPOD'];","const ids=['TOSS','ISA','PENSION','IRP','TRIPOD'];"),
    ("version:'4.2'","version:'4.4'"),
]:
    if old not in s: raise SystemExit(f'mobile-stability-v4.js missing {old!r}')
    s=s.replace(old,new)
write('mobile-stability-v4.js',s)

# 3) Verified UI loader: no retired account label/module dependency.
s=read('trade-review-loader.js')
for old,new in [
    ("version:'14.31'","version:'14.32'"),
    ("portfolio:'보유분석',ai:'AI BOT',compare:'성과분석'","portfolio:'보유분석',compare:'성과분석'"),
    ('mobile-stability-v4.js?v=4.3','mobile-stability-v4.js?v=4.4'),
]:
    if old not in s: raise SystemExit(f'trade-review-loader.js missing {old!r}')
    s=s.replace(old,new)
lines=s.splitlines(True)
if not any('ctAutobotAuditBoardV1Script' in x for x in lines): raise SystemExit('retired audit module row not found')
s=''.join(x for x in lines if 'ctAutobotAuditBoardV1Script' not in x)
write('trade-review-loader.js',s)

# 4) Live bridge: remove retired positions, name fallback and legacy performance mirror.
s=read('live-bridge.js'); lines=s.splitlines(True)
required=["if(id==='AI')ps=",'D.ai=D.ai||{}','CANON.accounts.AI','const ap=[...(((D.ai||{}).latest||{}).holdings_kr','const pools=id===\'AI\'']
for marker in required:
    if not any(marker in x for x in lines): raise SystemExit(f'live-bridge.js missing {marker!r}')
out=[]
for line in lines:
    if "if(id==='AI')ps=" in line or 'D.ai=D.ai||{}' in line or 'CANON.accounts.AI' in line or 'const ap=[...(((D.ai||{}).latest||{}).holdings_kr' in line:
        continue
    if "const pools=id==='AI'" in line:
        out.append('  const pools=[...hp];\n'); continue
    out.append(line)
s=''.join(out).replace('six-account ACCOUNT_SUM_5 total','five-account ACCOUNT_SUM_5 total')
write('live-bridge.js',s)

# 5) Common visible account maps/lists in active runtime.
ACTIVE=[
 'ui-refactor.js','trade-review-v2.js','human-ui-v6.js','tablet-runtime-v8.js','tablet-accounts-v8.js',
 'recent-trade-metric-drilldown-v9.js','fx-attribution-v16.js','metric-drilldown-router-v12.js',
 'daily-performance-alias-v23.js','position-completeness-v25.js'
]
for p in ACTIVE: common_five_account(p)

# Human UI had a dedicated account branch and static selector.
s=read('human-ui-v6.js')
s=sub1('human-ui-v6.js',s,r"\}else if\(id==='AI'\)\{.*?\}else if\(id==='TRIPOD'\)\{","}else if(id==='TRIPOD'){",re.S)
s=s.replace('#ctCanonicalAI,','')
write('human-ui-v6.js',s)

# Metric drilldown: remove retired summary routes while preserving Human + TRI-POD drilldowns.
s=read('metric-drilldown-router-v12.js')
s=s.replace(",ai=snap('AI')",'')
s,n=re.subn(r"if\(kind==='ai-nav'\).*?if\(kind==='contrib'\)","if(kind==='contrib')",s,count=1,flags=re.S)
if n!=1: raise SystemExit(f'metric-drilldown-router-v12.js AI mainRows segment matches={n}')
write('metric-drilldown-router-v12.js',s)

# Account source truth: retain Toss broker/source correction and metric rebind only.
s=read('account-source-truth-v22.js')
start=s.find('function patchCanonical(){'); end=s.find('function fx(',start)
if start<0 or end<0: raise SystemExit('account-source-truth-v22.js patch block markers missing')
new="""function patchCanonical(){
 const L=window.__JJOONI_LIVE_PAYLOAD||{},C=window.__JJOONI_CANONICAL_SSOT||{};
 if(!C.accounts)return false;
 const liveT=(L.accounts||{}).TOSS||{},toss=C.accounts.TOSS||{};
 const state=String(liveT.status||toss.quality||'').toUpperCase();
 const mode=String(liveT.mode||liveT.source||toss.source||'').toUpperCase();
 const direct=state==='BROKER_LIVE_FULL'||mode.includes('TOSS');
 if(direct){toss.quality=String(liveT.status||toss.quality||'UNKNOWN');toss.account_quality=toss.quality;toss.holdings_quality='BROKER_DIRECT_TOSS_API';toss.cash_quality='BROKER_DIRECT_TOSS_API';toss.broker='Toss증권';}
 (C.registry||[]).forEach(r=>{if(String(r.id||'').toUpperCase()==='TOSS')r.broker='Toss증권'});
 C.accounts.TOSS=toss;return direct;
}
function patchUi(){
 const sub=q('.ctTrustDetailSubV6');if(sub)sub.textContent='계좌별 보유자산·예수금·NAV는 각 계좌의 확인된 원천을 사용합니다. 오늘손익 산출 품질은 별도로 구분합니다.';
 qa('.ctTrustRowV6').forEach(row=>{const name=String(q('b',row)?.textContent||'').trim(),src=q('.ctTrustSourceV6',row);if(src&&name==='Toss')src.textContent='Toss API'});
 qa('#ctDesktopAccountsV8 .ctA8Card').forEach(card=>{const name=norm(q('.ctA8Name',card)?.textContent),src=q('.ctA8Source',card);if(!src||name!=='Toss')return;const basis=(src.textContent||'').split('· 기준').slice(1).join('· 기준').trim();src.textContent='Toss API'+(basis?' · 기준 '+basis:'')});
}

"""
s=s[:start]+new+s[end:]
s=s.replace("if(t.includes('AI BOT'))return'AI';",'').replace("['TOSS','ISA','PENSION','IRP','AI','TRIPOD']","['TOSS','ISA','PENSION','IRP','TRIPOD']")
s,n=re.subn(r"if\(t\.startsWith\('AI Bot'\).*?if\(t\.startsWith\('AI 체결'\)\)return\['ai-trades'\];",'',s,count=1,flags=re.S)
if n!=1: raise SystemExit(f'account-source-truth-v22.js AI route segment matches={n}')
a=s.find('function apply(){'); b=s.find('\nlet queued=',a)
if a<0 or b<0: raise SystemExit('account-source-truth-v22.js apply markers missing')
new_apply="""function apply(){
 const direct=patchCanonical();patchUi();const metric=patchMetricRuntime();
 const C=window.__JJOONI_CANONICAL_SSOT||{},toss=(C.accounts||{}).TOSS||{};
 window.__JJOONI_ACCOUNT_SOURCE_V22={state:'ACTIVE',version:'22.2',toss_account_quality:toss.account_quality||toss.quality||null,dynamic_metric_rebind:metric,contract:'Active Control Tower account source truth; Toss broker facts come from Toss API when available.'};
 try{document.dispatchEvent(new CustomEvent('jjooni:source-truth-applied',{detail:{toss_direct:direct}}))}catch(_){}
}
"""
s=s[:a]+new_apply+s[b:]
write('account-source-truth-v22.js',s)

# Account integrity: preserve IRP controls; remove the retired account broker/trade/modal stack.
s=read('account-integrity-v17.js')
s=re.sub(r"const S=\{booted:true,state:'BOOTING',version:'17\.5'.*?\};","const S={booted:true,state:'BOOTING',version:'17.6',irp_funds:0,irp_lifetime_fail_closed:false,updated_at:null};",s,count=1)
s=block(s,'function aiBrokerLabel(){','function normalizeIrp(){','')
s=block(s,'function patchAiModal(){','function apply(){','')
a=s.find('function apply(){'); b=s.find('function wrap(){',a)
if a<0 or b<0: raise SystemExit('account-integrity-v17.js apply markers missing')
s=s[:a]+"function apply(){normalizeIrp();failCloseIrpCards();patchIrpModal();S.state='ACTIVE';S.updated_at=new Date().toISOString()}\n"+s[b:]
write('account-integrity-v17.js',s)

# Source-authority guard: retain valuation/fx fail-closed logic; remove retired KIS-account enforcement.
s=read('source-authority-guard-v24.js')
s=re.sub(r"const S=\{booted:true,state:'BOOTING',version:'24\.2'.*?\};","const S={booted:true,state:'BOOTING',version:'24.3',unsafe_valuations_removed:0,valuations_repaired:0,fx_missing_accounts:[],updated_at:null};",s,count=1)
s=block(s,'function kisEvidence(){','function isUnsafeDerivedKrw','')
lines=s.splitlines(True); out=[]
for line in lines:
    if "for(const x of ['TOSS','ISA','PENSION','IRP','AI','TRIPOD'])" in line:
        out.append(" for(const x of ['TOSS','ISA','PENSION','IRP','TRIPOD']){if(title.includes(x)){id=x;break}}\n")
    else: out.append(line)
s=''.join(out)
a=s.find('function apply(){'); b=s.find('let queued=',a)
if a<0 or b<0: raise SystemExit('source-authority-guard-v24.js apply markers missing')
s=s[:a]+"function apply(){reconcileValuations();patchOpenModal();S.state='ACTIVE';S.updated_at=new Date().toISOString();document.dispatchEvent(new CustomEvent('jjooni:source-authority-v24-applied',{detail:{fx_missing_accounts:S.fx_missing_accounts}}));}\n"+s[b:]
write('source-authority-guard-v24.js',s)

# Tests: certify five-account defaults and no missing audit module dependency.
s=read('tests/browser-authoritative-total-nav-v45.test.cjs')
for old,new in [('six-account','five-account'),('SIX_ACCOUNT_NAV_SOURCES','FIVE_ACCOUNT_NAV_SOURCES'),('ACCOUNT_SUM_6','ACCOUNT_SUM_5'),('FAST_EFFECTIVE_SUM_6_ACCOUNT_NAV','FAST_EFFECTIVE_SUM_5_ACCOUNT_NAV'),('isSixAccountNavSource','isFiveAccountNavSource'),('SIX_NAV_SOURCES_V43','FIVE_NAV_SOURCES_V44'),('trustedSixNavV43','trustedFiveNavV44')]: s=s.replace(old,new)
write('tests/browser-authoritative-total-nav-v45.test.cjs',s)
s=read('tests/runtime-loader-contract.test.cjs').replace("mobile-stability-v4\\.js\\?v=4\\.3","mobile-stability-v4\\.js\\?v=4\\.4").replace("version:'14\\.31'","version:'14\\.32'")
s+="\ntest('retired AUTOBOT module is absent from verified loader',()=>{const loader=read('trade-review-loader.js');assert.doesNotMatch(loader,/AI BOT|autobot-audit-board-v1|ctAutobotAuditBoardV1Script/);});\n"
write('tests/runtime-loader-contract.test.cjs',s)
s=read('tests/canonical-contract.test.cjs')
old="assert.equal(C.total.nav,600);assert.equal(c.D.human.total_asset,400);"
if old not in s: raise SystemExit('canonical-contract old six-account assertion missing')
s=s.replace(old,"assert.equal(C.total.nav,500);assert.equal(c.D.human.total_asset,400);")
s+="\ntest('default canonical account universe excludes retired AI account',()=>{assert.deepEqual(M.IDS,['TOSS','ISA','PENSION','IRP','TRIPOD']);const a=Object.fromEntries(M.IDS.map(id=>[id,acct()]));assert.equal(M.aggregate(a).nav,500);assert.equal(M.aggregate(a).account_count,5);});\n"
write('tests/canonical-contract.test.cjs',s)

print('FIVE_ACCOUNT_PATCH_APPLIED')
