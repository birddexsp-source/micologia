"""Descarga el Inventario Forestal de la CAPV (Gobierno Vasco, CC BY 4.0), lo recorta a la comarca de Bermeo
y lo guarda en WGS84 con todos sus atributos (lo procesa luego tools/bosques/procesar.py)."""
import io, json, os, sys, urllib.request, zipfile, collections
import geopandas as gpd
from shapely.geometry import box
URLS = ['https://www.geo.euskadi.eus/cartografia/DatosDescarga/Agricultura/INV_FORESTAL_2025_10000_ETRS89.zip',
        'https://www.geo.euskadi.eus/cartografia/DatosDescarga/Agricultura/INV_FORESTAL_2024_10000_ETRS89.zip']
BBOX = (-2.95, 43.28, -2.55, 43.47)   # lon/lat: Bakio · Bermeo · Urdaibai · Gernika · Mungia
os.makedirs('out', exist_ok=True); log = []
for u in URLS:
    try:
        req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
        raw = urllib.request.urlopen(req, timeout=300).read(); fuente = u; break
    except Exception as e: log.append(f'{u}: {e}')
else: print('\n'.join(log)); sys.exit(1)
z = zipfile.ZipFile(io.BytesIO(raw)); z.extractall('raw'); log.append('fuente ' + fuente); log += ['zip: ' + n for n in z.namelist()]
shps = [os.path.join(r, f) for r, _, fs in os.walk('raw') for f in fs if f.lower().endswith('.shp')]
for shp in shps:
    g = gpd.read_file(shp); log.append(f'{shp}: {len(g)} rasgos, crs {g.crs}, campos {list(g.columns)}')
    g = g.to_crs(4326); g = g[g.intersects(box(*BBOX))].copy(); g['geometry'] = g.geometry.intersection(box(*BBOX))
    log.append(f'  en la zona: {len(g)}')
    for c in g.columns:
        if c != 'geometry' and g[c].dtype == object:
            vc = collections.Counter(g[c].astype(str)); log.append(f'  {c}: {len(vc)} valores · ' + ' | '.join(f'{k}={v}' for k, v in vc.most_common(40)))
    g.to_file('out/' + os.path.splitext(os.path.basename(shp))[0] + '.geojson', driver='GeoJSON')
open('out/informe.txt', 'w').write('\n'.join(log)); print('\n'.join(log))
