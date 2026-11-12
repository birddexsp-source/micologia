from h import *
# Añadidos a las 25 fichas que ya existían: nombres en euskera, hábitat, cómo recoger y curiosidades. Cada dato sale de las fuentes citadas.

extra('amanita-phalloides', eu=['hiltzaile berde', 'kuleto berde', 'txapel biribil', 'ilkor'], hab=['robledal', 'hayedo', 'castanar', 'frondosas', 'pinar'],
  habt='Micorrícica con varios árboles: en Europa, sobre todo frondosas y, menos, coníferas. Aparece sobre todo bajo robles, pero también bajo hayas, castaños, castaños de Indias, abedules, avellanos, carpes, pinos y piceas. Nativa de Europa, desde Escandinavia hasta el norte de África.',
  rec=dict(acc='dejar', txt='No se recoge para comer. Si la sacas para identificarla, que sea entera, con la volva (en la Wikipedia en euskera, de 3–5 cm de ancho) y separada del resto de setas en la cesta.'),
  cur=['Es la responsable de la mayoría de las muertes por setas en el mundo. Se calcula que 30 g, o media seta, bastan para matar a una persona.',
       'La describió el botánico francés Sébastien Vaillant en 1727.',
       'En euskera también se llama «kuleto berde» (oronja verde) y «txapel biribil».'],
  wp=['amanita-phalloides'])

extra('amanita-verna-virosa', eu=['hiltzaile goiztiar', 'hiltzaile konkordun', 'kuleto zuri', 'ilkor zuri'], hab=['frondosas', 'hayedo', 'castanar', 'pinar', 'abetal'],
  habt='A. verna sale en primavera en bosques europeos y de frondosas. A. virosa, a finales de verano y otoño, sobre todo con haya y castaño, pero también con pino, pícea y abeto (suelos ácidos según la Wikipedia en español).',
  rec=dict(acc='dejar', txt='No se recoge para comer. Si la sacas para identificarla, desentierra la volva y mantenla separada del resto.'),
  cur=['Bulliard ya avisó en 1780 de que se confundía fácilmente con el champiñón de campo (Agaricus campestris).',
       '«virosa» viene del latín y significa «tóxico» (como «virus»). Una sola seta de A. virosa basta para matar a un adulto.',
       'Según la Wikipedia en euskera, A. verna, A. virosa, A. phalloides y la variedad blanca de la phalloides forman la «cuarteta» de las amanitas mortales.',
       'A. verna no se conoce en América del Norte.'],
  wp=['amanita-verna', 'amanita-virosa'])

extra('lepiota-brunneoincarnata', eu=['galaperna arre-arrosa'], hab=['parque', 'cuneta', 'prado'],
  habt='Zonas cálidas de Europa, sobre todo el sur; registrada también en Gran Bretaña y Alemania. La descubrieron en 1889 en los bordes de una carretera de Ginebra.',
  rec=dict(acc='dejar', txt='No se recoge. Es una setita de césped y jardín, justo donde se buscan setas «de campo» comestibles.'),
  cur=['Contiene dosis mortales de alfa-amanitina. Causó una muerte en España en 2002, un brote en Irán en 2018 y la muerte de cuatro jóvenes de una misma familia en Túnez en 2010.',
       'El análisis de su ADN muestra que está emparentada con otras Lepiota con amatoxinas, como L. subincarnata.'],
  wp=['lepiota-brunneoincarnata'])

extra('galerina-marginata', eu=['galera hiltzaile'], hab=['madera', 'coniferas', 'frondosas'],
  habt='Saprobia que descompone madera, en bosques de coníferas y de frondosas del hemisferio norte (Norteamérica, Europa, Asia, Japón).',
  rec=dict(acc='dejar', txt='No se recoge. Sale sobre madera, en el mismo sitio que setas de madera comestibles.'),
  cur=['Antes se consideraba un conjunto de cinco especies; al comparar su ADN se vio que son una sola y muy variable.',
       'Las amatoxinas que contiene son las responsables de más del 90 % de las muertes por setas.'],
  wp=['galerina-marginata'])

extra('cortinarius-orellanus', eu=['sare hiltzaile', 'kortinario hiltzaile gorri'], hab=['hayedo', 'robledal', 'frondosas'],
  habt='Bosques caducifolios bajo haya, carpe y roble, a menudo cerca de pinos. En Europa central y oriental (Polonia, Chequia, Eslovaquia); rara en Alemania y ocasional en el sur de Gran Bretaña.',
  rec=dict(acc='dejar', txt='No se recoge. Se parece a los rebozuelos (pliegues romos frente a láminas verdaderas color óxido).'),
  cur=['Su peligro se descubrió en 1957, después de que en 1952 enfermaran 102 personas tras comerla en Bydgoszcz (Polonia); 11 murieron.',
       'Fries la describió en 1838.'],
  conf=[c('cantharellus-cibarius', 'Rebozuelo (Cantharellus cibarius)', 'Rebozuelo: pliegues romos que bajan por el pie y olor afrutado (albaricoque). Cortinarius orellanus: láminas verdaderas que se vuelven color óxido y olor ligero a rábano.', 'alta')],
  wp=['cortinarius-orellanus'])

