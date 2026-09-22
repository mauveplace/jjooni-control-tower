"""Read-only official-source diagnostics; no production data writes."""
import concurrent.futures,json,urllib.request
from bs4 import BeautifulSoup
URLS={
 'gdp_items':'https://ecos.bok.or.kr/api/StatisticItemList/sample/json/kr/1/10/200Y102',
 'gdp':'https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/200Y102/Q/2025Q1/2026Q2/10111',
 'core':'https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/901Y010/M/202601/202608/DB',
 'trade':'https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/901Y118/M/202601/202608/T002',
 'production':'https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/901Y033/M/202601/202608/A00/2',
 'employment':'https://mods.go.kr/board.es?act=view&bid=210&list_no=446913&mid=a10301030200',
 'customs':'https://www.customs.go.kr/kcs/na/ntt/selectNttInfo.do?bbsId=1362&mi=2891&nttSn=10176743',
 'customs_list':'https://www.customs.go.kr/kcs/na/ntt/selectNttList.do?bbsId=1362&mi=2891',
 'bok_outlook':'https://www.bok.or.kr/portal/bbs/P0002359/view.do?menuNo=200066&nttId=11064210',
 'bok_list':'https://www.bok.or.kr/portal/bbs/P0002359/list.do?menuNo=200066',
 'fed':'https://www.federalreserve.gov/monetarypolicy/fomcprojtabl20260916.htm',
}
def run(pair):
 key,url=pair
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=15) as r: raw=r.read().decode('utf-8','replace')
  if 'ecos.bok' in url: return key,raw
  soup=BeautifulSoup(raw,'html.parser')
  for t in soup(['script','style','nav','header','footer']): t.decompose()
  content=soup.select_one('#content') or soup
  return key,{'text':content.get_text(' ',strip=True)[-18000:], 'links':[(a.get_text(' ',strip=True),a.get('href')) for a in soup.select('a[href]') if any(w in a.get_text() for w in ['2026','수출','경제전망','고용','pdf'])][-65:], 'tables':[[[c.get_text(' ',strip=True) for c in row.select('th,td')] for row in table.select('tr')] for table in soup.select('table')][:3]}
 except Exception as e:return key,{'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 for key,data in pool.map(run,URLS.items()): print('PROBE',key,json.dumps(data,ensure_ascii=False),flush=True)
