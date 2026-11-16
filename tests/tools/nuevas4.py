#!/usr/bin/env python3
"""Ampliación 4 (16-nov-2026): 30 especies comunes y poco comunes de pinares, robledales y madera de la costa cantábrica.
Cuentas, temporada y fotos: iNaturalist (observaciones de grado de investigación, fotos CC0 / CC BY / CC BY-SA). Texto: Wikipedia + conocimiento micológico general,
siempre como «borrador» (nivelVerificacion) sin revisión experta. Datos de entrada en DATOS (JSON generado con la API de iNaturalist).
Uso: python3 tests/tools/nuevas4.py <datos.json>"""
import json, sys, urllib.parse, os
RUTA = os.path.join(os.path.dirname(__file__), '..', '..', 'docs', 'data', 'especies.json'); HOY = '2026-11-16'
DATOS = json.load(open(sys.argv[1]))
BOX = 'nelat=43.7&nelng=-1.0&swlat=42.6&swlng=-5.5&quality_grade=research'
ZONA = 'Costa cantábrica (42,6–43,7 N · 5,5–1,0 O: Bizkaia, Gipuzkoa, Cantabria, este de Asturias y norte de Burgos, Araba y Navarra)'
LIC = {'cc0': ('CC0', 'https://creativecommons.org/publicdomain/zero/1.0/'), 'cc-by': ('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'), 'cc-by-sa': ('CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/')}
q = lambda p, t, d: {"parte": p, "titulo": t, "texto": d}
conf = lambda i, n, c, g: {"id": i, "nombre": n, "comoDistinguir": c, "gravedad": g}
com = lambda nivel, txt: {"nivel": nivel, "txt": txt, "segun": "Wikipedia (inglés): fuente terciaria, sin revisión experta"}
def corte(n): return 'comun' if n >= 90 else 'poco' if n >= 30 else 'raro' if n >= 8 else 'legendario'
POR = {'comun': 'Mucha gente la encuentra en la costa cantábrica: es de las que más se ven.', 'poco': 'Se ve con regularidad si vas a su sitio y en su época.'}

def foto(sci, p):
    l, u = LIC[p['lic']]
    return {"sp": sci, "url": p['url'].replace('/{s}.', '/{s}.'), "autor": p['autor'], "licencia": l, "licenciaUrl": u, "pagina": "https://www.inaturalist.org/observations/%d" % p['obs'], "origen": "iNaturalist", "ar": round(p['ar'], 4)}

N = []
def sp(id, sci, clase, grupo, familia, wp, es=(), eu=None, eunom=None, sin=(), com_=None, nota='', clave='', mirar=(), confs=(), temp=None, tempnota='', habitats=(), htxt='', cur=(), rz=None, **k):
    D = DATOS[sci]; m = D['m']
    f = [{"nombre": "Wikipedia (inglés): " + wp, "url": "https://en.wikipedia.org/wiki/" + urllib.parse.quote(wp.replace(' ', '_')), "fechaConsulta": HOY, "campos": ["clase", "rasgos", "confusiones", "habitat"], "nota": "Fuente terciaria. Sin revisión experta ni segunda fuente."}]
    if eu: f.append({"nombre": "Wikipedia (euskera): " + eunom, "url": "https://eu.wikipedia.org/wiki/" + urllib.parse.quote(eunom.replace(' ', '_')), "fechaConsulta": HOY, "campos": ["nombres"], "nota": "Nombre en euskera tomado del título del artículo de Wikipedia en euskera."})
    f.append({"nombre": "iNaturalist — observaciones de grado investigación, costa cantábrica", "url": "https://www.inaturalist.org/observations?" + BOX + "&taxon_name=" + urllib.parse.quote(sci), "fechaConsulta": HOY, "campos": ["temporada", "rareza"], "nota": "Recuento por meses de observaciones verificadas por la comunidad."})
    e = {"id": id, "nombreCientifico": sci, "sinonimos": list(sin), "nombresComunes": {"es": list(es), "eu": [eu] if eu else []}, "clase": clase, "grupo": grupo, "familia": familia,
         "nivelVerificacion": "borrador", "ampliacion": HOY, "fuentes": f, "fotos": [foto(sci, p) for p in D['sel']], "curiosidades": list(cur)}
    e['temporada'] = {"inat": {"n": sum(m), "mensual": m, "zona": ZONA, "consulta": HOY, "url": "https://www.inaturalist.org/observations?" + BOX + "&taxon_name=" + urllib.parse.quote(sci)}}
    tox = clase in ('mortal', 'toxica')
    e['recoleccion'] = {'acc': 'dejar', 'txt': 'No se recoge: es ' + ('mortal' if clase == 'mortal' else 'tóxica') + '. Fotografíala en su sitio y déjala.'} if tox else \
        ({'acc': 'dejar', 'txt': 'No se recoge: no se considera comestible. Fotografíala en su sitio y déjala.'} if clase == 'no_comestible' else
         {'acc': 'extraer', 'txt': 'La primera vez, sácala entera con la base del pie para estudiarla y tapa el hueco con tierra. Que la confirme una persona experta.'})
    if clase == 'sin_datos': e['candidataComestible'] = True
    if com_: e['comestibilidad'] = com_
    e.update(notaComestibilidad=nota, clave=clave, queMirar=[q(*x) for x in mirar], confusiones=[conf(*x) for x in confs], habitats=list(habitats), habitatTexto=htxt)
    r = corte(D['cant']); rn = POR.get(r, '')
    if rz: r, rn = rz
    e['rareza'] = r; e['rarezaNota'] = rn
    e['rarezaDatos'] = {"cantabrico": D['cant'], "bizkaia": D['biz'], "espana": D['esp'], "europa": D['eu'], "fuente": "iNaturalist", "consulta": HOY}
    e.update(k); N.append(e)

