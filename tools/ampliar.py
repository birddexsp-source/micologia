#!/usr/bin/env python3
"""Amplía docs/data/especies.json a la versión 3: +31 fichas nuevas y datos de libro (hábitat, cómo recoger, curiosidades, nombres en euskera)
para las 25 que ya había. Idempotente. Cada dato sale de las fuentes que se citan en la propia ficha; nada equivale a revisión experta."""
import json, os, sys, re, glob, importlib
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI); sys.path.insert(0, os.path.join(AQUI, 'datos'))
import fotos_v3
import h
from com import COM
for f in sorted(glob.glob(os.path.join(AQUI, 'datos', '[nx][0-9]*.py'))):
    importlib.import_module(os.path.basename(f)[:-3])

RUTA = os.environ.get('ESPECIES_JSON') or os.path.join(AQUI, '..', 'docs', 'data', 'especies.json')
HOY = '2026-11-12'
INAT = json.load(open(os.path.join(AQUI, 'datos', 'inat_v3.json')))
WPT = json.load(open(os.path.join(AQUI, 'datos', 'wp_titulos.json')))
INAT_BOX = 'nelat=43.7&nelng=-1.0&swlat=42.6&swlng=-5.5&quality_grade=research'
ZONA = 'Costa cantábrica (42,6–43,7 N · 5,5–1,0 O: Bizkaia, Gipuzkoa, Cantabria, este de Asturias y norte de Burgos, Araba y Navarra)'
IDIOMA = {'en': 'inglés', 'es': 'español', 'eu': 'euskera'}
MARCA = 'ampliar-v3'
NOTA_WP = 'Fuente terciaria. Sirve para rasgos, hábitat y curiosidades; no sustituye una guía micológica.'
CAND = ('Candidata a comestible según Wikipedia y guías divulgativas (fuentes terciarias). Sin ≥2 fuentes contrastadas ni revisión experta, así que NO se clasifica como comestible: '
        'se trata como no comestible hasta verificarla.')
INAT_UNIR = {'boletos-poros-rojos': ['neoboletus-luridiformis', 'suillellus-luridus']}

def wp_fuentes(claves, campos):
    out = []
    for k in claves:
        t = WPT.get(k)
        if not t: continue
        for l in ('en', 'es', 'eu'):
            if t.get(l):
                out.append({'nombre': 'Wikipedia (%s): %s' % (IDIOMA[l], t[l]), 'url': 'https://%s.wikipedia.org/wiki/%s' % (l, t[l].replace(' ', '_')),
                            'fechaConsulta': HOY, 'campos': campos, 'nota': NOTA_WP, 'origen': MARCA})
    return out

def inat_de(i):
    ks = INAT_UNIR.get(i, [i]); ds = [INAT[k] for k in ks if k in INAT]
    if not ds: return None
    m = [sum(d['mensual'][j] for d in ds) for j in range(12)]
    tx = [str(d['taxon']) for d in ds]
    n = sum(d['n'] for d in ds)
    return {'n': n, 'mensual': m, 'zona': ZONA, 'consulta': HOY,
            'url': ('https://www.inaturalist.org/observations?' + INAT_BOX + '&taxon_id=' + ','.join(tx)) if n else None}

def ordenar(xs):
    s = []
    for x in xs:
        x = (x or '').strip()
        if x and x.lower() not in [y.lower() for y in s]: s.append(x)
    return s

def nueva(i, k, F):
    fu = []
    campos = ['queMirar', 'confusiones', 'habitatTexto', 'curiosidades', 'temporada', 'nombresComunes']
    fu += wp_fuentes(k['wp'], campos)
    if k.get('rioja'):
        fu.append({'nombre': h.RIOJA[0], 'url': h.RIOJA[1], 'fechaConsulta': HOY, 'campos': ['recoleccion'], 'origen': MARCA,
                   'nota': 'Guía oficial de recolección (tamaños mínimos y cómo cortar).'})
    ins = inat_de(i)
    if ins and ins['n']:
        fu.append({'nombre': 'iNaturalist: observaciones de grado de investigación en la costa cantábrica', 'url': ins['url'], 'fechaConsulta': HOY, 'campos': ['temporada'], 'origen': MARCA,
                   'nota': 'Cuenta de observaciones por mes (N=%d). Muestra cuándo se ve la especie, no cuándo es segura.' % ins['n']})
    fu.append({'nombre': 'Wikimedia Commons (fotos)', 'url': 'https://commons.wikimedia.org/', 'fechaConsulta': HOY, 'campos': ['fotos'], 'origen': MARCA,
               'nota': 'Autoría y licencia en cada foto. Las fotos son orientativas y no confirman una identificación.'})
    cl = k['clase']
    if k.get('cand'):
        nota = k.get('nota') or ''  # (la nota de comestibilidad se compone abajo desde COM)
    elif k.get('nota'): nota = k['nota']
    elif cl == 'toxica': nota = 'Tóxica según Wikipedia. ' + (k.get('sind') or '')
    elif cl == 'mortal': nota = 'Potencialmente mortal. ' + (k.get('sind') or '')
    else: nota = 'Sin interés para la mesa según Wikipedia.'
    e = {'id': i, 'nombreCientifico': k['cient'], 'sinonimos': k['sin'], 'nombresComunes': {'es': ordenar(k['es']), 'eu': ordenar(k['eu'])},
         'clase': cl, 'grupo': k['grupo'], 'candidataComestible': bool(k.get('cand')), 'notaComestibilidad': nota.strip()}
    if k.get('sind'): e['sindrome'] = k['sind']
    if k.get('lat'): e['latencia'] = k['lat']
    if k.get('grav'): e['gravedad'] = k['grav']
    e.update({'confusiones': k['conf'], 'nivelVerificacion': 'borrador', 'fuentes': fu, 'fotos': F[i], 'clave': k['clave'], 'queMirar': k['mirar'],
              'temporada': {'inat': ins or {'n': 0, 'mensual': [0] * 12, 'zona': ZONA, 'consulta': HOY, 'url': None},
                            'texto': {'meses': k['meses'], 'nota': k['mnota'], 'fuente': 'Wikipedia'}},
              'habitats': k['hab'], 'habitatTexto': k['habt'], 'recoleccion': k['rec'], 'curiosidades': k['cur']})
    if k.get('esp'): e['esporada'] = k['esp']
    if k.get('nomen'): e['notaNomenclatura'] = k['nomen']
    return e

