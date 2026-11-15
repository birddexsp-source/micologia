"""Mete las fotos con flechas (tests/tools/anotadas/<id>.json) en docs/data/especies.json → campo `anotadas` de cada ficha.
Cada archivo lo preparo mirando la foto con una rejilla; x, y son % del ancho y alto de la foto. Uso: python3 tests/tools/anotadas.py"""
import json, os, glob
R = os.path.join(os.path.dirname(__file__), '..', '..'); P = os.path.join(R, 'docs', 'data', 'especies.json')
D = json.load(open(P)); por = {e['id']: e for e in D['especies']}; n = 0
PREV = json.load(open(os.path.join(os.path.dirname(__file__), 'anotadas', '_previas.json')))   # las que ya había (una foto por ficha)
for e in D['especies']: e['anotadas'] = list(PREV.get(e['id'], []))
for f in sorted(glob.glob(os.path.join(os.path.dirname(__file__), 'anotadas', '[!_]*.json'))):
    sid = os.path.basename(f)[:-5]; assert sid in por, 'ficha desconocida: ' + sid
    A = json.load(open(f))
    nuevas = [{k: v for k, v in a.items() if not k.startswith('_')} for a in A]; urls = {a['foto']['url'] for a in nuevas}
    por[sid]['anotadas'] = nuevas + [a for a in por[sid]['anotadas'] if a['foto']['url'] not in urls]; n += 1      # las nuevas primero; las previas detrás si son otra foto
json.dump(D, open(P, 'w'), ensure_ascii=False, indent=1)
print(n, 'fichas con fotos nuevas ·', sum(1 for e in D['especies'] if e['anotadas']), 'fichas con fotos anotadas ·', sum(len(e['anotadas']) for e in D['especies']), 'fotos')
