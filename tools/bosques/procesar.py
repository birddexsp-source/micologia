"""Convierte el Inventario Forestal de la CAPV 2024 (Gobierno Vasco, CC BY 4.0), ya recortado por descargar.py,
en docs/data/bosques.json: rodales simplificados con su tipo de bosque, especies, estado y un índice de interés
micológico, más las «zonas calientes» (manchas grandes de bosque autóctono maduro).
Uso: python3 tools/bosques/procesar.py ruta/inventario.geojson"""
import json, sys, math, os
import geopandas as gpd
from shapely.geometry import Polygon, MultiPolygon, box
from shapely.ops import unary_union

ORIG = sys.argv[1] if len(sys.argv) > 1 else '../bosques-datos/inventario.geojson'
SALIDA = 'docs/data/bosques.json'

# Tipo de bosque de cada especie del inventario (SP1_es/SP2_es/SP3_es) → (clase, hábitats de la app)
AUTO = {'Bosque mixto atlántico': ['mixto', 'frondosas', 'robledal'], 'Roble pedunculado': ['robledal', 'frondosas'],
        'Roble albar': ['robledal', 'frondosas'], 'Marojo': ['robledal', 'frondosas'], 'Quejigo': ['robledal', 'frondosas'],
        'Haya': ['hayedo', 'frondosas'], 'Castaño': ['castanar', 'frondosas'], 'Encina': ['encinar', 'frondosas'],
        'Abedul': ['abedular', 'frondosas'], 'Abedul pubescens': ['abedular', 'frondosas'], 'Madroño': ['frondosas'], 'Avellano': ['frondosas'],
        'Roble': ['robledal', 'frondosas'], 'Rebollo': ['robledal', 'frondosas'], 'Quejigo fagínea': ['robledal', 'frondosas'], 'Roble húmilis': ['robledal', 'frondosas']}
FPLANT = {'Roble americano': ['robledal', 'frondosas'], 'Plantaciones de frondosas variadas': ['frondosas'],
          'Plantaciones de frondosas y coníferas variadas': ['frondosas', 'mixto', 'coniferas'], 'Frondosas de gran porte': ['frondosas']}
PINOS = ['Pino', 'Otros pinos']
CONIF = {'Abeto Douglas': ['coniferas'], 'Alerce': ['coniferas'], 'Abeto': ['abetal', 'coniferas'], 'Picea': ['abetal', 'coniferas'],
         'Plantaciones de coníferas variadas': ['coniferas'], 'Pícea de Sitka': ['abetal', 'coniferas'], 'Pícea europea': ['abetal', 'coniferas'],
         'Tsuga': ['coniferas'], 'Cedro': ['coniferas'], 'Otras coníferas': ['coniferas']}
CLASES = {  # orden = prioridad en la leyenda · v = valor micológico base
  'auto': dict(n='Bosque autóctono', c='#2f9e44', v=1.0, d='Robles, hayas, encinas, castaños o bosque mixto atlántico: lo más rico en setas de micorriza (boletos, amanitas, rúsulas…).'),
  'fron': dict(n='Plantación de frondosas', c='#94d82d', v=0.7, d='Robles americanos u otras frondosas plantadas: también tienen setas de micorriza, aunque menos variedad.'),
  'pino': dict(n='Pinar', c='#e0a458', v=0.55, d='Pino radiata, pináster o laricio: níscalos, boletos de pino, Suillus… Mejor cuanto más viejo y abierto.'),
  'coni': dict(n='Otras coníferas', c='#b08968', v=0.45, d='Douglas, alerce… Algunas setas propias (por ejemplo Suillus con el alerce).'),
  'otra': dict(n='Otros árboles', c='#868e96', v=0.25, d='Ribera, acacia, ciprés japonés, nogal…: pocas setas de las que buscas.'),
  'euca': dict(n='Eucalipto', c='#e03131', v=0.03, d='Plantación de eucalipto: casi sin setas de nuestros bosques. Evítalo.'),
  'mato': dict(n='Matorral', c='#fcc419', v=0.0, d='Arbustedo o matorral (zarzas, argoma, árboles jóvenes): pegado a pinar o a bosque autóctono es muy buen sitio para buscar.'),
  'abie': dict(n='Prado o pastizal', c='#ffe8a3', v=0.0, d='Zona abierta: sus bordes con pinar o con bosque autóctono son de lo mejor para buscar.'),
  'line': dict(n='Línea eléctrica o cortafuegos', c='#fff3bf', v=0.0, d='Franja despejada dentro del monte: los bordes con pinar dan níscalos.'),
}
ABIERTOS = {'Arbustedos': 'mato', 'Prados': 'abie', 'Prados con setos': 'abie', 'Herbazal-Pastizal': 'abie', 'Pastizal-Matorral': 'abie', 'Energia': 'line'}
ESTADO = {1: ('Repoblado', 0.3), 2: ('Monte bravo', 0.5), 3: ('Latizal', 0.85), 4: ('Fustal', 1.0), 5: ('Talado', 0.15)}