# ---------------- pinares y suelo ----------------
sp("suillus-bovinus", "Suillus bovinus", "sin_datos", "boleto", "Suillaceae", "Suillus bovinus", es=["boleto bovino"], eu="pinudietako behi-onddo", eunom="Pinudietako behi-onddo",
   com_=com("si", "Según Wikipedia es comestible, pero poco apreciada."), nota="Comestible poco apreciada (Wikipedia).",
   clave="Boleto de pinar con poros amarillos grandes y angulosos, pie fino SIN anillo y sombrero pegajoso ocre; sale en grupos bajo pinos.",
   mirar=[("sombrero", "Ocre, viscoso", "Hasta 10 cm, convexo y luego plano, gris-amarillento a ocre, pegajoso con humedad."), ("himenio", "Poros grandes y angulosos", "Amarillo-ocre, bajan un poco por el pie."), ("pie", "Fino y sin anillo", "Más delgado que otros Suillus, sin anillo."), ("habitat", "Bajo pinos", "Micorriza con pinos; sale en grupos, a menudo muchos juntos.")],
   confs=[("suillus-luteus", "Boleto anillado (Suillus luteus)", "S. luteus tiene anillo y sombrero chocolate; el bovino carece de anillo y es ocre.", "baja"), ("suillus-granulatus", "Boleto granulado (Suillus granulatus)", "S. granulatus tiene poros más pequeños con gotitas lechosas y pie granulado; el bovino, poros grandes angulosos y pie liso.", "baja")],
   temp=[6, 7, 8, 9, 10, 11, 12], tempnota="Verano y otoño en Europa (iNaturalist cantábrico: sobre todo octubre y noviembre).", habitats=["pinar", "coniferas"], htxt="Bajo pinos, en pinares naturales y de repoblación; ligada a los pinos vivos.",
   cur=["Su pariente Gomphidius roseus vive como parásito sobre ella."], rz=("poco", "Se ve con regularidad en los pinares si vas a su sitio y en su época; en Bizkaia hay mucho pino de repoblación."))
sp("russula-sanguinea", "Russula sanguinea", "no_comestible", "laminar", "Russulaceae", "Russula sanguinaria", es=["rúsula sanguinaria"], eu="pinudi-gibelgorri", eunom="Pinudi-gibelgorri", sin=["Russula sanguinaria"],
   nota="Según Wikipedia no es comestible: la carne es picante y a veces amarga.", clave="Rúsula roja intensa bajo pinos, con pie con tinte rosado y láminas crema que se ramifican; carne picante.",
   mirar=[("sombrero", "Rojo sangre", "Hasta 10 cm, rojo vivo o rosado, algo más pálido con la edad; la cutícula solo se pela en el borde."), ("pie", "Rosado, estriado", "Robusto, con el color del sombrero y estrías longitudinales; se vuelve gris-rosado con la edad."), ("himenio", "Láminas crema", "Estrechas, ramificadas, crema a ocre pálido."), ("carne", "Picante", "Carne blanca, algo picante y a veces amarga."), ("habitat", "Bajo pinos", "Suelos arenosos en pinares.")],
   confs=[("russula-emetica", "Rúsula emética (Russula emetica)", "R. emetica casi nunca tiene el pie coloreado y es muy quebradiza; R. sanguinea suele tener el pie rosado y vive en pinar seco.", "media")],
   temp=[6, 7, 8, 9, 10, 11], tempnota="Verano y otoño.", habitats=["pinar", "coniferas"], htxt="En pinares sobre suelos arenosos, asociada a pinos.", cur=["Lleva en su nombre la sangre: «sanguinea» viene del latín sanguis."],
   rz=("poco", "Es de las rúsulas rojas típicas del pinar."))
sp("amanita-excelsa", "Amanita excelsa", "toxica", "laminar", "Amanitaceae", "Amanita excelsa", sin=["Amanita spissa"], eu="amanita excelsa", eunom="Amanita excelsa",
   nota="Según Wikipedia la variedad spissa se considera comestible, pero se confunde con la amanita panterina, muy tóxica; se trata como tóxica.",
   clave="Amanita gris-parda con restos de velo gris en el sombrero y base de pie bulbosa con la volva pegada; anillo estriado en el pie. Se parece a la panterina: no se recoge.",
   mirar=[("sombrero", "Gris-pardo con restos", "8–12 cm, gris a pardo, con restos del velo gris que se quitan con la lluvia; algo viscoso."), ("himenio", "Láminas blancas", "Blancas a crema, libres y apretadas."), ("anillo", "Anillo estriado", "Ancho, con estrías por encima."), ("volva", "Base bulbosa", "Bulbo con la volva soldada, que se ve como anillos o escamas, no como saco suelto."), ("olor", "Olor a rábano", "Desagradable.")],
   confs=[("amanita-pantherina-muscaria", "Amanita panterina (Amanita pantherina)", "La panterina tiene el sombrero pardo con verrugas blancas, anillo liso y borde de la base con un reborde (rodete); la excelsa, restos grises, anillo estriado y olor a rábano.", "alta"), ("amanita-rubescens", "Oronja vinosa (Amanita rubescens)", "A. rubescens enrojece al cortarla o al comerla los bichos; A. excelsa no enrojece.", "media")],
   temp=[4, 5, 6, 7, 8, 9, 10, 11], tempnota="De primavera a otoño (iNaturalist cantábrico: mayo–octubre).", habitats=["frondosas", "mixto", "robledal"], htxt="En bosques de frondosas, solitaria o en grupos; también en pinares mixtos.", cur=["Las dos «variedades» (spissa y excelsa) se tratan a veces como la misma especie."],
   rz=("poco", "Se ve en robledales y pinares mixtos a buen ritmo de mayo a octubre."))
sp("clitopilus-prunulus", "Clitopilus prunulus", "sin_datos", "laminar", "Entolomataceae", "Clitopilus prunulus", es=["molinera"], eu="errotari", eunom="Errotari",
   com_=com("cond", "Según Wikipedia es comestible, pero se confunde con especies blancas tóxicas del césped (Clitocybe)."), nota="Comestible, pero con confusión con Clitocybe tóxicas (Wikipedia).",
   clave="Seta blanca-grisácea, sombrero como gamuza, láminas que bajan por el pie y rosadas con la edad; esporada ROSA y olor a harina. Si no huele a harina, no es.",
   mirar=[("sombrero", "Gamuza blanquecina", "2–10 cm, blanco a gris, suave como piel de gamuza, con el borde enrollado."), ("himenio", "Láminas bajando por el pie", "Blancas, se tiñen de rosa con la edad."), ("olor", "Olor a harina o pepino", "Harina fresca o pepino al estrujarla."), ("esporada", "Esporada rosa", "Deja polvo rosado: diferencia clave con las blancas.")],
   confs=[("clitocybe-rivulosa", "Clitocybe de césped (C. rivulosa y otras blancas)", "Los Clitocybe blancos tienen esporada BLANCA, olor no harinoso y contienen muscarina: tóxicos. La molinera tiene esporada rosa y olor a harina.", "alta"), ("amanita-phalloides", "Amanitas blancas", "Las amanitas mortales tienen anillo y volva y esporada blanca; la molinera no.", "alta")],
   temp=[7, 8, 9, 10, 11], tempnota="Otoño (iNaturalist cantábrico: agosto–noviembre).", habitats=["prado", "claro", "mixto"], htxt="En céspedes y claros de bosques de frondosas y coníferas, solitaria o en grupos, tras las lluvias de otoño.",
   cur=["Su nombre viene de su olor: «molinera» y «sweetbread» (miller) por el olor a harina."], rz=("poco", "En prados y claros del norte aparece con regularidad en otoño."))
