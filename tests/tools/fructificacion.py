#!/usr/bin/env python3
"""Añade `fructificacion` (cuándo sale: lluvia, temperatura, heladas) a cada especie de docs/data/especies.json.
Se agrupa por gremio ecológico. LO QUE ES ESTUDIO y LO QUE ES HIPÓTESIS va marcado en `base`/`confianza`:
  - boletus-edulis: umbrales del estudio decenal de bioRxiv (hayedo, Alemania): media ≈13 °C en los 20 días previos, lluvia de ventana ≈26 días.
  - resto: valores iniciales del modelo (hipótesis razonadas con boletines micológicos y estudios de rendimiento de España), pensados para
    ajustarse con las salidas reales de Jon. No son umbrales publicados para cada especie.
Uso: python3 tests/tools/fructificacion.py"""
import json, sys, os
RAIZ = os.path.join(os.path.dirname(__file__), '..', '..')
F = os.path.join(RAIZ, 'docs', 'data', 'especies.json')

SRC = {
  'edulis': {'t': 'Predicting porcini: una década de monitorización de Boletus edulis en hayedos (bioRxiv, 2025)', 'url': 'https://www.biorxiv.org/content/10.64898/2025.12.12.693895.full.pdf'},
  'micocyl': {'t': 'Partes micológicos de Micocyl (Castilla y León), octubre 2024', 'url': 'https://micocyl.es/sites/default/files/editor/parte_mico_20241028.pdf'},
  'pinares': {'t': 'Modelos de producción de hongos micorrícicos en pinares del norte de España (Forest Ecosystems, 2019)', 'url': 'https://link.springer.com/article/10.1186/s40663-019-0211-1'},
  'ara': {'t': 'Quant temps més haurem d’esperar perquè surtin els bolets? (Ara, micólogos catalanes)', 'url': 'https://es.ara.cat/comer/temps-mes-haurem-d-esperar-perque-surtin-bolets_1_5866896.html'},
  'morel': {'t': 'Is it time for morels yet? (NAMYCO): calor acumulada del suelo en 20 días', 'url': 'https://namyco.org/?p=1856'},
}
# gremio -> parámetros del modelo (ventana de lluvia en días, mm acumulados «ideales», temperatura media de la ventana, anchura, sensibilidad a la helada)
G = {
  'termo':   {'nombre': 'Micorrícica de calor (boletos, cesárea…)', 'lluvia': {'ventana': 26, 'ideal': 78}, 'temp': {'ventana': 20, 'opt': 13.5, 'ancho': 6, 'rango': [10, 15]}, 'helada': 'fuerte', 'fuentes': ['edulis', 'micocyl', 'pinares']},
  'ecm':     {'nombre': 'Micorrícica de otoño', 'lluvia': {'ventana': 21, 'ideal': 60}, 'temp': {'ventana': 20, 'opt': 12, 'ancho': 6, 'rango': [8, 15]}, 'helada': 'fuerte', 'fuentes': ['micocyl', 'pinares', 'ara']},
  'tardia':  {'nombre': 'Micorrícica o saprótrofa tardía (aguanta el frío)', 'lluvia': {'ventana': 21, 'ideal': 60}, 'temp': {'ventana': 20, 'opt': 9, 'ancho': 6, 'rango': [5, 13]}, 'helada': 'suave', 'fuentes': ['micocyl', 'ara']},
  'prado':   {'nombre': 'Saprótrofa de prado y suelo', 'lluvia': {'ventana': 10, 'ideal': 25}, 'temp': {'ventana': 10, 'opt': 14, 'ancho': 8, 'rango': [9, 19]}, 'helada': 'fuerte', 'fuentes': ['ara']},
  'madera':  {'nombre': 'Saprótrofa de madera (ciclo anual)', 'lluvia': {'ventana': 14, 'ideal': 35}, 'temp': {'ventana': 10, 'opt': 12, 'ancho': 9, 'rango': [6, 18]}, 'helada': 'suave', 'fuentes': ['ara']},
  'primavera': {'nombre': 'De primavera', 'lluvia': {'ventana': 20, 'ideal': 40}, 'temp': {'ventana': 20, 'opt': 10, 'ancho': 5, 'rango': [7, 13]}, 'helada': 'suave', 'fuentes': ['morel', 'ara']},
  'perenne': {'nombre': 'Perenne de madera (se ve casi todo el año)', 'perenne': True, 'fuentes': []},
}
M = {
 'termo': 'boletus-edulis boletus-aereus boletus-pinophilus boletus-reticulatus boletus-satanas boletos-poros-rojos amanita-caesarea russula-virescens tylopilus-felleus gyroporus-castaneus',
 'ecm': '''amanita-phalloides amanita-verna-virosa amanita-pantherina-muscaria amanita-rubescens amanita-citrina amanita-gemmata cortinarius-orellanus cortinarius-rubellus
   entoloma-lividum-sinuatum inocybe-erubescens paxillus-involutus laccaria-amethystina tricholoma-pardinum tricholoma-equestre tricholoma-sulphureum xerocomellus-chrysenteron
   xerocomus-subtomentosus suillus-luteus suillus-granulatus leccinum-scabrum imleria-badia chalciporus-piperatus russula-cyanoxantha russula-emetica lactarius-torminosus
   lactarius-piperatus sparassis-crispa cantharellus-cibarius ramaria-formosa clavulina-cristata scleroderma-citrinum suillus-bovinus russula-sanguinea amanita-excelsa laccaria-laccata''',
 'tardia': '''lactarius-deliciosus hydnum-repandum hydnum-rufescens craterellus-cornucopioides craterellus-tubaeformis craterellus-lutescens tricholoma-portentosum tricholoma-terreum
   clitocybe-nebularis lepista-nuda helvella-crispa aleuria-aurantia hygrophoropsis-aurantiaca''',
 'prado': '''lepiota-brunneoincarnata clitocybe-rivulosa macrolepiota-procera marasmius-oreades agaricus-campestris agaricus-xanthodermus agaricus-arvensis coprinus-comatus
   lycoperdon-perlatum chlorophyllum-rhacodes leucoagaricus-leucothites infundibulicybe-gibba infundibulicybe-geotropa lyophyllum-decastes hygrocybe-coccinea cuphophyllus-pratensis
   stropharia-aeruginosa clitocybe-odora mycena-pura clitopilus-prunulus volvopluteus-gloiocephalus protostropharia-semiglobata coprinopsis-picacea candolleomyces-candolleanus clathrus-archeri megacollybia-platyphylla oudemansiella-radicata mycetinis-alliaceus marasmius-rotula''',
 'madera': '''daedaleopsis-confragosa stereum-hirsutum trametes-hirsuta schizophyllum-commune galerina-marginata omphalotus-illudens coprinopsis-atramentaria armillaria-mellea pleurotus-ostreatus laetiporus-sulphureus fistulina-hepatica auricularia-auricula-judae
   hypholoma-fasciculare coprinellus-micaceus kuehneromyces-mutabilis pholiota-squarrosa gymnopilus-junonius calocera-viscosa tremella-mesenterica clathrus-ruber phallus-impudicus apioperdon-pyriforme coprinellus-disseminatus cyclocybe-cylindracea pluteus-cervinus mycena-galericulata oudemansiella-mucida fomitopsis-betulina xylaria-hypoxylon inonotus-hispidus favolaschia-claudopus chlorociboria-aeruginascens''',
 'primavera': 'calocybe-gambosa morchella gyromitra entoloma-clypeatum hygrophorus-marzuolus',
 'perenne': 'trametes-versicolor fomes-fomentarius ganoderma-applanatum fomitopsis-pinicola',
}
GREMIO = {i: g for g, ids in M.items() for i in ids.split()}
# valores propios de una especie (solo cuando hay fuente)
ESP = {'boletus-edulis': {'base': 'estudio', 'confianza': 'media',
        'nota': 'Estudio de 10 años en un hayedo del noroeste de Alemania: la fructificación se concentró con una media de ≈13 °C en los 20 días previos (entre 10 y 15 °C) y aumentó con la lluvia de los ≈26 días previos, sin techo. En Bizkaia el clima es más suave: tómalo como guía, no como regla.'}}