extra('gyromitra', eu=['mitra muin', 'mitra ziza'], hab=['pinar', 'coniferas', 'frondosas'],
  habt='Suelo arenoso en bosques templados de coníferas y, a veces, de frondosas; sobre todo bajo pinos, y a veces bajo álamos temblones. Sale de abril a julio, antes que otras setas, y puede brotar con la nieve derretida. Abundante unos años y rara otros.',
  rec=dict(acc='dejar', txt='No se recoge. Es una seta de primavera, la época del perrechico.'),
  cur=['Según la Wikipedia en euskera, es tóxica cruda y se dice que comestible bien cocida, pero eso se discute: ha causado la muerte, sobre todo a niños.',
       'En Soria se recogía en grandes cantidades para exportarla seca a Francia e Italia; parece que hoy su venta está prohibida.',
       'Persoon la describió en 1800 como Helvella esculenta.'],
  wp=['gyromitra'])

extra('entoloma-lividum-sinuatum', eu=['azpiarrosa maltzur'], hab=['robledal', 'hayedo', 'frondosas', 'parque', 'prado'],
  habt='Aparece a finales de verano y en otoño en bosques de hoja caduca bajo roble, haya y, menos, abedul, a menudo en suelos arcillosos o calizos; también en parques y prados cercanos, a veces en corros. Bastante común y extendida por Norteamérica y toda Europa, más en el sur y el centro que en el noroeste. Suele crecer cerca de setas comestibles.',
  rec=dict(acc='dejar', txt='No se recoge. Es grande, huele bien y se confunde con setas comestibles.'),
  cur=['Se le atribuye el 10 % de todas las intoxicaciones por setas en Europa. En Ginebra, en 1983, 70 personas necesitaron tratamiento hospitalario; en un hospital de Parma fue la causa de 33 de 145 casos en cinco años.',
       'La describió por primera vez Bulliard en 1788 como Agaricus lividus.'],
  wp=['entoloma-sinuatum'])

extra('omphalotus-illudens', eu=['apo-ziza', 'ziza hori faltsu'], hab=['encinar', 'robledal', 'castanar', 'frondosas', 'madera'],
  habt='Crece en grupos al pie de olivos, robles, castaños (Wikipedia en euskera). O. olearius es poco frecuente y se ve en verano y otoño (julio–octubre) en el sur de Europa: sur de Francia, península ibérica y otros países mediterráneos.',
  rec=dict(acc='dejar', txt='No se recoge. Se confunde con el rebozuelo, pero crece en mata sobre madera.'),
  cur=['En inglés se llama «jack-o\'-lantern» (linterna de calabaza).'],
  wp=['omphalotus-olearius'])

extra('tricholoma-pardinum', eu=['ziza nabar'], hab=['hayedo', 'abetal'],
  habt='En Europa, sobre suelo calcáreo en bosques con haya y abeto, en verano y otoño, y prefiere zonas de cierta altitud. Se encuentra por toda Europa, más en el sur; es abundante en los montes Jura (Francia). No se ha registrado en los Países Bajos ni en las islas británicas.',
  rec=dict(acc='dejar', txt='No se recoge. Es grande, carnosa y huele y sabe bien: por eso se come por error.'),
  cur=['En la primera mitad del siglo XX fue responsable de más del 20 % de las intoxicaciones por setas en Suiza.',
       'Según la Wikipedia en euskera, es muy venenosa pero no mortal, y donde es abundante es la que más intoxicaciones causa.',
       'Schäffer la dibujó en 1762 con el nombre Agaricus tigrinus.'],
  wp=['tricholoma-pardinum'])

extra('amanita-pantherina-muscaria', eu=['lanperna txar', 'zapoziza', 'kuleto faltsu'], hab=['hayedo', 'frondosas', 'coniferas'],
  habt='A. pantherina: poco común, en frondosas (sobre todo haya) y, menos, coníferas, y rara vez prados, a finales de verano y otoño. A. muscaria: cosmopolita, en bosques de coníferas y de frondosas de las zonas templadas y boreales del hemisferio norte.',
  rec=dict(acc='dejar', txt='No se recoge para comer. Si la sacas para identificarla, desentierra la base y mantenla separada.'),
  cur=['El nombre de muscaria en muchos idiomas europeos (fly agaric, Fliegenpilz…) viene de usarla como insecticida: se espolvoreaba en leche para atraer y matar moscas.',
       'Wikipedia dice que A. pantherina es más tóxica que A. muscaria.',
       'La seta roja con motas blancas aparece en cuentos, jardines y dibujos como casa o asiento de gnomos y hadas.'],
  wp=['amanita-pantherina', 'amanita-muscaria'])