sp("laccaria-laccata", "Laccaria laccata", "sin_datos", "laminar", "Hydnangiaceae", "Laccaria laccata", eu="lakaria arrunt", eunom="Lakaria arrunt",
   com_=com("si", "Según Wikipedia el sombrero es comestible y de sabor suave, aunque es pequeña y sosa."), nota="Comestible sosa, de poco interés (Wikipedia).",
   clave="Pequeña seta rojiza o anaranjada con láminas gruesas y separadas del mismo color y pie fibroso; pierde el color al secarse.",
   mirar=[("sombrero", "Anaranjada o rojiza", "2–6 cm, salmón, ladrillo o naranja en húmedo; más pálida al secar."), ("himenio", "Láminas gruesas y separadas", "Del color del sombrero, se blanquean con las esporas."), ("pie", "Fibroso", "2–10 cm, fino y fibroso, del color del sombrero."), ("habitat", "Mala hierba del bosque", "Muy frecuente en suelos pobres y brezales.")],
   confs=[("laccaria-amethystina", "Hongo violeta (Laccaria amethystina)", "Es la misma forma pero toda violeta; L. laccata, rojiza-naranja.", "baja"), ("hygrophoropsis-aurantiaca", "Falso rebozuelo (Hygrophoropsis aurantiaca)", "El falso rebozuelo tiene láminas finas, apretadas y bifurcadas; Laccaria, gruesas y separadas.", "media")],
   temp=[7, 8, 9, 10, 11], tempnota="Verano y otoño.", habitats=["frondosas", "coniferas", "bosque", "brezal"], htxt="En bosques de frondosas y coníferas y en brezales de suelo pobre, en grupos dispersos.",
   cur=["Su nombre en inglés, «deceiver», es por lo variable que es: puede parecer pálida y sin color o roja."], rz=("comun", "Abundantísima en robledales y pinares, pero pasa desapercibida por pequeña: iNaturalist la infravalora."))
sp("volvopluteus-gloiocephalus", "Volvopluteus gloiocephalus", "no_comestible", "laminar", "Pluteaceae", "Volvopluteus gloiocephalus", sin=["Volvariella gloiocephala"], eu="kosko-ziza lingirdatsu", eunom="Kosko-ziza lingirdatsu",
   nota="No se recoge: parece una Amanita joven con volva y no hay una guía clara que la dé por comestible.", clave="Seta clara y viscosa con VOLVA en saco pero SIN anillo, y láminas que se vuelven ROSAS (esporada rosa). Sale en compost y astillas.",
   mirar=[("volva", "Volva sin anillo", "Saco membranoso en la base. No tiene anillo: es lo que la separa de las Amanita con volva."), ("himenio", "Láminas blancas → rosas", "Libres; con las esporas toman color rosa-carne."), ("sombrero", "Pegajoso", "Blanco-grisáceo a pardo claro, viscoso con humedad."), ("habitat", "Compost y astillas", "Sale en montones de materia orgánica, césped y astillas.")],
   confs=[("amanita-phalloides", "Cicuta verde y amanitas blancas", "Las Amanita mortales tienen anillo, láminas siempre blancas y esporada blanca; Volvopluteus, sin anillo y láminas rosas.", "alta")],
   temp=[9, 10, 11, 12], tempnota="Otoño.", habitats=["prado", "parque", "cuneta"], htxt="En céspedes, compost, astillas y restos orgánicos; no es una seta de bosque.", cur=["Se la confunde fácilmente con Amanita; por eso se desentierra siempre la base de cualquier seta con volva."],
   rz=("poco", "Se ve en jardines y compost en otoño."))
sp("protostropharia-semiglobata", "Protostropharia semiglobata", "toxica", "laminar", "Strophariaceae", "Protostropharia semiglobata", sin=["Stropharia semiglobata"], eu="gorotz-sorgin txiki", eunom="Gorotz-sorgin txiki",
   nota="Según Wikipedia unos autores la dan por comestible y otros por venenosa; crece en excremento y se trata como tóxica.", clave="Seta amarilla de sombrero en semiesfera, pie largo, fino, pegajoso, con anillo; crece sobre excremento de vaca o caballo.",
   mirar=[("sombrero", "Semiesfera amarilla", "1–4 cm, amarillo, liso y viscoso, en forma de media bola."), ("pie", "Largo y viscoso", "Fino, mucho más alto que el sombrero, con anillo tenue."), ("habitat", "Sobre excremento", "En pastos, sobre boñigas de vaca o caballo.")],
   confs=[("stropharia-aeruginosa", "Stropharia aeruginosa", "Es azul-verdosa y de bosque; esta, amarilla y de bosta.", "baja")],
   temp=[4, 5, 6, 7, 8, 10, 11], tempnota="Todo el año con humedad.", habitats=["prado", "claro"], htxt="En prados y pastos con excremento de ganado herbívoro.", cur=["Se ve con facilidad en los pastos de Bizkaia con vacas."],
   rz=("poco", "En pastos con ganado aparece con regularidad."))
sp("clathrus-archeri", "Clathrus archeri", "no_comestible", "faloide", "Phallaceae", "Clathrus archeri", sin=["Anthurus archeri"], es=["dedos del diablo"], eu="izar gorri", eunom="Izar gorri (onddoa)",
   nota="Según Wikipedia hay quien la ha probado joven, pero el olor es repugnante y no se considera comestible.", clave="Brazos rojos que salen de un «huevo» blanco y huelen a carne podrida; moscas por encima. Inconfundible.",
   mirar=[("sombrero", "Brazos rojos", "4–8 brazos rojos unidos al principio por la punta, que se abren como una estrella."), ("olor", "Olor a carne podrida", "Atrae moscas que dispersan las esporas."), ("volva", "Huevo blanco", "Sale de un huevo blanco gelatinoso que queda como una bolsa en la base."), ("habitat", "Suelo con restos", "Prados, bordes de bosque y sitios con humus.")],
   confs=[("clathrus-ruber", "Cesta roja (Clathrus ruber)", "La cesta roja forma una reja cerrada de ramas; Archeri, brazos libres en estrella.", "baja")],
   temp=[4, 5, 6, 7, 8, 9, 10, 11, 12], tempnota="Sobre todo de verano a otoño (iNaturalist cantábrico: abril–diciembre).", habitats=["bosque", "prado", "parque", "frondosas"], htxt="En suelos con humus, bordes de bosque, prados y parques; es una especie venida de Oceanía y ya muy extendida en Bizkaia.",
   cur=["Es una especie venida de Australia y Nueva Zelanda que apareció en Europa hace un siglo."], rz=("comun", "Con ~228 citas en la costa cantábrica, una de las más fotografiadas del norte."))