def lineas(g, p, e):
    if p.get('perenne'): return ['Es una seta perenne de madera: sale muy despacio y se ve casi todo el año. La lluvia de estos días no cambia que esté o no.']
    L = p['lluvia']; T = p['temp']
    out = ['Lluvia: lo que cuenta es lo acumulado en los últimos ~%d días (unos %d mm o más), no la lluvia del día anterior. Aparece días o semanas después de una buena tanda de lluvias, no al día siguiente.' % (L['ventana'], L['ideal'])]
    out.append('Temperatura: media de %d–%d °C en los últimos ~%d días (el punto ideal ronda los %g °C).' % (T['rango'][0], T['rango'][1], T['ventana'], T['opt']))
    out.append({'fuerte': 'Heladas: una helada (mínima ≤ 0 °C) frena la salida; espera a que pase.', 'suave': 'Heladas: aguanta mejor el frío que otras, pero una helada fuerte también la frena.'}[p['helada']])
    out.append('Viento seco y sol tras la lluvia secan el suelo y cortan la salida.')
    return out

def main():
    d = json.load(open(F, encoding='utf-8')); es = d['especies']
    faltan = [e['id'] for e in es if e['id'] not in GREMIO]; sobran = [i for i in GREMIO if i not in {e['id'] for e in es}]
    if faltan or sobran: print('FALTAN', faltan, 'SOBRAN', sobran); sys.exit(1)
    for e in es:
        g = GREMIO[e['id']]; p = G[g]; x = ESP.get(e['id'], {})
        f = {'gremio': g, 'gremioNombre': p['nombre']}
        if p.get('perenne'): f['perenne'] = True
        else:
            f['lluvia'] = dict(p['lluvia']); f['temp'] = dict(p['temp']); f['helada'] = p['helada']
        f['base'] = x.get('base', 'hipotesis'); f['confianza'] = x.get('confianza', 'baja' if not p.get('perenne') else 'media')
        f['texto'] = lineas(g, p, e)
        if x.get('nota'): f['nota'] = x['nota']
        f['fuentes'] = [SRC[k] for k in (['edulis', 'micocyl', 'pinares'] if x.get('base') == 'estudio' else p['fuentes'])]
        e['fructificacion'] = f
    d['version'] = max(d.get('version', 5), 6)
    json.dump(d, open(F, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('ok', len(es), 'especies;', {g: sum(1 for v in GREMIO.values() if v == g) for g in G})
main()
