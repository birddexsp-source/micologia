"""Genera docs/data/topo.json (topónimos para nombrar spots sin conexión) a partir del callejero ya generado en AveDex
(www/geo/, Nomenclátor Geográfico Básico de España del IGN, CC-BY 4.0).
Uso: python3 tests/tools/toponimos.py /ruta/a/avedex
Zona: celdas de 0,25° de lat 43.00–43.50 y lon −3.50 a −2.00 (costa y montes de Bizkaia, Urdaibai y alrededores)."""
import json, sys, os
AV = sys.argv[1]; G = os.path.join(AV, 'www', 'geo')
man = json.load(open(os.path.join(G, 'manifest.json')))
LAT = [43.00, 43.25]; LON = [-3.50, -3.25, -3.00, -2.75, -2.50, -2.25]
n = []
for la in LAT:
    for lo in LON:
        f = os.path.join(G, 'c', '%.2f_%.2f.json' % (la, lo))
        if os.path.exists(f): n += json.load(open(f))['n']
mun = [m for m in json.load(open(os.path.join(G, 'municipios.json')))['n'] if 42.85 <= m[2] <= 43.65 and -3.75 <= m[3] <= -1.95]
r5 = lambda x: round(x, 5)
out = {'v': 1, 'fuente': man.get('fuente', 'NGBE · IGN · CC-BY 4.0 · ign.es'), 'zona': [43.0, -3.5, 43.5, -2.0], 'tipos': man['tipos'], 'pesos': man['pesos'],
       'n': [[x[0], x[1], r5(x[2]), r5(x[3])] for x in n], 'm': [[x[0], r5(x[2]), r5(x[3])] for x in mun]}
dst = os.path.join(os.path.dirname(__file__), '..', '..', 'docs', 'data', 'topo.json')
json.dump(out, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out['n']), 'topónimos ·', len(out['m']), 'municipios ·', os.path.getsize(dst) // 1024, 'KB')