sp("apioperdon-pyriforme", "Apioperdon pyriforme", "sin_datos", "bola", "Lycoperdaceae", "Apioperdon", sin=["Lycoperdon pyriforme"], es=["bejín de pera"], eu=None,
   com_=com("cond", "Según Wikipedia es un buen comestible mientras la carne interior es blanca y firme; se puede confundir con Scleroderma venenoso."), nota="Comestible solo joven y blanco por dentro; cuidado con Scleroderma (Wikipedia).",
   clave="Bola o pera blanca-parda en grupos SOBRE MADERA podrida, con cordones blancos en la base. Dentro blanca y firme; si hay manchas o láminas, no.",
   mirar=[("habitat", "Sobre madera", "A diferencia de otros bejines, crece sobre madera podrida o enterrada."), ("sombrero", "Pera lisa", "Forma de pera, de piel casi lisa, blanca a parda."), ("carne", "Blanca y firme por dentro", "Debe ser blanca como un malvavisco; si está amarilla, parda o con láminas, no."), ("pie", "Cordones blancos", "Hilos blancos (rizomorfos) en la base.")],
   confs=[("lycoperdon-perlatum", "Bejín (Lycoperdon perlatum)", "L. perlatum sale en el suelo y tiene verrugas cónicas; esta sobre madera y casi lisa.", "baja"), ("scleroderma-citrinum", "Falsa trufa (Scleroderma citrinum)", "Scleroderma es duro y por dentro negro-violeta: venenosa. El bejín de pera es blanco por dentro.", "alta")],
   temp=[1, 2, 3, 5, 6, 7, 9, 10, 11], tempnota="Sobre todo otoño.", habitats=["madera", "frondosas", "bosque"], htxt="En grupos sobre troncos y tocones podridos, a veces enterrados.", cur=["Se ve en grupos tan grandes que cubren un tronco entero."], rz=("poco", "Aparece en otoño en madera podrida."))
sp("coprinopsis-picacea", "Coprinopsis picacea", "toxica", "laminar", "Psathyrellaceae", "Coprinopsis picacea", es=["coprino urraca"], eu="urbeltz zuri-beltz", eunom="Urbeltz zuri-beltz",
   nota="Según Wikipedia es incomestible y causa molestias digestivas.", clave="Tinta con el sombrero negro y MANCHAS BLANCAS (restos del velo) como una urraca; sale en frondosas, sobre todo hayedos.",
   mirar=[("sombrero", "Negro con manchas blancas", "Ovalado, negro-pardo cubierto de restos blancos del velo, como una urraca."), ("himenio", "Láminas que se licuan", "Se vuelven negras y se deshacen en tinta."), ("pie", "Alto y blanco", "Largo, blanco, con base algo bulbosa.")],
   confs=[("coprinus-comatus", "Barbuda (Coprinus comatus)", "Wikipedia avisa de la confusión: la barbuda tiene escamas pardas y es comestible; la picacea es negra y manchada de blanco.", "media")],
   temp=[2, 3, 4, 6, 7, 9, 10, 11, 12], tempnota="Sobre todo otoño (iNaturalist cantábrico: septiembre–noviembre).", habitats=["frondosas", "hayedo", "robledal"], htxt="En suelos ricos, sobre todo de hayedo y bosques calcáreos de frondosas.",
   cur=[], rz=("poco", "En hayedos y robledales húmedos se ve con regularidad en otoño."))
sp("coprinellus-disseminatus", "Coprinellus disseminatus", "no_comestible", "laminar", "Psathyrellaceae", "Coprinellus disseminatus", eu="urbeltz ugari", eunom="Urbeltz ugari",
   nota="Según Wikipedia no es venenosa, pero es diminuta y no interesa.", clave="Cientos de setillas diminutas, gris-blanquecinas y estriadas, en masa sobre tocones de frondosas. No se licuan.",
   mirar=[("habitat", "En masa", "Cientos o miles de ejemplares sobre un mismo tocón o raíz."), ("sombrero", "Diminuto y estriado", "Menos de 2 cm, gris claro y marcadamente acanalado."), ("himenio", "Láminas grises", "No se licuan como otras tintas.")],
   confs=[("coprinellus-micaceus", "Coprino micáceo (Coprinellus micaceus)", "C. micaceus es mayor, de color miel y con granitos brillantes; C. disseminatus, diminuto y en masas enormes.", "baja")],
   temp=[1, 4, 5, 6, 7, 8, 9, 10, 11, 12], tempnota="Todo el año con humedad.", habitats=["madera", "frondosas", "parque"], htxt="Sobre tocones y raíces de frondosas, a veces en parques.", cur=["Se ve en grupos de cientos de ejemplares que parecen una alfombra."],
   rz=("comun", "Aunque iNaturalist la cuenta menos, son tan abundantes sus grupos que es de las que más se ven en tocones de frondosas."))
sp("candolleomyces-candolleanus", "Candolleomyces candolleanus", "no_comestible", "laminar", "Psathyrellaceae", "Candolleomyces candolleanus", sin=["Psathyrella candolleana"], eu=None,
   nota="Según Wikipedia es comestible pero no se recomienda por la poca carne y la dificultad de identificación.", clave="Seta pálida y frágil con restos blancos de velo en el borde del sombrero; láminas que pasan de grises a pardas y pie hueco.",
   mirar=[("sombrero", "Pálido, con restos blancos", "3–7 cm, color crema a ocre claro, con flecos blancos del velo en el borde."), ("himenio", "Láminas grises a pardas", "Apretadas, con esporada pardo-púrpura."), ("pie", "Hueco y frágil", "Blanco, fino, hueco y se parte con facilidad.")],
   confs=[("agaricus-campestris", "Champiñones (Agaricus)", "Agaricus tiene anillo y láminas rosadas a chocolate; Candolleomyces, sin anillo y de carne muy frágil.", "baja")],
   temp=[6, 7, 8, 9, 10, 11], tempnota="De verano a otoño.", habitats=["madera", "frondosas", "prado", "parque"], htxt="Sobre tocones y raíces enterradas de frondosas y en prados y parques.", cur=["Es de las setas «pardas pequeñas» que cuesta identificar con precisión."],
   rz=("poco", "Se ve con regularidad en jardines y bordes de bosque en verano y otoño."))
