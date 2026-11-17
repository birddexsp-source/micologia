"""Descarga el Inventario Forestal de la CAPV (Gobierno Vasco, CC BY 4.0), lo recorta a la comarca de Bermeo
y lo guarda en WGS84 con todos sus atributos (lo procesa luego tools/bosques/procesar.py)."""
import io, json, os, sys, urllib.request, zipfile, collections
import geopandas as gpd
from shapely.geometry import box
B = 'www.geo.euskadi.eus/cartografia/DatosDescarga/Agricultura/INV_FORESTAL_{}_10000_ETRS89.zip'
URLS = [p + B.format(a) for a in (2025, 2024) for p in ('https://', 'http://')]
BBOX = (-2.95, 43.28, -2.55, 43.47)   # lon/lat: Bakio · Bermeo · Urdaibai · Gernika · Mungia
os.makedirs('out', exist_ok=True); log = []
for u in URLS:
    try:
        req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
        raw = urllib.request.urlopen(req, timeout=300).read(); fuente = u; break
    except Exception as e: log.append(f'{u}: {e}')
else: print('::error::' + ' ## '.join(log)); sys.exit(1)
z = zipfile.ZipFile(io.BytesIO(raw)); z.extractall('raw'); log.append('fuente ' + fuente); log += ['zip: ' + n for n in z.namelist()]
shps = [os.path.join(r, f) for r, _, fs in os.walk('raw') for f in fs if f.lower().endswith('.shp')]
import traceback
CAMPOS = ['TIPES_es', 'SP1_es', 'O1', 'E1', 'EMASA1', 'SP2_es', 'O2', 'SP3_es', 'O3', 'FCCARB', 'FORARB', 'DISTRIB', 'HMMAT']
try:
  for shp in shps:
    g = gpd.read_file(shp); log.append(f'{shp}: {len(g)} rasgos, crs {g.crs}')
    g = g.to_crs(4326); g = g[g.intersects(box(*BBOX))][[c for c in CAMPOS if c in g.columns] + ['geometry']].copy()
    log.append(f'  en la zona: {len(g)}')
    for c in g.columns:
        if c != 'geometry':
            vc = collections.Counter(g[c].astype(str)); log.append(f'  {c}: {len(vc)} valores · ' + ' | '.join(f'{k}={v}' for k, v in vc.most_common(30)))
    g.to_file('out/inventario.geojson', driver='GeoJSON', COORDINATE_PRECISION=6)
except Exception:
  log.append(traceback.format_exc()); print('::error::' + ' ## '.join(log)[-3500:]); sys.exit(1)
open('out/informe.txt', 'w').write('\n'.join(log)); print('\n'.join(log)); print('::notice::' + ' ## '.join(log)[:3500])
