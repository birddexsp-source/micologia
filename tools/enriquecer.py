#!/usr/bin/env python3
"""Enriquece docs/data/especies.json: fotos (Commons), qué mirar, temporada, fuentes.
Cada dato sale de una fuente citada en la propia ficha. Nada de esto equivale a revisión experta."""
import json, os, sys
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import fotos

RUTA = os.environ.get('ESPECIES_JSON') or os.path.join(AQUI, '..', 'docs', 'data', 'especies.json')
HOY = '2026-11-12'
WP = lambda t: 'https://en.wikipedia.org/wiki/' + t.replace(' ', '_')
INAT_BOX = 'nelat=43.7&nelng=-1.0&swlat=42.6&swlng=-5.5&quality_grade=research'
ZONA = 'Costa cantábrica (42,6–43,7 N · 5,5–1,0 O: Bizkaia, Gipuzkoa, Cantabria, este de Asturias y norte de Burgos, Araba y Navarra)'

# partes: sombrero, cutis, himenio, pie, anillo, volva, carne, olor, esporada, habitat
def q(parte, t, d): return {'parte': parte, 'titulo': t, 'texto': d}

# id: dict(clave, mirar[], wp[títulos], inat[taxon ids], mensual[12], n, texto{meses[], nota})
D = {
'amanita-phalloides': dict(
  clave='Desentierra la base del pie: volva en saco + láminas blancas + anillo = no se toca.',
  mirar=[q('volva','Volva en saco','Bolsa membranosa en la base. Hay que desenterrar la seta entera, no cortarla por el suelo.'),
         q('himenio','Láminas blancas','Siempre blancas, libres y apretadas, también en ejemplares viejos.'),
         q('anillo','Anillo colgante','Falda floja, algo por debajo del sombrero.'),
         q('sombrero','Sombrero verde-oliva','Verde pálido, oliváceo, amarillento o bronce (existe una forma blanca). Más claro hacia el borde; viscoso con humedad.'),
         q('pie','Pie blanco con escamas','Blanco con motas gris-oliva. Cuidado: la cutícula se pela con facilidad, y eso NO prueba que sea comestible.'),
         q('habitat','Bajo frondosas','Sobre todo bajo robles; también hayas, castaños y avellanos.')],
  wp=['Amanita phalloides'], inat=[52135], mensual=[0,0,0,0,0,0,2,5,13,39,9,3], n=71, texto=dict(meses=[], nota=None)),
'amanita-verna-virosa': dict(
  clave='Seta TODA blanca (sombrero, láminas, pie) con anillo y volva en saco: déjala.',
  mirar=[q('sombrero','Todo blanco','Sombrero, láminas y pie blancos. A. virosa suele tener un mamelón y puede conservar restos del velo.'),
         q('volva','Volva en saco grande','Bolsa membranosa en la base: desentierra el pie.'),
         q('anillo','Anillo membranoso','Colgante y estriado.'),
         q('olor','Olor','En A. virosa se describe un olor que recuerda al rábano.'),
         q('habitat','Época distinta','A. verna sale en primavera; A. virosa a finales de verano y otoño.')],
  wp=['Amanita verna','Amanita virosa'], inat=[58684,58685], mensual=[0,0,0,0,1,0,1,1,0,0,0,0], n=3, texto=dict(meses=[3,4,5,8,9,10,11], nota='A. verna: primavera. A. virosa: finales de verano y otoño.')),
'lepiota-brunneoincarnata': dict(
  clave='Seta pequeña con escamas pardas en el césped: no la mezcles con parasoles ni senderuelas.',
  mirar=[q('sombrero','Pequeña y escamosa','2,7–4 cm. Rojo-pardo de joven, luego rosa-pardo con escamas oscuras y una gran escama central sin romper.'),
         q('himenio','Láminas blancas','Gruesas, poco apretadas y libres; entre ellas, láminas cortas.'),
         q('pie','Pie con zona oscura','Corto (2–3,5 cm). Rosado-ocre arriba y cubierto de escamas pardas abajo, separado por una zona anular oscura.'),
         q('carne','Carne que enrojece','Enrojece al cortarla o golpearla. Olor suave a fruta poco madura.'),
         q('habitat','Césped, parques y jardines','Aparece en prados y jardines, justo donde se recogen setas “de campo”.')],
  wp=['Lepiota brunneoincarnata'], inat=[515954], mensual=[0,0,0,0,0,0,0,0,0,2,1,0], n=3, texto=dict(meses=[], nota=None)),
'galerina-marginata': dict(
  clave='Setas pardas pequeñas en grupos sobre madera: no son “setas de madera” comestibles.',
  mirar=[q('habitat','Sobre madera','Crece sobre madera de coníferas (también de frondosas), a veces enterrada, por lo que parece salir del suelo.'),
         q('habitat','En grupos','Suele salir en matas o grupitos, aunque puede verse sola.'),
         q('sombrero','Sombrero pequeño','1–6 cm. Convexo, con el borde curvado hacia las láminas; luego aplanado y a veces con mamelón.'),
         q('otro','Confusión peligrosa','Se confunde con setas de madera comestibles (ver «Se confunde con»).')],
  wp=['Galerina marginata'], inat=[154735], mensual=[0,0,1,0,0,0,0,0,0,3,10,1], n=15, texto=dict(meses=[6,7,8,9,10,11], nota='Verano a otoño.')),
'cortinarius-orellanus': dict(
  clave='Cortinarios pardo-anaranjados con láminas color óxido: se confunden con rebozuelos. No tocar.',
  mirar=[q('sombrero','Naranja-pardo','3–6 cm, aplanado o algo hundido, con fibrillas o escamitas finas.'),
         q('himenio','Láminas ocre → óxido','Gruesas, ocre claro que se van volviendo pardo-óxido al madurar las esporas.'),
         q('pie','Pie con restos de cortina','4–9 cm, de color parecido al sombrero, amarillento arriba, con restos de velo amarillo pálido.'),
         q('carne','Carne ocre y olor a rábano','Carne firme ocre pálida; olor ligero a rábano.'),
         q('habitat','Bosque caducifolio','Bajo haya, carpe y roble.')],
  wp=['Cortinarius orellanus','Cortinarius rubellus'], inat=[337849], mensual=[0,0,0,0,0,0,0,0,0,1,1,0], n=2, texto=dict(meses=[], nota=None)),
'gyromitra': dict(
  clave='Cabeza “de cerebro” con pliegues, no en panal. Si dudas entre colmenilla y Gyromitra, no la cojas.',
  mirar=[q('sombrero','Forma de cerebro','Irregular, arrugada y plegada (hasta ~12 cm), no con huecos tipo esponja.'),
         q('sombrero','Color pardo-rojizo','Pardo, a veces rojizo, castaño o púrpura; se oscurece con la edad.'),
         q('pie','Pie corto y grueso','3–6 cm de alto, unido al “cerebro” por varios puntos.'),
         q('olor','Olor agradable','Puede oler a fruta y ser de sabor suave: no es indicio de seguridad.'),
         q('habitat','Suelos arenosos bajo coníferas','En primavera y comienzos de verano.')],
  wp=['Gyromitra esculenta'], inat=[85118], mensual=[0,0,0,2,3,0,0,0,0,0,0,0], n=5, texto=dict(meses=[3,4,5,6], nota='Primavera y principios de verano.')),
'entoloma-lividum-sinuatum': dict(
  clave='Seta blancuzca y grande de láminas separadas amarillentas→rosadas: causa muy frecuente de intoxicaciones.',
  mirar=[q('sombrero','Grande y claro','6–20 cm. Marfil a gris-pardo claro, borde ondulado, mamelón romo; se oscurece con la edad.'),
         q('himenio','Láminas separadas','Escotadas hacia el pie y amarillentas que pasan a rosa y luego rojizo. Vistas desde abajo, forman un “foso” alrededor del pie.'),
         q('olor','Olor rancio','Se describe un olor rancio (la perretxiko huele a harina o pepino).'),
         q('habitat','Frondosas y suelos calizos','Finales de verano y otoño, a veces en corros.')],
  wp=['Entoloma sinuatum'], inat=[510199], mensual=[0,0,0,0,0,0,0,1,3,10,3,0], n=17, texto=dict(meses=[8,9,10,11], nota='Finales de verano y otoño.')),
'omphalotus-illudens': dict(
  clave='Naranja intenso en mata sobre tocón o raíz, láminas finas y afiladas: no es un rebozuelo.',
  mirar=[q('sombrero','Naranja vivo','Hasta 15 cm. Carne anaranjada por dentro; no cambia de color al cortar.'),
         q('himenio','Láminas finas y afiladas','Decurrentes, como de papel y flexibles (el rebozuelo tiene pliegues romos).'),
         q('habitat','Mata sobre madera','Crece en grupos apretados sobre tocones o raíces enterradas, no suelto en el suelo.'),
         q('otro','Brilla en la oscuridad','Las láminas frescas pueden emitir un brillo verdoso muy tenue (hay que adaptar la vista a la oscuridad).')],
  wp=['Omphalotus illudens','Omphalotus olearius'], inat=[64021,126831], mensual=[0,0,0,0,0,0,4,9,3,1,0,0], n=17, texto=dict(meses=[7,8,9,10], nota='O. olearius, sur de Europa: julio–octubre.'),
  nota='Nomenclatura: en Europa la especie equivalente es Omphalotus olearius; O. illudens es norteamericana. Las fotos indican cuál es cada una.'),
'tricholoma-pardinum': dict(
  clave='Tricholoma gris, grande y escamoso: no recojas ningún Tricholoma gris sin experto.',
  mirar=[q('sombrero','Gris plateado con escamas','5–15 cm. Gris con escamas concéntricas gris-pardo oscuras, más claras hacia el borde.'),
         q('himenio','Láminas blancas gruesas','Blancas, a veces con tinte amarillo o verdoso; pueden gotear agua.'),
         q('habitat','Haya y abeto','Suelo calcáreo, a menudo con algo de altura; suele salir solo o en pocos ejemplares.'),
         q('otro','Robusta y de buen aspecto','Seta grande y carnosa, de olor y sabor agradables: justo lo que la hace peligrosa.')],
  wp=['Tricholoma pardinum'], inat=[335206], mensual=[0]*12, n=0, texto=dict(meses=[6,7,8,9,10,11], nota='Verano y otoño.')),
'amanita-pantherina-muscaria': dict(
  clave='Sombrero con verrugas blancas desprendibles + anillo + volva en la base: tóxica. No es la oronja.',
  mirar=[q('sombrero','Verrugas blancas','A. pantherina: pardo con verrugas blancas desprendibles. A. muscaria: rojo con verrugas blancas o amarillentas.'),
         q('himenio','Láminas blancas','Libres, apretadas, blancas que pueden grisear.'),
         q('anillo','Anillo y volva','Anillo en el pie y base con restos de volva (desentierra el pie).'),
         q('carne','Carne blanca','Blanca, no cambia al cortar. En ejemplares jóvenes de A. muscaria, bajo el velo se ve una capa amarillenta.'),
         q('habitat','Frondosas y coníferas','Sobre todo haya; a finales de verano y otoño.')],
  wp=['Amanita pantherina','Amanita muscaria'], inat=[48418,48715], mensual=[0,0,0,1,0,2,2,1,23,184,79,19], n=311, texto=dict(meses=[6,7,8,9,10,11], nota='A. pantherina: finales de verano y otoño. A. muscaria: verano y otoño.')),
'paxillus-involutus': dict(
  clave='Seta parda en embudo con borde muy enrollado y láminas que se despegan: no la comas aunque “se comía antes”.',
  mirar=[q('sombrero','Embudo de borde enrollado','4–12 cm, pardo (rojizo, amarillento u oliva), con el margen muy enrollado; aterciopelado de joven y pegajoso con humedad.'),
         q('himenio','Láminas decurrentes','Amarillo-pardas, bifurcadas y que se pelan con facilidad de la carne, como los poros de un boleto.'),
         q('otro','Sin látex','Un Lactarius suelta leche al romperlo; Paxillus no.'),
         q('habitat','Aparece en otoño','En la costa cantábrica se ve sobre todo de septiembre a noviembre (iNaturalist).')],
  wp=['Paxillus involutus'], inat=[55941], mensual=[0,0,0,1,0,0,0,0,3,10,3,1], n=18, texto=dict(meses=[], nota=None)),
'boletus-satanas': dict(
  clave='Boleto enorme, pálido, con poros rojos y carne que azulea fuerte: no coger.',
  mirar=[q('sombrero','Grande y pálido','Hasta 30 cm. Blanco-grisáceo a plateado, con tintes oliváceos o pardos al envejecer; la piel no se separa de la carne.'),
         q('himenio','Poros rojos','Los tubos son amarillo-verdosos y azulean al cortar; los poros pasan de amarillo-naranja a rojo.'),
         q('pie','Pie con retículo','Grueso y con red; en esta especie la carne azulea intensamente.'),
         q('habitat','Bosque cálido y suelo calizo','Bajo roble y castaño, en verano y principios de otoño.')],
  wp=['Rubroboletus satanas'], inat=[544554], mensual=[0,0,0,0,0,0,3,4,8,5,0,0], n=20, texto=dict(meses=[6,7,8,9,10], nota='Verano y principios de otoño.')),
'coprinopsis-atramentaria': dict(
  clave='Setas grises que se licúan en tinta negra. Con alcohol dan una reacción tóxica.',
  mirar=[q('sombrero','Gris, surcado','3–10 cm, gris-pardusco, acampanado y con surcos; se rasga por el borde y se deshace de fuera adentro.'),
         q('himenio','Láminas que ennegrecen','Muy apretadas, blancas → grises o rosadas → negras, y se licúan.'),
         q('pie','Pie gris, sin anillo','5–17 cm, delgado y sin anillo.'),
         q('esporada','Esporada negra','La tinta que suelta al deshacerse es negra.'),
         q('habitat','Madera enterrada','Prados, bordes, suelos removidos; de finales de primavera a otoño.')],
  wp=['Coprinopsis atramentaria'], inat=[48521], mensual=[1,0,0,0,2,0,0,0,1,2,1,1], n=8, texto=dict(meses=[5,6,7,8,9,10,11], nota='Finales de primavera a otoño.')),
'tricholoma-equestre': dict(
  clave='Tricholoma amarillo. Antes se vendía como comestible; este catálogo la trata como tóxica. No la recojas.',
  mirar=[q('sombrero','Amarillo con centro pardo','5–15 cm, amarillo con zonas pardas en el centro; cutícula viscosa que se pela.'),
         q('himenio','Láminas amarillas','Amarillas; esporada blanca.'),
         q('pie','Pie amarillo','4–10 cm, amarillo, pardo en la base.'),
         q('otro','Parecidos','Se parece a otros Tricholoma amarillos: no es fácil de separar.')],
  wp=['Tricholoma equestre'], inat=[118215], mensual=[0,0,0,0,0,0,0,0,0,1,2,1], n=4, texto=dict(meses=[], nota=None)),
'clitocybe-rivulosa': dict(
  clave='Setas blancas pequeñas en corros de hierba: no son senderuelas. Láminas apretadas y bajan por el pie.',
  mirar=[q('sombrero','Blanquecina, en embudo','2–4 cm, aplanada o hundida; blanca con matices crema o rosados.'),
         q('himenio','Láminas apretadas y decurrentes','Blancas (con motas rosadas en C. rivulosa) y bajan por el pie. La senderuela las tiene separadas.'),
         q('pie','Pie fibroso sin anillo','2–4 cm; sin anillo.'),
         q('olor','Sin olor marcado','No hay olor ni sabor característicos: no ayuda a identificarla.'),
         q('habitat','Prados y corros','Hierba, a veces en corros de hadas, en verano y otoño. Mucho cuidado: salen donde también sale la senderuela.')],
  wp=['Clitocybe rivulosa','Clitocybe dealbata'], inat=[], mensual=[0]*12, n=0, texto=dict(meses=[6,7,8,9,10,11], nota='Verano y otoño.')),
'tylopilus-felleus': dict(
  clave='Boleto con poros que se vuelven rosados y retículo oscuro: amargo, sin valor. No lo mezcles con el hongo.',
  mirar=[q('sombrero','Gris-pardo','Hasta 15 cm. Gris-amarillento a pardo nuez, algo aterciopelado de joven; la piel no se separa.'),
         q('himenio','Poros blancos → rosados','Blancos al principio y rosados con la edad; manchan de carmín o pardo.'),
         q('pie','Retículo oscuro','Con red más oscura que el fondo del pie.'),
         q('otro','Sabor amargo','Es el rasgo clásico; no se recomienda probarlo para identificarlo.'),
         q('habitat','Verano y otoño','De junio a octubre o noviembre en zonas templadas.')],
  wp=['Tylopilus felleus'], inat=[63489], mensual=[0,0,0,0,0,0,1,0,1,0,0,0], n=2, texto=dict(meses=[6,7,8,9,10,11], nota='Junio–noviembre.')),
'boletus-edulis': dict(
  clave='Poros blancos→amarillo oliváceo, retículo claro en el pie, carne que no azulea. Poros rojos o carne que azulea: no coger.',
  mirar=[q('sombrero','Pardo-rojizo','8–30 cm. Convexo, viscoso con humedad, a menudo con el borde más pálido.'),
         q('himenio','Poros blancos → amarillo oliváceo','Los tubos son finos; ni rosa ni rojo.'),
         q('pie','Pie grueso con retículo claro','8–25 cm, abultado de joven; red fina en la parte alta o en todo el pie.'),
         q('carne','Carne que no cambia','Blanca, sin azulear de forma marcada al cortar.'),
         q('habitat','Verano y otoño','Bajo frondosas y coníferas.')],
  wp=['Boletus edulis'], inat=[48701,333772,335942], mensual=[1,0,1,1,0,2,4,9,26,90,29,5], n=168, texto=dict(meses=[6,7,8,9,10,11], nota='Verano y otoño.')),
'cantharellus-cibarius': dict(
  clave='Pliegues romos que bajan por el pie (no láminas), huele a albaricoque. Si son láminas finas y en mata sobre madera: no.',
  mirar=[q('sombrero','Amarillo-dorado','3–15 cm de ancho; de amarillo a amarillo oscuro; se mancha rojizo al dañarlo.'),
         q('himenio','Pliegues, no láminas','Crestas romas y ramificadas que bajan por el pie, como arrugas.'),
         q('olor','Aroma a albaricoque','Aroma y sabor suaves, afrutados.'),
         q('esporada','Esporada amarillenta','Amarillenta.'),
         q('habitat','Frondosas y coníferas','De junio a diciembre en Europa.')],
  wp=['Cantharellus cibarius'], inat=[47347], mensual=[1,0,0,0,5,6,9,12,18,16,7,1], n=75, texto=dict(meses=[6,7,8,9,10,11,12], nota='De junio a diciembre.')),
'craterellus-cornucopioides': dict(
  clave='Trompeta negra sin láminas, lisa por fuera y hueca hasta el pie.',
  mirar=[q('sombrero','Embudo negro-gris','Hasta 8 cm de ancho y unos 10 de alto; interior negro o gris oscuro.'),
         q('himenio','Cara externa lisa','Gris más claro, lisa o con arrugas que bajan; sin láminas.'),
         q('pie','Pie continuo','El pie y el embudo forman una sola pieza, sin límite marcado.'),
         q('esporada','Esporada crema','El polvo de esporas es crema.')],
  wp=['Craterellus cornucopioides'], inat=[48607], mensual=[0,1,0,0,0,1,0,2,7,29,18,4], n=62, texto=dict(meses=[8,9,10,11], nota='Reino Unido: agosto–noviembre.')),
'hydnum-repandum': dict(
  clave='Bajo el sombrero hay pinchos, no láminas ni pliegues.',
  mirar=[q('sombrero','Naranja-beige','Hasta 17 cm; irregular, margen ondulado y enrollado de joven; seco y liso.'),
         q('himenio','Pinchos','Debajo, en vez de láminas o pliegues, tiene pinchos finos.'),
         q('carne','Carne blanca y firme','Firme y quebradiza; amarillea o se vuelve naranja al tocarla.'),
         q('habitat','Verano a otoño','Fructifica de verano a otoño.')],
  wp=['Hydnum repandum'], inat=[48641], mensual=[3,0,0,0,0,2,4,1,5,13,11,4], n=43, texto=dict(meses=[6,7,8,9,10,11], nota='Verano a otoño.')),
'lactarius-deliciosus': dict(
  clave='Látex naranja que verdea al manejar. Látex blanco, o que azulea o es rojo: otra especie.',
  mirar=[q('sombrero','Naranja zanahoria','3–20 cm; convexo a embudo, a menudo con círculos concéntricos más oscuros.'),
         q('himenio','Láminas decurrentes','Apretadas; junto con la carne se manchan de verde oscuro al manipularlas.'),
         q('carne','Látex naranja-rojizo','Suelta una leche naranja-rojiza que no cambia de color.'),
         q('pie','Pie corto y hueco','Corto, grueso, naranja y a menudo hueco.'),
         q('esporada','Esporada crema','Crema.'),
         q('otro','Es un grupo de especies','La ficha agrupa varias especies parecidas; el color del látex ayuda a separarlas.')],
  wp=['Lactarius deliciosus'], inat=[155197,332501], mensual=[0,1,0,0,0,0,1,0,0,10,17,15], n=44, texto=dict(meses=[9,10,11], nota='Otoño.')),
'macrolepiota-procera': dict(
  clave='Pie largo y escamoso con anillo móvil y sombrero grande con mamelón. Si es pequeña y escamosa en el césped: otra cosa.',
  mirar=[q('sombrero','Grande con mamelón','Hasta 25 cm. Plano al madurar, con mamelón central liso y oscuro y escamas pardas fáciles de quitar.'),
         q('anillo','Anillo móvil','Carnoso, se puede deslizar por el pie.'),
         q('pie','Pie largo y escamoso','12–40 cm, delgado, con aspecto escamoso por debajo del anillo.'),
         q('otro','De joven','Cerrada como un huevo o palillo de tambor.'),
         q('himenio','Láminas','Descarta las que tengan tinte verdoso: ahí hay una especie tóxica (Chlorophyllum).')],
  wp=['Macrolepiota procera'], inat=[63401], mensual=[0,0,0,1,3,5,0,4,23,69,32,5], n=142, texto=dict(meses=[7,8,9,10,11], nota='Reino Unido: julio–noviembre.')),
'marasmius-oreades': dict(
  clave='Pie tenaz, láminas separadas y mamelón. Láminas apretadas y que bajan por el pie: otra especie.',
  mirar=[q('sombrero','Pequeña con mamelón','1–5 cm. Campaniforme a convexa, con una pequeña protuberancia central; cambia de color al secarse.'),
         q('himenio','Láminas separadas','Gruesas, blancas o crema, bastante espaciadas.'),
         q('pie','Pie delgado y duro','2–6 cm, liso y tenaz.'),
         q('olor','Aroma almendrado','Se describe un olor tipo cianuro/almendra.'),
         q('habitat','Céspedes y corros','Prados y corros de hadas; de mayo a noviembre.')],
  wp=['Marasmius oreades'], inat=[118240], mensual=[0,0,1,6,9,2,1,2,3,9,9,2], n=44, texto=dict(meses=[5,6,7,8,9,10,11], nota='Reino Unido: mayo–noviembre; todo el año en climas cálidos.')),
'calocybe-gambosa': dict(
  clave='Primavera (San Jorge), olor a harina, láminas apretadas. Si huele a fruta fuerte, enrojece o huele rancio: otra.',
  mirar=[q('sombrero','Blanco-crema','5–15 cm; liso, con relieves; blanco a crema.'),
         q('himenio','Láminas apretadas','Blancas y escotadas.'),
         q('pie','Pie grueso y abultado','Rechoncho y más ancho en la base.'),
         q('olor','Olor a harina o pepino','Carne densa y blanda.'),
         q('habitat','Primavera','En torno al 23 de abril en Reino Unido; en mayo en Alemania.')],
  wp=['Calocybe gambosa'], inat=[450829], mensual=[0,0,0,7,8,1,1,0,0,0,0,1], n=18, texto=dict(meses=[4,5], nota='Abril–mayo.')),
'morchella': dict(
  clave='Cabeza en panal con huecos, no cerebro plegado. Hueca por dentro de arriba abajo.',
  mirar=[q('sombrero','Panal de huecos','Color crema-amarillo a pardo; los bordes de las crestas más claros que el fondo de los huecos.'),
         q('sombrero','Cabeza hueca','Está unida al pie por el borde inferior, y por dentro está hueca.'),
         q('pie','Pie blanquecino hueco','Blanco o amarillo pálido, granuloso y hueco.'),
         q('carne','Carne quebradiza','Frágil.'),
         q('habitat','Primavera','Bajo frondosas y coníferas, huertos viejos y terrenos removidos.')],
  wp=['Morchella esculenta'], inat=[56830], mensual=[0,0,1,16,6,0,0,0,0,0,0,0], n=23, texto=dict(meses=[3,4,5], nota='Primavera.')),
}