# ---------------- hojarasca y madera: setas pequeñas y medianas ----------------
sp("cyclocybe-cylindracea", "Cyclocybe cylindracea", "sin_datos", "laminar", "Strophariaceae", "Cyclocybe cylindracea", sin=["Cyclocybe aegerita", "Agrocybe aegerita", "Agrocybe cylindracea"], es=["seta de chopo"], eu="makal-ziza", eunom="Makal-ziza",
   com_=com("cond", "Según Wikipedia es comestible, pero se parece a especies venenosas, y es difícil de identificar."), nota="Comestible pero confundible con tóxicas, incluida alguna mortal (Wikipedia).",
   clave="Mata de setas pardas con anillo sobre troncos de chopo y otras frondosas; láminas crema que se vuelven pardas con las esporas, pie curvado.",
   mirar=[("habitat", "Mata sobre madera", "Crece en matas sobre troncos y tocones de chopo y otras frondosas."), ("sombrero", "Pardo claro", "3–10 cm, convexo casi plano, ocre-pardo, más pálido en el borde."), ("anillo", "Anillo membranoso", "En la parte alta del pie, que se vuelve color tabaco con las esporas."), ("pie", "Curvado y fibroso", "Blanco-fibroso, generalmente curvo.")],
   confs=[("galerina-marginata", "Galerina marginata (mortal)", "También crece en grupos sobre madera y tiene anillo y esporada parda: la confusión mortal. No te fíes de «setas de madera».", "alta"), ("kuehneromyces-mutabilis", "Seta de tocón (Kuehneromyces mutabilis)", "Otra seta de madera con anillo, pero con la cutícula que cambia de color y escamitas en el pie.", "alta")],
   temp=[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], tempnota="Todo el año con humedad.", habitats=["madera", "frondosas", "parque", "arbol_vivo"], htxt="Sobre troncos y tocones de chopo y otras frondosas, también en parques y huertas.",
   cur=["Se cultiva en Asia: en China la llaman «seta del té», y en Japón, «matsutake de sauce»."], rz=("poco", "Se ve en chopos y plataneros en parques y riberas durante todo el año."))
sp("pluteus-cervinus", "Pluteus cervinus", "sin_datos", "laminar", "Pluteaceae", "Pluteus cervinus", eu="pluteo marroi", eunom="Pluteo marroi",
   com_=com("cond", "Según Wikipedia es comestible de poca calidad y sabor soso."), nota="Comestible mediocre (Wikipedia).",
   clave="Seta pardo-ciervo sobre madera, con láminas libres blancas que se vuelven ROSAS y pie blanco con fibras pardas. Sin anillo ni volva.",
   mirar=[("habitat", "Sobre madera", "Crece sobre tocones, troncos caídos y restos de serrín."), ("sombrero", "Pardo-ciervo", "Hasta 12 cm, pardo claro a oscuro, liso y sedoso."), ("himenio", "Láminas libres, blanco→rosa", "Libres del pie: se tiñen de rosa al madurar las esporas."), ("pie", "Blanco con fibras", "Sin anillo ni volva.")],
   confs=[("amanita-phalloides", "Amanita blanca (volva)", "Con láminas blancas y anillo/volva: Pluteus nunca tiene anillo ni volva y sale en madera.", "media"), ("clitocybe-nebularis", "Entolomas (E. lividum)", "Entoloma tiene láminas unidas al pie y esporas angulosas; Pluteus, láminas libres.", "alta")],
   temp=[3, 5, 6, 7, 8, 9, 10, 11], tempnota="En Europa, de abril a diciembre.", habitats=["madera", "frondosas", "hayedo"], htxt="Sobre tocones, troncos caídos y serrín; sobre todo de frondosas.", cur=["Su nombre «cervinus» significa «de ciervo» por el color pardo."],
   rz=("comun", "Muy común sobre tocones y madera podrida, aunque iNaturalist la cuenta poco."))
sp("mycena-galericulata", "Mycena galericulata", "no_comestible", "laminar", "Mycenaceae", "Mycena galericulata", eu="kanpaitxo errotari", eunom="Kanpaitxo errotari",
   nota="Según Wikipedia posiblemente comestible, pero sin interés.", clave="Setilla pardo-grisácea con campana puntiaguda y surcos radiales, pie hueco y tieso; en grupos sobre tocones podridos. Olor a harina.",
   mirar=[("sombrero", "Campana con surcos", "Hasta 4 cm, campana o cono con mamelón, gris-pardo y con surcos radiales."), ("himenio", "Láminas con venas", "Blanco-grisáceas, rosadas con la edad, unidas por venitas transversales."), ("pie", "Largo y hueco", "Fino, duro y que se hunde en la madera podrida.")],
   confs=[("mycena-pura", "Mycena pura (tóxica)", "M. pura huele a rábano y es violeta-rosada; galericulata, parda y huele a harina.", "media")],
   temp=[3, 4, 5, 6, 7, 8, 9, 10, 11, 12], tempnota="De primavera a otoño.", habitats=["madera", "frondosas", "coniferas"], htxt="En grupos sobre tocones muy podridos de frondosas y coníferas.", cur=["Es la especie tipo del género Mycena."],
   rz=("comun", "Muy común en tocones y madera podrida; se registra menos de lo que se ve."))
sp("megacollybia-platyphylla", "Megacollybia platyphylla", "no_comestible", "laminar", "Marasmiaceae", "Megacollybia platyphylla", eu=None,
   nota="No se recoge: se la considera incomestible por su sabor amargo y poca carne.", clave="Seta gris-parda grande, de láminas muy anchas, blancas y separadas, que sale de madera podrida con cordones blancos (rizomorfos).",
   mirar=[("himenio", "Láminas muy anchas", "Blancas, espaciadas, muy anchas (hasta más de 1 cm)."), ("sombrero", "Gris-pardo y fibroso", "5–12 cm, gris a pardo, con fibras radiales."), ("pie", "Cordones blancos", "En la base, hilos blancos (rizomorfos) que se pierden en la madera."), ("habitat", "Madera podrida", "Sobre madera enterrada de frondosas.")],
   confs=[("clitocybe-nebularis", "Pardilla (Clitocybe nebularis)", "La pardilla tiene láminas apretadas y olor fuerte; la Megacollybia, láminas anchas y separadas y crece sobre madera.", "media")],
   temp=[4, 5, 6, 7, 8, 9, 10, 11], tempnota="De primavera a otoño.", habitats=["madera", "frondosas", "hayedo"], htxt="Sobre madera enterrada o podrida de frondosas, sobre todo en hayedos y robledales.", cur=["Sale incluso en primavera, cuando casi no hay setas."],
   rz=("poco", "Se ve en tocones de frondosas casi todo el año salvo invierno."))
