(()=>{
'use strict';
const ITEMS=[
  {k:'KOSPI',label:'KOSPI',kind:'pct',digits:2,group:'한국'},
  {k:'KOSDAQ',label:'KOSDAQ',kind:'pct',digits:2,group:'한국'},
  {k:'RUSSELL2000',label:'Russell 2000',kind:'pct',digits:0,group:'미국'},
  {k:'DOW',label:'Dow',kind:'pct',digits:0,group:'미국'},
  {k:'SP500',label:'S&P 500',kind:'pct',digits:0,group:'미국'},
  {k:'NASDAQCOMPOSITE',label:'NASDAQ 종합',kind:'pct',digits:0,group:'미국'},
  {k:'NASDAQ100',label:'NASDAQ 100',kind:'pct',digits:0,group:'미국'},
  {k:'VIX',label:'VIX',kind:'pct',digits:2,group:'위험'},
  {k:'USDKRW',label:'USD/KRW',kind:'pct',digits:2,group:'환율'},
  {k:'DXY',label:'DXY',kind:'pct',digits:2,group:'환율'},
  {k:'US2Y',label:'미국 2Y',kind:'bp',digits:3,suffix:'%',group:'금리'},
  {k:'US10Y_OFFICIAL',fallback:'US10Y',label:'미국 10Y',kind:'bp',digits:3,suffix:'%',group:'금리'},
  {k:'US30Y_OFFICIAL',fallback:'US30Y',label:'미국 30Y',kind:'bp',digits:3,suffix:'%',group:'금리'},
  {k:'KR10Y',label:'한국 10Y',kind:'bp',digits:3,suffix:'%',group:'금리'},
  {k:'JP10Y',label:'일본 10Y',kind:'bp',digits:3,suffix:'%',group:'금리'},
  {k:'WTI',label:'WTI',kind:'pct',digits:2,prefix:'$',group:'유가'},
  {k:'BRENT',label:'Brent',kind:'pct',digits:2,prefix:'$',group:'유가'},
  {k:'GOLD',label:'Gold',kind:'pct',digits:1,prefix:'$',group:'원자재'},
  {k:'SILVER',label:'Silver',kind:'pct',digits:2,prefix:'$',group:'원자재'},
  {k:'COPPER',label:'Copper',kind:'pct',digits:3,prefix:'$',group:'원자재'}
];
const fmt=(v,d)=>v==null||!Number.isFinite(Number(v))?'—':Number(v).toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d});
function seriesOf(item){if(typeof DATA==='undefined'||!DATA?.series)return[];const a=DATA.series[item.k]||[];if(a.length)return a;return item.fallback?(DATA.series[item.fallback]||[]):[]}
function stat(item){const s=seriesOf(item),last=s[s.length-1],prev=s[s.length-2];if(!last)return null;let ch=null;if(prev&&Number.isFinite(Number(prev.value))&&Number.isFinite(Number(last.value))){ch=item.kind==='bp'?(Number(last.value)-Number(prev.value))*100:(Number(last.value)/Number(prev.value)-1)*100}return{value:Number(last.value),date:last.date,change:ch}}
function arrow(v){return v==null?'':v>0?'▲':v<0?'▼':'■'}
function cls(v){return v==null?'flat':v>0?'up':v<0?'down':'flat'}
function changeText(item,v){if(v==null||!Number.isFinite(v))return '전일비 —';return item.kind==='bp'?`${arrow(v)} ${Math.abs(v).toFixed(1)}bp`:`${arrow(v)} ${Math.abs(v).toFixed(2)}%`}
function ensure(){let host=document.getElementById('latestMarketBoard');if(host)return host;const nav=document.getElementById('tabs');if(!nav)return null;host=document.createElement('section');host.id='latestMarketBoard';host.className='latestBoardWrap';host.innerHTML='<div class="latestBoardHead"><div><b>최신 시장 수치</b><span>각 지표의 최신 수집값 · 기준일 표시</span></div><span id="latestBoardGenerated"></span></div><div id="latestBoardGrid" class="latestBoardGrid"></div>';nav.insertAdjacentElement('afterend',host);return host}
function renderBoard(){const host=ensure();if(!host||typeof DATA==='undefined'||!DATA)return false;const grid=host.querySelector('#latestBoardGrid');grid.innerHTML=ITEMS.map(item=>{const s=stat(item);const val=s?`${item.prefix||''}${fmt(s.value,item.digits)}${item.suffix||''}`:'—';const ch=s?changeText(item,s.change):'전일비 —';return `<div class="latestTile"><div class="latestTileTop"><span>${item.group}</span><b>${item.label}</b></div><strong>${val}</strong><div class="latestTileFoot"><span class="${cls(s?.change)}">${ch}</span><time>${s?.date||'—'}</time></div></div>`}).join('');const g=host.querySelector('#latestBoardGenerated');if(g){const x=String(DATA.generated_kst||'').replace('T',' ').slice(0,16);g.textContent=x?`수집 ${x} KST`:''}return true}
function hook(){const base=window.render;if(typeof base!=='function'||base.__latestBoardHooked)return false;const w=function(){const r=base.apply(this,arguments);setTimeout(renderBoard,0);return r};w.__latestBoardHooked=true;window.render=w;return true}
const st=document.createElement('style');st.textContent=`
.latestBoardWrap{max-width:1180px;margin:12px auto 0;padding:0 14px}.latestBoardHead{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-bottom:7px}.latestBoardHead>div{display:flex;align-items:baseline;gap:8px;min-width:0}.latestBoardHead b{font-size:13px}.latestBoardHead span{font-size:9px;color:#718096}.latestBoardGrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}.latestTile{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:9px 10px;min-width:0;box-shadow:0 4px 14px #10233d08}.latestTileTop{display:flex;align-items:center;gap:5px;min-width:0}.latestTileTop span{flex:0 0 auto;font-size:8px;font-weight:900;color:#667085;background:#f2f4f7;border-radius:999px;padding:2px 5px}.latestTileTop b{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.latestTile strong{display:block;margin-top:5px;font-size:18px;line-height:1.05;letter-spacing:-.02em;overflow-wrap:anywhere}.latestTileFoot{display:flex;justify-content:space-between;gap:5px;margin-top:5px;font-size:8px;color:#7d8b9d}.latestTileFoot span{font-weight:850}.latestTileFoot .up{color:#d92d20}.latestTileFoot .down{color:#175cd3}.latestTileFoot .flat{color:#667085}.latestTileFoot time{white-space:nowrap}
@media(max-width:760px){.latestBoardWrap{padding:0 10px;margin-top:9px}.latestBoardHead{align-items:flex-start}.latestBoardHead>div{display:block}.latestBoardHead>div span{display:block;margin-top:2px}.latestBoardGrid{grid-template-columns:none;grid-template-rows:repeat(2,auto);grid-auto-flow:column;grid-auto-columns:minmax(138px,42vw);gap:6px;overflow-x:auto;padding-bottom:6px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;scrollbar-width:none}.latestBoardGrid::-webkit-scrollbar{display:none}.latestTile{padding:8px 9px;scroll-snap-align:start}.latestTile strong{font-size:17px}.latestTileFoot{font-size:8px}}
`;document.head.appendChild(st);
let tries=0;const id=setInterval(()=>{tries++;hook();if(renderBoard()||tries>120)clearInterval(id)},100);
window.__JJOONI_LATEST_BOARD={version:'1.1',contract:'LATEST_NUMERIC_TOP_BOARD_WITH_SOURCE_DATE'};
})();