def main():
    d = json.load(open(RUTA))
    F = fotos.por_ficha()
    ids = {e['id'] for e in d['especies']}
    faltan = ids - set(D)
    assert not faltan, faltan
    for e in d['especies']:
        x = D[e['id']]
        e['fotos'] = F[e['id']]
        e['clave'] = x['clave']
        e['queMirar'] = x['mirar']
        if x.get('nota'): e['notaNomenclatura'] = x['nota']
        e.pop('fenologia', None)
        e['temporada'] = {
            'inat': {'n': x['n'], 'mensual': x['mensual'], 'zona': ZONA, 'consulta': HOY,
                     'url': ('https://www.inaturalist.org/observations?' + INAT_BOX + '&taxon_id=' + ','.join(map(str, x['inat']))) if x['inat'] else None},
            'texto': {'meses': x['texto']['meses'], 'nota': x['texto']['nota'], 'fuente': 'Wikipedia (inglés)'},
        }
        fu = [f for f in e['fuentes'] if not f['nombre'].startswith(('Wikipedia', 'iNaturalist', 'Wikimedia Commons'))]
        for t in x['wp']:
            fu.append({'nombre': 'Wikipedia (inglés): ' + t, 'url': WP(t), 'fechaConsulta': HOY,
                       'campos': ['queMirar', 'temporada'], 'nota': 'Fuente terciaria. Sirve para los rasgos de reconocimiento; no sustituye una guía micológica.'})
        if x['n'] > 0:
            fu.append({'nombre': 'iNaturalist: observaciones de grado de investigación en la costa cantábrica', 'url': e['temporada']['inat']['url'], 'fechaConsulta': HOY,
                       'campos': ['temporada'], 'nota': 'Cuenta de observaciones por mes (N=%d). Muestra cuándo se ve la especie, no cuándo es segura.' % x['n']})
        fu.append({'nombre': 'Wikimedia Commons (fotos)', 'url': 'https://commons.wikimedia.org/', 'fechaConsulta': HOY, 'campos': ['fotos'],
                   'nota': 'Autoría y licencia en cada foto. Las fotos son orientativas y no confirman una identificación.'})
        e['fuentes'] = fu
    d['version'] = 2
    d['generado'] = HOY
    json.dump(d, open(RUTA, 'w'), ensure_ascii=False, indent=1)
    print('ok', len(d['especies']), 'fichas;', sum(len(e['fotos']) for e in d['especies']), 'fotos')

if __name__ == '__main__':
    main()