def enriquecer(e, x):
    e['nombresComunes']['eu'] = ordenar(e['nombresComunes'].get('eu', []) + x['eu'])
    e['habitats'] = x['hab'] if 'hab' in x else e.get('habitats', [])
    if x.get('conf') and not e.get('confusiones'): e['confusiones'] = x['conf']
    e['habitatTexto'] = x['habt']; e['recoleccion'] = x['rec']; e['curiosidades'] = x['cur']
    for q in e.get('queMirar', []):
        if q['parte'] == 'esporada' and not e.get('esporada'):
            m = re.match(r'Esporada (.+)', q['titulo'])
            if m: e['esporada'] = m.group(1).lower()
    e['fuentes'] = [f for f in e['fuentes'] if f.get('origen') != MARCA]
    pos = max(i for i, f in enumerate(e['fuentes']) if not f['nombre'].startswith(('Wikimedia Commons',)) ) + 1
    nuevas = [f for f in wp_fuentes(x["wp"], ["habitatTexto", "curiosidades", "nombresComunes"]) if not f["nombre"].startswith("Wikipedia (inglés)")]
    if 'La Rioja' in x['rec']['txt']:
        nuevas.append({'nombre': h.RIOJA[0], 'url': h.RIOJA[1], 'fechaConsulta': HOY, 'campos': ['recoleccion'], 'origen': MARCA, 'nota': 'Guía oficial de recolección (tamaños mínimos y cómo cortar).'})
    e["fuentes"][pos:pos] = nuevas

def binomio(c): return ' '.join(re.sub(r'[()]', '', c.split(' (')[0]).split()[:2]).lower()

def enlazar(esps):
    bins = {}
    for e in esps:
        for part in re.split(r' / | y ', e['nombreCientifico'].split(' (')[0]): bins.setdefault(binomio(part), e['id'])
        bins.setdefault(binomio(e['nombreCientifico']), e['id'])
    bins.update({'lepista nebularis': 'clitocybe-nebularis'})
    ids = {e['id'] for e in esps}
    for e in esps:
        for c in e.get('confusiones', []):
            if c['id'] and c['id'] not in ids: c['id'] = None
            if not c['id']:
                nom = c['nombre'].lower(); hits = sorted((nom.find(b), i) for b, i in bins.items() if b in nom and i != e['id'])
                if hits: c['id'] = hits[0][1]

def comestibilidad(esps):
    """Marca lo que dicen las fuentes. No es una verificación: la ficha sigue en borrador y la clase interna no cambia."""
    for e in esps:
        if not e.get('candidataComestible'): e.pop('comestibilidad', None); continue
        nivel, txt = COM[e['id']]
        e['comestibilidad'] = {'nivel': nivel, 'txt': txt, 'segun': 'Wikipedia (inglés, español, euskera) y guías divulgativas: fuentes terciarias, sin revisión experta'}
        e['notaComestibilidad'] = txt
    assert {e['id'] for e in esps if e.get('candidataComestible')} == set(COM), 'COM no coincide con las candidatas'

def reciprocas(esps):
    """Si A cita a B como confusión, B cita a A. El texto es la regla clave de A (ya sourced en su ficha); la gravedad es la misma."""
    por = {e['id']: e for e in esps}
    for e in esps:
        for c in list(e.get('confusiones') or []):
            o = por.get(c['id']) if c['id'] else None
            if o is None or any(x['id'] == e['id'] for x in (o.get('confusiones') or [])): continue
            o.setdefault('confusiones', []).append({'id': e['id'], 'nombre': e['nombreCientifico'].split(' (')[0],
                'comoDistinguir': 'La ficha de ' + e['nombreCientifico'].split(' (')[0] + ' avisa de esta confusión. Para reconocer esa especie: ' + e['clave'], 'gravedad': c['gravedad'], 'inversa': True})

def main():
    d = json.load(open(RUTA))
    F = fotos_v3.por_ficha3()
    previas = [e for e in d['especies'] if e['id'] not in h.N]
    assert len(previas) == 25, len(previas)
    assert set(h.X) == {e['id'] for e in previas}, set(h.X) ^ {e['id'] for e in previas}
    for e in previas:
        if 'confusiones' in e: e['confusiones'] = [c for c in e['confusiones'] if not c.get('inversa')]
        enriquecer(e, h.X[e['id']])
    nuevas = [nueva(i, k, F) for i, k in h.N.items()]
    d['especies'] = previas + nuevas
    enlazar(d['especies'])
    reciprocas(d['especies'])
    comestibilidad(d['especies'])
    d['version'] = 3; d['generado'] = HOY
    json.dump(d, open(RUTA, 'w'), ensure_ascii=False, indent=1)
    ids = [e['id'] for e in d['especies']]; assert len(ids) == len(set(ids))
    print('ok', len(ids), 'fichas;', sum(len(e['fotos']) for e in d['especies']), 'fotos')

if __name__ == '__main__':
    main()
