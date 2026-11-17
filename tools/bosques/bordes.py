"""Bordes «de setas»: líneas de transición entre bosque bueno (pinar o frondosa autóctona, no eucalipto, no recién plantado)
y zona abierta (prado, pastizal, matorral/arbustedo, cortafuegos o línea eléctrica), a partir del Inventario Forestal CAPV 2024.
Sale de lo que dicen los hallazgos de Jon: casi todos a menos de 15 m de un borde, y sobre todo en matorral junto a bosque
y en pinar junto a prado o línea eléctrica.  Uso: python3 tools/bosques/bordes.py ../bosques-datos/inventario.geojson"""
import json, sys, math
import geopandas as gpd
from shapely.geometry import Point, LineString, MultiLineString, box
from shapely.ops import unary_union, linemerge
ORIG = sys.argv[1] if len(sys.argv) > 1 else '../bosques-datos/inventario.geojson'
CENTRO = (43.4205, -2.7230)   # Bermeo
RADIO = 14000
g = gpd.read_file(ORIG).to_crs(25830)
c = gpd.GeoSeries([Point(CENTRO[1], CENTRO[0])], crs=4326).to_crs(25830)[0]
g = g[g.intersects(c.buffer(RADIO))].copy()
def tipo(t, s, e):
    s = str(s); e = int(e or 0)
    if t in ('Prados', 'Prados con setos', 'Herbazal-Pastizal', 'Pastizal-Matorral', 'Cultivos'): return 'abierto'
    if t == 'Arbustedos': return 'matorral'
    if t == 'Energia': return 'linea'
    if 'ucalipt' in s or not t.startswith('Bosque'): return None
    if e in (1, 2, 5): return None                      # recién plantado, monte bravo cerrado o talado
    if s.startswith('Pino') or s == 'Otros pinos': return 'pinar'
    if s in ('Bosque mixto atlántico', 'Roble pedunculado', 'Roble albar', 'Marojo', 'Rebollo', 'Roble', 'Haya', 'Castaño', 'Encina', 'Abedul', 'Abedul pubescens', 'Roble americano', 'Plantaciones de frondosas variadas', 'Avellano', 'Madroño'): return 'frondosa'
    return None
g['k'] = [tipo(t, s, e) for t, s, e in zip(g.TIPES_es, g.SP1_es, g.E1)]
bos = g[g.k.isin(['pinar', 'frondosa'])]; abi = g[g.k.isin(['abierto', 'matorral', 'linea'])]
abi_u = unary_union(list(abi.geometry.buffer(2.5)))
lineas = []
for r in bos.itertuples():
    b = r.geometry.boundary.intersection(abi_u)
    if b.is_empty: continue
    parts = [b] if isinstance(b, LineString) else [x for x in getattr(b, 'geoms', []) if isinstance(x, LineString)]
    m = linemerge(parts) if parts else None
    if m is None or m.is_empty: continue
    for l in ([m] if isinstance(m, LineString) else list(m.geoms)):
        if l.length < 25: continue
        lineas.append(dict(k=r.k, sp=str(r.SP1_es), l=l.simplify(4)))
tot = {k: round(sum(x['l'].length for x in lineas if x['k'] == k) / 1000, 1) for k in ('pinar', 'frondosa')}
print('bordes', len(lineas), 'km', tot)
# recomendaciones: cuadros de 300 m con más metros de borde bueno, sin eucalipto dominante, separados 800 m
CEL = 300; cel = {}
for x in lineas:
    l = x['l']; n = max(1, int(l.length // 20))
    for i in range(n + 1):
        p = l.interpolate(i / n, normalized=True); k = (int(p.x // CEL), int(p.y // CEL))
        d = cel.setdefault(k, {'pinar': 0, 'frondosa': 0, 'sp': {}}); d[x['k']] += l.length / (n + 1); d['sp'][x['sp']] = d['sp'].get(x['sp'], 0) + 1
euca = g[[('ucalipt' in str(s)) for s in g.SP1_es]]
eu_u = unary_union(list(euca.geometry))
spots = json.load(open(sys.argv[2])) if len(sys.argv) > 2 else []
sp_xy = [gpd.GeoSeries([Point(s['lon'], s['lat'])], crs=4326).to_crs(25830)[0] for s in spots]
cand = []
for (i, j), d in cel.items():
    q = box(i * CEL, j * CEL, (i + 1) * CEL, (j + 1) * CEL)
    if eu_u.intersection(q).area / q.area > .45: continue
    v = d['pinar'] + d['frondosa'] * 1.1
    if v < 250: continue
    km = math.hypot((i + .5) * CEL - c.x, (j + .5) * CEL - c.y) / 1000
    if km > 10: continue
    cand.append((v * math.exp(-km / 6), i, j, d))   # cuanto más cerca de Bermeo, mejor
cand.sort(key=lambda t: -t[0])
def elegir(filtro, n):
    out = []
    for v, i, j, d in cand:
        if not filtro(d): continue
        cx, cy = (i + .5) * CEL, (j + .5) * CEL
        if any(math.hypot(cx - o['x'], cy - o['y']) < 900 for o in elegidos + out): continue
        if any(math.hypot(cx - p.x, cy - p.y) < 350 for p in sp_xy): continue     # ya es un spot tuyo
        # punto: el centro del tramo de borde más cercano al centro del cuadro
        pc = Point(cx, cy); best = min((x for x in lineas if x['l'].distance(pc) < CEL), key=lambda x: x['l'].distance(pc))
        pt = best['l'].interpolate(best['l'].project(pc))
        out.append(dict(x=cx, y=cy, pt=pt, v=round(d['pinar'] + d['frondosa']), pinar=round(d['pinar']), frondosa=round(d['frondosa']), sp=[k for k, _ in sorted(d['sp'].items(), key=lambda t: -t[1])[:3]], tipo=best['k']))
        if len(out) == n: break
    return out
elegidos = []
elegidos += elegir(lambda d: d['pinar'] > d['frondosa'], 6)
elegidos += elegir(lambda d: d['frondosa'] >= d['pinar'], 6)
ll = gpd.GeoSeries([e['pt'] for e in elegidos], crs=25830).to_crs(4326)
for e, p in zip(elegidos, ll): e.update(lat=round(p.y, 6), lon=round(p.x, 6), km=round(c.distance(e['pt']) / 1000, 1)); [e.pop(k) for k in ('x', 'y', 'pt')]
json.dump(elegidos, open('tools/bosques/recomendados.json', 'w'), ensure_ascii=False, indent=1)
for e in elegidos: print(e)
# líneas para el mapa (grados × 1e5, diferencias)
gl = gpd.GeoSeries([x['l'] for x in lineas], crs=25830).to_crs(4326); out = []
for x, l in zip(lineas, gl):
    xs = [(round(y * 1e5), round(xx * 1e5)) for xx, y, *_ in l.coords]
    d = [xs[0][0], xs[0][1]]
    for (a, b), (cc, ee) in zip(xs, xs[1:]): d += [cc - a, ee - b]
    out.append([0 if x['k'] == 'pinar' else 1, d])
json.dump(out, open('tools/bosques/bordes.json', 'w'), separators=(',', ':'))
import os; print('bordes.json', round(os.path.getsize('tools/bosques/bordes.json') / 1e6, 2), 'MB')
