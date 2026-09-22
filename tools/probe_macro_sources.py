"""Read-only official-source diagnostics; no production data writes."""
import concurrent.futures,json,urllib.request,urllib.parse,io
from pypdf import PdfReader
from bs4 import BeautifulSoup
URLS={
 'customs':'https://www.customs.go.kr/kcs/na/ntt/selectNttInfo.do?bbsId=1362&mi=2891&nttSn=10176743&nttSnUrl=0b6477a0d2c425948fd0866c7b527f24',
 'customs_list':'https://www.customs.go.kr/kcs/na/ntt/selectNttList.do?bbsId=1362&mi=2891&searchValue=수출입',
 'bok_list':'https://www.bok.or.kr/portal/bbs/P0002359/list.do?menuNo=200066&searchCnd=1&searchWrd=경제전망보고서',
 'bok_pdf':'https://www.bok.or.kr/fileSrc/portal/dfe965a8e38a4e4b9fd1a6989a7ee18e/1/3aa17ed0ffd64f55b9c74755d3c622ae.pdf',
 'employment_list':'https://mods.go.kr/board.es?mid=a10301030200&bid=210',
 'fed_list':'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
 'customs_mirror':'https://www.korea.kr/briefing/pressReleaseView.do?newsId=156782594',
}

def run(pair):
 key,url=pair
 url=urllib.parse.quote(url,safe=':/?&=%')
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=15) as r: data=r.read()
  if url.endswith('.pdf'): return key,{'text':'\n'.join(p.extract_text() or '' for p in PdfReader(io.BytesIO(data)).pages[:8])}
  raw=data.decode('utf-8','replace')
  if 'ecos.bok' in url: return key,raw
  soup=BeautifulSoup(raw,'html.parser')
  for t in soup(['script','style','nav','header','footer']): t.decompose()
  content=soup.select_one('#content') or soup
  return key,{'text':content.get_text(' ',strip=True)[-18000:], 'links':[(a.get_text(' ',strip=True),str(a)) for a in soup.select('a[href]') if any(w in a.get_text() for w in ['2026','수출','경제전망','고용','pdf','Projection'])][-65:], 'tables':[[[c.get_text(' ',strip=True) for c in row.select('th,td')] for row in table.select('tr')] for table in soup.select('table')][:3]}
 except Exception as e:return key,{'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 for key,data in pool.map(run,URLS.items()): print('PROBE',key,json.dumps(data,ensure_ascii=False),flush=True)