sp("oudemansiella-radicata", "Oudemansiella radicata", "sin_datos", "laminar", "Physalacriaceae", "Hymenopellis radicata", sin=["Xerula radicata", "Hymenopellis radicata"], eu="kolibia erroluze", eunom="Kolibia erroluze",
   com_=com("cond", "Según Wikipedia los sombreros se consideran comestibles, de poco interés."), nota="Sombrero comestible de poco interés (Wikipedia).",
   clave="Seta de pie larguísimo que se hunde como una raíz hasta una raíz enterrada; sombrero pardo, viscoso, con mamelón central.",
   mirar=[("pie", "Pie con raíz", "Largo, tieso, con una «raíz» que se hunde hasta 25 cm hasta tocar madera enterrada."), ("sombrero", "Viscoso y arrugado", "2,5–12 cm, pardo-gris a pardo amarillento, con mamelón, viscoso en húmedo."), ("himenio", "Láminas anchas", "Blancas, anchas y espaciadas.")],
   confs=[("laccaria-laccata", "Laccaria y otras pardas", "Ninguna de ellas tiene el pie con raíz profunda: es un rasgo clave que obliga a desenterrar.", "baja")],
   temp=[4, 6, 7, 8, 9, 10, 11], tempnota="Verano y otoño.", habitats=["frondosas", "claro", "bosque"], htxt="En el suelo del bosque, sobre raíces enterradas, sobre todo bajo hayas y frondosas.", cur=["Su «raíz» llega a 25 cm hasta tocar un trozo de madera enterrada."],
   rz=("poco", "Se ve con regularidad en bosques de frondosas de verano a otoño."))
sp("oudemansiella-mucida", "Oudemansiella mucida", "no_comestible", "laminar", "Physalacriaceae", "Oudemansiella mucida", eu="kolibia lingirdatsu", eunom="Kolibia lingirdatsu",
   nota="No se considera de interés culinario: es viscosa y de poca carne.", clave="Seta blanca de porcelana, viscosa, con anillo, en grupos sobre troncos de haya. Inconfundible en hayedos.",
   mirar=[("sombrero", "Blanco y viscoso", "2–8 cm, blanco, translúcido y pegajoso, como porcelana o clara de huevo."), ("anillo", "Anillo", "Anillo blanco membranoso en el pie."), ("habitat", "Sobre haya", "En grupos en haya muerta o ramas altas de haya viva.")],
   confs=[("pleurotus-ostreatus", "Seta de ostra (Pleurotus ostreatus)", "La ostra es lateral, sin anillo y ni viscosa; la mucida tiene anillo y es viscosa.", "baja")],
   temp=[8, 9, 10, 11], tempnota="De finales de verano a finales de otoño.", habitats=["madera", "hayedo", "arbol_vivo"], htxt="En grupos sobre haya muerta y ramas, también altas en hayas vivas; casi exclusiva del haya.", cur=["Se ven setas pequeñas «paracaidistas» cayendo de las ramas altas en días de viento."],
   rz=("comun", "Es de las setas más vistas de los hayedos en octubre."))
sp("mycetinis-alliaceus", "Mycetinis alliaceus", "sin_datos", "laminar", "Marasmiaceae", "Mycetinis alliaceus", sin=["Marasmius alliaceus"], eu="marasmio baratxuri", eunom="Marasmio baratxuri",
   com_=com("cond", "Según Wikipedia es comestible pero de poco valor por su poca carne, usada como condimento."), nota="Comestible de poco valor (Wikipedia).",
   clave="Seta pequeña con olor FUERTE a ajo, pie negro, alto y fino, que crece sobre hojas y ramitas de haya.",
   mirar=[("olor", "Olor a ajo", "Fuerte, se nota a distancia al arrancarla."), ("pie", "Negro y velloso", "Fino, tieso, negro-pardo y con pelillos."), ("sombrero", "Pequeño y gris-pardo", "Hasta 5 cm, gris a pardo, arrugado."), ("habitat", "Sobre hojas de haya", "Crece de hojarasca, ramitas y cúpulas de haya.")],
   confs=[("marasmius-oreades", "Senderuela (Marasmius oreades)", "La senderuela sale en corros en prados y huele a almendra; Mycetinis, en hayedos, huele a ajo y tiene el pie negro.", "baja")],
   temp=[4, 6, 7, 8, 9, 10, 11], tempnota="Verano y otoño.", habitats=["hayedo", "frondosas"], htxt="En hojarasca, ramitas y cúpulas de haya, sobre todo hayedos.", cur=["Se ha usado como condimento por su olor y sabor a ajo."],
   rz=("poco", "Se ve en hayedos desde finales de verano."))
sp("marasmius-rotula", "Marasmius rotula", "no_comestible", "laminar", "Marasmiaceae", "Marasmius rotula", eu="marasmio gurpiltxo", eunom="Marasmio gurpiltxo",
   nota="Según Wikipedia no se considera comestible: es diminuta.", clave="Diminuta con sombrero blanco acanalado como un paraguas o una rueda, láminas unidas a un anillo (collarium) y pie negro como un alambre.",
   mirar=[("sombrero", "Paraguas acanalado", "Menos de 2 cm, blanco, con surcos radiales como las varillas de una rueda."), ("himenio", "Láminas en collar", "Se unen a un anillito (collarium) alrededor del pie: «rueda»."), ("pie", "Negro, como un alambre", "Fino, duro, negro.")],
   confs=[("coprinellus-disseminatus", "Coprinellus disseminatus", "También diminuta y en grupos en madera, pero sus láminas se licuan y no tiene pie negro.", "baja")],
   temp=[5, 6, 7, 8, 9, 10], tempnota="De primavera a otoño.", habitats=["madera", "frondosas", "bosque"], htxt="Sobre ramitas y madera caída de frondosas, en grupos.", cur=["Revive con la lluvia: aunque se seque, vuelve a abrirse al mojarse."],
   rz=("comun", "Frecuente sobre ramitas de frondosas: pequeña y poco anotada, pero se ve mucho."))
# ---------------- yescas y costras de madera ----------------
sp("fomitopsis-pinicola", "Fomitopsis pinicola", "no_comestible", "poliporo", "Fomitopsidaceae", "Fomitopsis pinicola", eu="ardagai ezpaingorri", eunom="Ardagai ezpaingorri",
   nota="Según Wikipedia es incomestible por su textura leñosa; sirve de yesca.", clave="Yesca en forma de pezuña con BANDA ROJA-ANARANJADA en el borde, sobre madera muerta, sobre todo de coníferas.",
   mirar=[("sombrero", "Pezuña con banda roja", "Costra leñosa gris con banda rojo-anaranjada, resinosa, en el borde."), ("himenio", "Poros crema", "Poros pequeños y redondos, crema-amarillos."), ("habitat", "Sobre madera muerta", "Principalmente coníferas, a veces frondosas.")],
   confs=[("fomes-fomentarius", "Yesquero (Fomes fomentarius)", "El yesquero es gris con zonas y cascarón duro, sin banda roja resinosa.", "baja")],
   temp=[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], tempnota="Se ve todo el año.", habitats=["madera", "coniferas", "pinar"], htxt="Sobre madera muerta, sobre todo de coníferas, pero también de frondosas; causa pudrición marrón.", cur=["Sirve de yesca para encender fuego."], rz=("comun", "En Bizkaia, con tantos pinares, es fácil verla en tocones y troncos."))
