from pathlib import Path

p = Path('tablet-stability-v37.js')
t = p.read_text()

if "version:'37.3'" in t:
    t = t.replace("version:'37.3'", "version:'37.4'", 1)
elif "version:'37.4'" not in t:
    raise SystemExit('VERSION_ANCHOR_MISSING')

if 'function enforceContentFontFloor()' not in t:
    anchor = 'function forceTab(name){\n'
    block = '''const CONTENT_FONT_FLOOR_PX=16;
let fontFloorTimer=0;
function enforceContentFontFloor(){
 if(!isTablet())return 0;
 const root=q('.app')||document.body;if(!root)return 0;
 let changed=0;
 const nodes=[root,...qa('*',root)];
 for(const el of nodes){
  if(!el||!el.style)continue;
  const tag=String(el.tagName||'').toUpperCase();
  if(['SCRIPT','STYLE','NOSCRIPT','LINK','META'].includes(tag))continue;
  const txt=String(el.textContent||'').trim();if(!txt)continue;
  let cs;try{cs=getComputedStyle(el)}catch(_){continue}
  if(!cs||cs.display==='none'||cs.visibility==='hidden')continue;
  const fs=parseFloat(cs.fontSize||'0');
  if(Number.isFinite(fs)&&fs>0&&fs<CONTENT_FONT_FLOOR_PX){
   el.style.setProperty('font-size',CONTENT_FONT_FLOOR_PX+'px','important');
   const lh=parseFloat(cs.lineHeight||'0');
   if(Number.isFinite(lh)&&lh>0&&lh<CONTENT_FONT_FLOOR_PX*1.3)el.style.setProperty('line-height','1.4','important');
   changed++;
  }
 }
 S.font_floor_px=CONTENT_FONT_FLOOR_PX;S.font_floor_adjusted=changed;S.font_floor_at=new Date().toISOString();
 return changed;
}
function scheduleContentFontFloor(delay=30){clearTimeout(fontFloorTimer);fontFloorTimer=setTimeout(enforceContentFontFloor,delay)}
function forceTab(name){
'''
    if t.count(anchor) != 1:
        raise SystemExit('FONT_FLOOR_INSERT_ANCHOR_MISMATCH')
    t = t.replace(anchor, block, 1)

old = " ensureStyle();\n const active=q('.tab.on[data-tab]');"
new = " ensureStyle();\n enforceContentFontFloor();scheduleContentFontFloor(120);\n const active=q('.tab.on[data-tab]');"
if old in t:
    t = t.replace(old, new, 1)
elif 'enforceContentFontFloor();scheduleContentFontFloor(120);' not in t:
    raise SystemExit('APPLY_FONT_FLOOR_ANCHOR_MISSING')

if 'ctTabletFontFloorObserverV41' not in t:
    anchor = "document.addEventListener('jjooni:live-applied',()=>setTimeout(apply,0));\n"
    block = """document.addEventListener('jjooni:live-applied',()=>{setTimeout(apply,0);scheduleContentFontFloor(180)});\ntry{\n const mo=new MutationObserver(ms=>{if(!isTablet())return;if(ms.some(m=>m.addedNodes&&m.addedNodes.length))scheduleContentFontFloor(80)});\n mo.observe(document.documentElement,{subtree:true,childList:true});\n S.ctTabletFontFloorObserverV41=true;\n}catch(_){}\n"""
    if t.count(anchor) != 1:
        raise SystemExit('OBSERVER_ANCHOR_MISMATCH')
    t = t.replace(anchor, block, 1)

p.write_text(t)
print('TABLET_FONT_FLOOR_V41=PASS')
