import json,urllib.request,urllib.parse,time,sys
T=json.load(open('tx.json'))
EXTRA={'clitocybe-rivulosa':['Clitocybe rivulosa','Clitocybe dealbata'],'russula-emetica':['Russula emetica'],'inocybe-erubescens':['Inosperma erubescens'],
'clavulina-cristata':['Clavulina coralloides'],'amanita-gemmata':['Amanita junquillea'],'cortinarius-rubellus':['Cortinarius rubellus'],'entoloma-clypeatum':['Entoloma clypeatum'],
'tricholoma-pardinum':['Tricholoma pardinum'],'morchella':['Morchella']}
def get(u):
    for k in range(5):
        try: return json.loads(urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'MicologiaApp/1.0 (personal)'}),timeout=60).read())
        except Exception as ex: time.sleep(3+k*3)
    raise SystemExit('fallo '+u)
def tid(name):
    d=get('https://api.inaturalist.org/v1/taxa?'+urllib.parse.urlencode({'q':name,'is_active':'true'}))
    for t in d['results']:
        if t['name'].lower()==name.lower(): return str(t['id'])
    return None
for k,v in T.items():
    if k in EXTRA or not v['tx']:
        names=EXTRA.get(k,[v['nc']]); ids=[tid(n) for n in names]; time.sleep(1)
        v['tx']=','.join(i for i in ids if i); print(k,names,v['tx'],flush=True)
S={'biz':'place_id=109430&verifiable=true','cant':'nelat=43.7&nelng=-1.0&swlat=42.6&swlng=-5.5&verifiable=true','esp':'place_id=6774&verifiable=true','eu':'place_id=97391&quality_grade=research'}
for k,v in T.items():
    if not v['tx']: print('SIN TAXON',k); continue
    for s,q in S.items():
        v[s]=get('https://api.inaturalist.org/v1/observations?per_page=0&taxon_id='+v['tx']+'&'+q)['total_results']; time.sleep(0.7)
    print(k,v['biz'],v['cant'],v['esp'],v['eu'],flush=True)
json.dump(T,open('cuentas.json','w'),ensure_ascii=False,indent=0)