sp("fomitopsis-betulina", "Fomitopsis betulina", "no_comestible", "poliporo", "Fomitopsidaceae", "Fomitopsis betulina", sin=["Piptoporus betulinus"], es=["poliporo del abedul"], eu="urki-ardagai", eunom="Urki-ardagai",
   nota="Según Wikipedia se considera incomestible, salvo quizá joven.", clave="Yesca blanco-pardusca en forma de riñón o pezuña, lisa y sin banda roja, solo sobre abedul.",
   mirar=[("sombrero", "Riñón liso", "Redondo a reniforme, piel lisa, blanquecina a pardusca."), ("himenio", "Poros blancos", "Poros blancos que se vuelven crema."), ("habitat", "Solo en abedul", "Casi siempre sobre abedul muerto o moribundo.")],
   confs=[("fomes-fomentarius", "Yesquero (Fomes fomentarius)", "El yesquero es más duro, gris con zonas y en forma de pezuña; esta es lisa y clara, solo en abedul.", "baja")],
   temp=[1, 2, 3, 6, 7, 8, 9, 10, 11, 12], tempnota="Todo el año.", habitats=["madera", "abedular", "arbol_vivo"], htxt="Sobre abedul vivo debilitado o muerto.", cur=["Se encontró en el equipaje de Ötzi, el hombre de los hielos."], rz=("poco", "Solo la ves donde hay abedules."))
sp("daedaleopsis-confragosa", "Daedaleopsis confragosa", "no_comestible", "poliporo", "Polyporaceae", "Daedaleopsis confragosa", es=[], eu="ardagai gorrikor", eunom="Ardagai gorrikor",
   nota="No se recoge: es una yesca dura; Wikipedia solo describe un sabor algo amargo.", clave="Yesca semicircular con poros alargados como laberinto, láminas laberínticas que enrojecen al roce. Sobre sauce y otras frondosas.",
   mirar=[("himenio", "Poros laberínticos", "Poros alargados, como láminas, que enrojecen al tocarlos o rascarlos."), ("sombrero", "Semicircular", "Con zonas concéntricas pardo-rojizas."), ("habitat", "Sobre frondosas", "Sobre sauce, abedul y otras frondosas muertas.")],
   confs=[("trametes-versicolor", "Cola de pavo (Trametes versicolor)", "La cola de pavo tiene poros finos y zonas de colores; Daedaleopsis, poros alargados que enrojecen.", "baja")],
   temp=[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], tempnota="Todo el año.", habitats=["madera", "frondosas", "arbol_vivo"], htxt="Sobre madera muerta de sauce, abedul y otras frondosas.", cur=["En inglés se llama «seta del laberinto»."], rz=("comun", "Se ve todo el año sobre troncos de frondosas, sobre todo sauce."))
sp("stereum-hirsutum", "Stereum hirsutum", "no_comestible", "poliporo", "Stereaceae", "Stereum hirsutum", eu="azal hori", eunom="Azal hori",
   nota="Según Wikipedia es incomestible.", clave="Costra de madera con forma de abanicos finos y peludos, naranja-amarillenta con zonas concéntricas y cara inferior lisa.",
   mirar=[("sombrero", "Abanicos peludos", "Pequeños abanicos duros, pelosos y con zonas concéntricas, grises a naranja."), ("himenio", "Cara inferior lisa", "Lisa, amarillo-naranja: sin poros ni láminas."), ("habitat", "Sobre madera", "Troncos y ramas de frondosas, en filas.")],
   confs=[("trametes-versicolor", "Cola de pavo (Trametes versicolor)", "La cola de pavo tiene poros por debajo; Stereum, cara inferior lisa.", "baja")],
   temp=[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], tempnota="Todo el año.", habitats=["madera", "frondosas"], htxt="En troncos y ramas muertas de frondosas.", cur=["Es una de las costras de madera más comunes de Europa."], rz=("comun", "Con ~169 citas en el cantábrico, una de las más comunes."))
sp("trametes-hirsuta", "Trametes hirsuta", "no_comestible", "poliporo", "Polyporaceae", "Trametes hirsuta", eu="larruki ilelatz", eunom="Larruki ilelatz",
   nota="No se recoge: es una yesca dura.", clave="Yesca peluda y gris con zonas, poros muy finos y blancos; borde claro. Sobre frondosas.",
   mirar=[("sombrero", "Peludo y gris", "Con pelos finos como una alfombrilla, gris-blanquecino, con zonas concéntricas."), ("himenio", "Poros blancos finos", "Blanco-grisáceos."), ("habitat", "Sobre frondosas", "Madera muerta de frondosas.")],
   confs=[("trametes-versicolor", "Cola de pavo (Trametes versicolor)", "La cola de pavo es más fina y de colores; T. hirsuta es más gruesa y peluda, gris.", "baja")],
   temp=[2, 3, 4, 5, 6, 7, 8, 9, 10, 11], tempnota="Se ve casi todo el año.", habitats=["madera", "frondosas"], htxt="Sobre troncos y ramas de frondosas.", cur=["Pariente de la cola de pavo."], rz=("comun", "Muy habitual sobre madera de frondosas, aunque iNaturalist la cuente menos."))
sp("schizophyllum-commune", "Schizophyllum commune", "sin_datos", "poliporo", "Schizophyllaceae", "Schizophyllum commune", eu="ardagaitxo", eunom="Ardagaitxo",
   com_=com("cond", "Según Wikipedia es comestible de joven, pero muy coriácea."), nota="Coriácea; comestible solo joven según Wikipedia.",
   clave="Pequeño abanico peludo y blanco-grisáceo con «láminas» que se parten a lo largo; sobre madera muerta, casi todo el año.",
   mirar=[("sombrero", "Abanico peludo", "1–4 cm, blanquecino a gris, con pelos finos."), ("himenio", "Láminas partidas", "Falsas láminas que se parten a lo largo (único en las setas)."), ("habitat", "Sobre madera", "Ramas y troncos, frondosas y coníferas.")],
   confs=[("pleurotus-ostreatus", "Seta de ostra (Pleurotus ostreatus)", "La ostra es grande, carnosa y blanda; Schizophyllum, pequeña, peluda y coriácea.", "baja")],
   temp=[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], tempnota="Todo el año.", habitats=["madera", "frondosas", "coniferas", "parque"], htxt="Sobre madera muerta de casi cualquier árbol.", cur=["Revive con lluvia tras secarse: puede reabrirse durante años."], rz=("comun", "Casi siempre se encuentra algún ejemplar sobre madera."))
