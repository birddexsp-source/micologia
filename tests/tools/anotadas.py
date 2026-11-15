"""Mete las fotos con flechas (tests/tools/anotadas/<id>.json) en docs/data/especies.json → campo `anotadas` de cada ficha.
Cada archivo lo preparo mirando la foto con una rejilla; x, y son % del ancho y alto de la foto. Uso: python3 tests/tools/anotadas.py"""
import json, os, glob
R = os.path.join(os.path.dirname(__file__), '..', '..'); P = os.path.join(R, 'docs', 'data', 'especies.json')
D = json.load(open(P)); por = {e['id']: e for e in D['especies']}; n = 0
for e in D['especies']: e['anotadas'] = []
for f in sorted(glob.glob(os.path.join(os.path.dirname(__file__), 'anotadas', '*.json'))):
    sid = os.path.basename(f)[:-5]; assert sid in por, 'ficha desconocida: ' + sid
    A = json.load(open(f))
    por[sid]['anotadas'] = [{k: v for k, v in a.items() if not k.startswith('_')} for a in A]; n += 1
json.dump(D, open(P, 'w'), ensure_ascii=False, indent=1)
print(n, 'fichas con fotos anotadas')