extra('paxillus-involutus', eu=['orri-onddo hiltzaile'], hab=['frondosas', 'coniferas', 'mixto'],
  habt='Micorrícica con muchas coníferas y frondosas; poco exigente con el árbol, por eso se usa mucho en investigación.',
  rec=dict(acc='dejar', txt='No se recoge. Fue «comestible» durante generaciones y hoy se considera mortal.'),
  cur=['Se comió mucho en Europa central y oriental hasta la Segunda Guerra Mundial; en Polonia, encurtida o en salazón. Se creía comestible cocinada; hoy se considera tóxica mortal.',
       'Según la Wikipedia en euskera, algunas toxinas desaparecen con el calor y otras actúan por acumulación, por lo que comerla de vez en cuando no daba problemas graves: de ahí el error.',
       'Bulliard la describió en 1785 como Agaricus contiguus.'],
  wp=['paxillus-involutus'])

extra('boletus-satanas', eu=['satan onddo', 'onddo deabru'], hab=['robledal', 'castanar', 'frondosas'],
  habt='Bosques cálidos de frondosas y mixtos, asociado a roble y castaño. Fructifica en verano y principios de otoño. Es raro en casi todos los lugares donde se ha citado; en Europa sale sobre todo en el sur y es raro o falta en el norte.',
  rec=dict(acc='dejar', txt='No se recoge. Poros rojos + retículo + sombrero pálido: boleto que hay que dejar.'),
  cur=['Lo describió Harald Othmar Lenz en 1831, que dijo haberse sentido mal por «emanaciones» mientras lo describía.',
       'Es moderadamente venenoso, sobre todo crudo. Según la Wikipedia en euskera, no está entre los más venenosos.'],
  wp=['rubroboletus-satanas'])

extra('coprinopsis-atramentaria', eu=['urbeltz gorritzaile'], hab=['prado', 'cuneta', 'madera'],
  habt='Por todo el hemisferio norte. En mata, a menudo asociada a madera enterrada, en praderas, prados y terrenos removidos.',
  rec=dict(acc='dejar', txt='No se recoge: aunque joven se considera comestible, con alcohol da síntomas. Mejor no consumirla (Wikipedia en euskera).'),
  cur=['Comida en las horas anteriores o posteriores a beber alcohol da un efecto parecido al del disulfiram (enrojecimiento facial, náuseas, vómitos, palpitaciones). Esta interacción solo se conoce desde principios del siglo XX.',
       'Antiguamente se usó como fuente de tinta: la dejaban descomponerse hasta obtener un líquido negro (Wikipedia en euskera).',
       'Bulliard la describió en 1786. «atramentaria» viene del latín «atramentum», tinta.'],
  wp=['coprinopsis-atramentaria'])

extra('tricholoma-equestre', eu=['zaldun-ziza orrihori', 'zaldun perretxiko'], hab=['pinar'],
  habt='Bastante común en pinares (Wikipedia en euskera).',
  rec=dict(acc='dejar', txt='No se recoge. Fue de las setas más apreciadas durante siglos y hoy se considera tóxica.'),
  cur=['Durante mucho tiempo fue una de las comestibles más apreciadas y se vendía en los mercados europeos. Se cuenta que los caballeros franceses medievales se la reservaban y dejaban el boleto bovino (Suillus bovinus) a los campesinos.',
       'Se llama Grünling en alemán, gąska zielonka en polaco, míscaro en portugués y canari en francés.',
       'Linneo la describió en 1753 como Agaricus equestris: «equestre» significa «de caballero».'],
  wp=['tricholoma-equestre'])

extra('clitocybe-rivulosa', eu=['bideetako klitozibe zuri'], hab=['prado', 'parque'],
  habt='Praderas, en verano y otoño, en Europa y América del Norte, donde a menudo forma corros de brujas; la hierba crece más verde donde sale. Aparece a menudo en zonas de césped donde pueden encontrarla niños pequeños.',
  rec=dict(acc='dejar', txt='No se recoge. Crece en el mismo césped que la senderuela y el champiñón.'),
  cur=['Su toxina, la muscarina, provoca en 15–30 minutos mucha saliva, sudor y lágrimas.',
       'Persoon la describió en 1801 como Agaricus rivulosus.'],
  wp=['clitocybe-rivulosa'])

extra('tylopilus-felleus', eu=['onddo mingots'], hab=['hayedo', 'robledal', 'frondosas', 'coniferas'],
  habt='Micorrícica; bosques de frondosas y coníferas, a menudo bajo haya y roble, en suelos ácidos y bien drenados. Aparece entre agosto y octubre (Wikipedia en español).',
  rec=dict(acc='dejar', txt='No se recoge: es amargo hasta el extremo. Una sola puede arruinar un plato entero de setas.'),
  cur=['Es extremadamente amargo, aunque no tóxico en sí; la cocción aumenta el amargor.',
       'Bulliard lo describió en 1788 como «le bolet chicotin» (el boleto amargo).',
       'Aun así, se vende en mercados de México.'],
  wp=['tylopilus-felleus'])