sp("xylaria-hypoxylon", "Xylaria hypoxylon", "no_comestible", "ascomiceto", "Xylariaceae", "Xylaria hypoxylon", eu="kimo adarzuri", eunom="Kimo adarzuri",
   nota="Según Wikipedia no es venenosa, pero es diminuta y dura.", clave="Cuernecitos negros con la punta blanca y polvorienta, como una vela apagada o astas de ciervo, sobre madera muerta.",
   mirar=[("sombrero", "Cuernos negros con punta blanca", "3–8 cm, negros, ramificados como astas; la punta blanca está cubierta de esporas."), ("habitat", "Sobre madera", "Sobre tocones de frondosas, a menudo en grupos.")],
   confs=[("calocera-viscosa", "Calocera viscosa", "Calocera es amarilla y gelatinosa; Xylaria, negra y dura.", "baja")],
   temp=[3, 5, 6, 7, 9, 10, 11, 12], tempnota="Todo el año, sobre todo de otoño a invierno.", habitats=["madera", "frondosas", "bosque"], htxt="Sobre tocones y madera muerta de frondosas.", cur=["Se la llama «vela apagada» por su punta blanca."], rz=("comun", "Muy común sobre tocones de frondosas, aunque pequeña y poco fotografiada."))
sp("inonotus-hispidus", "Inonotus hispidus", "no_comestible", "poliporo", "Hymenochaetaceae", "Inonotus hispidus", eu=None,
   nota="No se recoge: es una yesca dura.", clave="Yesca grande, hirsuta, naranja-parda, de joven jugosa; sobre árboles vivos de frondosas, sobre todo fresnos y plataneros.",
   mirar=[("sombrero", "Hirsuto y rojizo", "Grande (hasta 30 cm), peludo, naranja-pardo, de joven con gotas y jugoso."), ("habitat", "Sobre árbol vivo", "Parásito de fresnos, manzanos y plataneros.")],
   confs=[("laetiporus-sulphureus", "Políporo azufrado (Laetiporus sulphureus)", "El azufrado es amarillo-naranja sin pelos; Inonotus es peludo y pardo-rojizo.", "baja")],
   temp=[1, 3, 4, 6, 7, 8, 9, 10, 11], tempnota="Sobre todo verano y otoño.", habitats=["arbol_vivo", "frondosas", "parque"], htxt="Sobre troncos de árboles vivos de frondosas, sobre todo fresnos y manzanos.", cur=["Es un parásito que pudre el tronco."], rz=("poco", "Se ve en fresnos y manzanos, sobre todo del interior."))
sp("favolaschia-claudopus", "Favolaschia claudopus", "no_comestible", "poliporo", "Mycenaceae", "Favolaschia claudopus", eu=None,
   nota="No se recoge: es diminuta y no tiene interés culinario.", clave="Setillas naranjas diminutas con poros en panal pequeñísimos por debajo; sobre ramitas de frondosas. Invasora de Oceanía.",
   mirar=[("sombrero", "Naranja diminuto", "Menos de 3 cm, naranja, en forma de lengüeta o semicírculo."), ("himenio", "Poros en panal", "Alveolos que parecen un panal, blancos a naranja pálido."), ("habitat", "Sobre ramitas", "Ramas y ramitas muertas de frondosas.")],
   confs=[("laetiporus-sulphureus", "Políporo azufrado (Laetiporus sulphureus)", "El azufrado es enorme y amarillo; Favolaschia, diminuta y naranja.", "baja")],
   temp=[1, 4, 5, 6, 7, 8, 9, 10, 11, 12], tempnota="Todo el año, con repunte de otoño.", habitats=["madera", "frondosas", "bosque"], htxt="Sobre ramas y ramitas muertas en bosques húmedos.", cur=["Es de origen oceánico y ya es de las setas más citadas del norte de España."], rz=("comun", "Con ~250 citas en el cantábrico, es de las setas más vistas en ramitas de frondosas."))
sp("chlorociboria-aeruginascens", "Chlorociboria aeruginascens", "no_comestible", "ascomiceto", "Helotiaceae", "Chlorociboria aeruginascens", eu="gardinga", eunom="Gardinga",
   nota="No se recoge: es diminuta; no tiene interés culinario.", clave="Copitas verde-azuladas diminutas (menos de 1 cm) sobre madera podrida teñida de verde-azul. Si ves la madera teñida de verde, es esta.",
   mirar=[("sombrero", "Copitas verde-azul", "Menos de 1 cm, en forma de cuenco y de color verde-azulado."), ("habitat", "Madera teñida", "La madera donde crece (roble) queda teñida de verde."), ("pie", "Pie diminuto", "Un pie muy corto en el centro o al lado.")],
   confs=[("tremella-mesenterica", "Tremella mesenterica", "La Tremella es amarilla y gelatinosa; Chlorociboria, verde-azulada y duramente cerosa.", "baja")],
   temp=[3, 5, 6, 7, 8, 9, 10, 11, 12], tempnota="Sobre todo verano y otoño.", habitats=["madera", "frondosas", "robledal"], htxt="Sobre madera muerta de frondosas, sobre todo roble, muy húmeda.", cur=["Su madera teñida de verde se usó en la marquetería de Tunbridge Ware."], rz=("poco", "La madera teñida de verde se ve más que las propias copitas."))

d = json.load(open(RUTA)); ids = {e['id'] for e in d['especies']}; by = {e['id']: e for e in d['especies']}
assert not any(e['id'] in ids for e in N), 'ya existe'
d['especies'] += N; by.update({e['id']: e for e in N})
corto = lambda e: (e['nombresComunes']['es'][0].capitalize() + ' (' + e['nombreCientifico'] + ')') if e['nombresComunes']['es'] else e['nombreCientifico']
for e in N:
    for c in e.get('confusiones', []):
        assert c['id'] in by, (e['id'], c['id']); o = by[c['id']]; o.setdefault('confusiones', [])
        if not any(x['id'] == e['id'] for x in o['confusiones']): o['confusiones'].append({'id': e['id'], 'nombre': corto(e), 'comoDistinguir': 'La ficha de %s avisa de esta confusión. Para reconocer esa especie: %s' % (e['nombreCientifico'], e['clave']), 'gravedad': c['gravedad'], 'inversa': True})
json.dump(d, open(RUTA, 'w'), ensure_ascii=False, indent=1)
print('total', len(d['especies']), 'nuevas', len(N))