def clase(sp):
    if not sp or sp == 'nan': return None, []
    if sp in AUTO: return 'auto', AUTO[sp]
    if sp in FPLANT: return 'fron', FPLANT[sp]
    if 'ucalipt' in sp: return 'euca', []
    if sp.startswith('Pino') or sp == 'Otros pinos': return 'pino', ['pinar', 'coniferas']
    if sp in CONIF: return 'coni', CONIF[sp]
    return 'otra', []

g = gpd.read_file(ORIG)
g = g[g.TIPES_es.isin(['Bosque', 'Bosque de Plantacion', 'Bosque de Galeria'] + list(ABIERTOS))].to_crs(25830)
sp_idx, raros = [], set()
def idx(s):
    if s not in sp_idx: sp_idx.append(s)
    return sp_idx.index(s)
P = []; fil = []
for r in g.itertuples():
    if r.TIPES_es in ABIERTOS:
        geom = r.geometry.simplify(6, preserve_topology=True)
        for p in (list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom]):
            if not p.is_empty and p.area >= 400: P.append(dict(c=ABIERTOS[r.TIPES_es], sp=[], e=0, s=0, geom=p))
        continue
    sps = [(getattr(r, f'SP{i}_es'), getattr(r, f'O{i}') or 0) for i in (1, 2, 3)]
    sps = [(s, o) for s, o in sps if s and str(s) != 'nan']
    if not sps:
        if r.TIPES_es == 'Bosque de Galeria': sps = [('Árboles ripícolas', 10)]
        else: continue
    cls = [clase(s)[0] for s, _ in sps]
    for s, _ in sps:
        if clase(s)[0] == 'otra': raros.add(s)
    tot = sum(o for _, o in sps) or 1
    base = sum(CLASES[c]['v'] * (o or 1) for c, (_, o) in zip(cls, sps)) / sum((o or 1) for _, o in sps)
    nat = len({s for s, c in zip([s for s, _ in sps], cls) if c != 'euca'})
    e = int(r.E1 or 0); est = ESTADO.get(e, ('', 0.7))
    score = min(1.0, base * est[1] + 0.05 * max(0, nat - 1))
    geom = r.geometry.simplify(6, preserve_topology=True)
    polys = list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom]
    for p in polys:
        if p.is_empty or p.area < 400: continue
        P.append(dict(c=cls[0], sp=[(idx(s), int(o)) for s, o in sps], e=e, s=round(score * 100), geom=p))
print('rodales', len(P), '· especies', len(sp_idx), '· «otros»:', sorted(raros))

# zonas calientes: cuadrículas de 400 m con más bosque autóctono/frondosas maduro, separadas al menos 900 m entre sí
CEL = 400
buenas = [p for p in P if p['c'] in ('auto', 'fron') and p['s'] >= 60]
celdas = {}
for p in buenas:
    x0, y0, x1, y1 = p['geom'].bounds
    for i in range(int(x0 // CEL), int(x1 // CEL) + 1):
        for j in range(int(y0 // CEL), int(y1 // CEL) + 1):
            a = p['geom'].intersection(box(i * CEL, j * CEL, (i + 1) * CEL, (j + 1) * CEL)).area
            if a > 0: celdas.setdefault((i, j), []).append((p, a))
cand = []
for (i, j), l in celdas.items():
    area = sum(a for _, a in l)
    if area < 60000: continue          # al menos 6 ha de buen bosque en la cuadrícula de 16 ha
    media = sum(p['s'] * a for p, a in l) / area
    cand.append((media / 100 * area / (CEL * CEL), i, j, l, area, media))
cand.sort(key=lambda c: -c[0]); cal = []
for v, i, j, l, area, media in cand:
    cx, cy = (i + .5) * CEL, (j + .5) * CEL
    if any(math.hypot(cx - z['x'], cy - z['y']) < 900 for z in cal): continue
    comp, ests = {}, {}
    for p, a in l:
        for k, o in p['sp']: comp[k] = comp.get(k, 0) + a * (o or 10) / 10
        ests[p['e']] = ests.get(p['e'], 0) + a
    celda = box(i * CEL, j * CEL, (i + 1) * CEL, (j + 1) * CEL)
    mejor = max(l, key=lambda t: t[1] * t[0]['s'])[0]['geom'].intersection(celda)
    pt = mejor.representative_point()
    cal.append(dict(x=cx, y=cy, pt=pt, ha=round(area / 10000, 1), s=round(media), sp=[k for k, _ in sorted(comp.items(), key=lambda x: -x[1])[:3]], e=max(ests, key=ests.get)))
    if len(cal) == 25: break
ll = gpd.GeoSeries([z['pt'] for z in cal], crs=25830).to_crs(4326)
for z, q in zip(cal, ll): z.update(lat=round(q.y, 5), lon=round(q.x, 5)); [z.pop(k) for k in ('x', 'y', 'pt')]
print('zonas calientes', len(cal), [(z['ha'], z['s']) for z in cal[:10]])

# geometría compacta: anillo exterior en enteros (grados × 1e5) codificado por diferencias
gs = gpd.GeoSeries([p['geom'] for p in P], crs=25830).to_crs(4326)
out = []
for p, geo in zip(P, gs):
    if isinstance(geo, MultiPolygon): geo = max(geo.geoms, key=lambda x: x.area)
    xs = [(round(y * 1e5), round(x * 1e5)) for x, y, *_ in geo.exterior.coords[:-1]]
    if len(xs) < 3: continue
    d = [xs[0][0], xs[0][1]]
    for (a, b), (c, e) in zip(xs, xs[1:]): d += [c - a, e - b]
    out.append([list(CLASES).index(p['c']), p['s'], p['e'], [v for t in p['sp'] for v in t], d])
datos = dict(fuente='Inventario Forestal de la CAPV 2024 · © Gobierno Vasco / Eusko Jaurlaritza (CC BY 4.0)', ano=2024,
             clases=[dict(k=k, **{x: v for x, v in c.items()}) for k, c in CLASES.items()],
             estados={str(k): v[0] for k, v in ESTADO.items()}, especies=sp_idx,
             habitats={s: clase(s)[1] for s in sp_idx}, calientes=cal, r=out,
             bordes=json.load(open('tools/bosques/bordes.json')) if os.path.exists('tools/bosques/bordes.json') else [],
             recomendados=json.load(open('tools/bosques/recomendados.json')) if os.path.exists('tools/bosques/recomendados.json') else [])
json.dump(datos, open(SALIDA, 'w'), ensure_ascii=False, separators=(',', ':'))
import os; print(SALIDA, round(os.path.getsize(SALIDA) / 1e6, 2), 'MB')
