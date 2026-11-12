from h import *
# Las 9 fichas existentes de setas que se consideran candidatas a comestibles (siguen «sin confirmar»).
CORTE = ('Con la especie bien conocida: corte limpio por la base con navaja (La Rioja). La primera vez, sácala entera con la base del pie para estudiarla y tapa el hueco con tierra.')

extra('boletus-edulis', eu=['udazkeneko onddozuri', 'onddo zuri'], hab=['pinar', 'abetal', 'hayedo', 'castanar', 'robledal', 'mixto'],
  habt='Zonas dominadas por pinos, píceas, abetos y tsugas; también con castaño, haya y roble. Crece aislada o en grupos de dos o tres ejemplares. Puede salir de verano a otoño (de junio a noviembre en el Reino Unido); su crecimiento lo dispara la lluvia en un periodo cálido.',
  rec=dict(acc='cortar', txt=CORTE + ' Tamaño mínimo que recomienda La Rioja: sombrero de 5 cm. Fíjate siempre en el retículo blanco del pie y en que los poros no sean rojos.'),
  cur=['Bulliard la describió en 1782 y aún conserva su nombre original.',
       'En el folclore italiano se dice que los «porcini» brotan con la luna nueva; los estudios científicos han buscado qué factores determinan su aparición y apuntan a la lluvia en tiempo cálido.',
       '«edulis» significa «comestible» en latín.',
       'En 2023 fue declarada seta oficial del estado de Utah.'],
  wp=['boletus-edulis'])

extra('cantharellus-cibarius', eu=['zizahori'], hab=['frondosas', 'coniferas', 'mixto'],
  habt='Crece bajo árboles de hoja caduca (abedul) y también bajo coníferas, más bien en suelos ácidos, desde principios de verano hasta finales de otoño según la región. En Europa se extiende de Escandinavia al Mediterráneo.',
  rec=dict(acc='cortar', txt=CORTE + ' Mira bien la cara de abajo: debe tener pliegues romos que bajan por el pie, no láminas finas.'),
  cur=['En Norteamérica, todos los rebozuelos amarillos se llamaron Cantharellus cibarius; el análisis de ADN demostró que son un grupo de especies parecidas, y el nombre se reservó para la europea.',
       'Si está empapada se pudre antes: conviene recogerla en seco.',
       'La Wikipedia en euskera dice que el ADN la sitúa cerca de Hydnum repandum.'],
  wp=['cantharellus-cibarius'])

extra('craterellus-cornucopioides', eu=['saltsa-perretxiko beltz'], hab=['hayedo', 'robledal', 'frondosas'],
  habt='Bosque de frondosas, sobre todo haya y roble, entre musgo en sitios húmedos sobre suelo calizo pesado. En Europa suele ser común, aunque rara en algunos países como los Países Bajos. Sale de junio a noviembre.',
  rec=dict(acc='cortar', txt=CORTE + ' Es oscura y se camufla en la hojarasca; mira en el suelo musgoso y húmedo.'),
  cur=['La «cornucopia» de la mitología griega es el cuerno de la cabra Amaltea, que se llenaba de lo que su dueño pidiera: símbolo de abundancia. De ahí su nombre científico.',
       'En inglés se llama «trompeta de la muerte» (trumpet of the dead): un nombre que impresiona, pese al cual la Wikipedia en euskera la considera de riesgo bajo.',
       'Es difícil de encontrar por su tamaño pequeño y su color oscuro, que se confunde con la hojarasca del suelo del bosque (Wikipedia en español).',
       'La Wikipedia en euskera la considera segura de recoger porque es muy difícil confundirla con una seta venenosa, y se conserva bien seca.'],
  wp=['craterellus-cornucopioides'])

extra('hydnum-repandum', eu=['tripaki argi', 'negu ziza', 'zizauri'], hab=['mixto', 'frondosas', 'coniferas'],
  habt='Micorrícica: crece en el suelo o entre la hojarasca, sola, dispersa o en grupos, tanto en bosques de coníferas como de frondosas, a veces en corros de brujas. Fructifica de verano a otoño. Está ampliamente distribuida por Europa.',
  rec=dict(acc='cortar', txt=CORTE + ' Dale la vuelta: los «pinchos» en lugar de láminas son lo que la identifica.'),
  cur=['Linneo la describió en 1753 y Fries la consolidó en 1821; ha pasado por varios géneros (Hypothele, Dentinum…).',
       'El ADN la sitúa muy cerca del rebozuelo, Cantharellus cibarius.',
       'En euskera también se le llama «negu ziza» («seta de invierno»).'],
  wp=['hydnum-repandum'])

extra('lactarius-deliciosus', eu=['esnegorri'], hab=['pinar', 'coniferas'],
  habt='Vive en micorriza con coníferas, sobre todo del género Pinus, en suelos ácidos. Es nativa del sur de los Pirineos, bajo pinos mediterráneos, y de toda la cuenca mediterránea. En el hemisferio norte se recoge de agosto a principios de octubre.',
  rec=dict(acc='cortar', txt=CORTE + ' Tamaño mínimo que recomienda La Rioja para los níscalos (grupo Dapetes): 3 cm. Corta un trozo y comprueba el látex naranja que sale; en otros Lactarius puede ser blanco o cambiar de color.'),
  cur=['Linneo la describió en 1753 como Agaricus deliciosus; «deliciosus» significa «sabroso» en latín, pero puede saber suave o amarga: se cree que Linneo la confundió con otra.',
       'Un fresco de la ciudad romana de Herculano parece representarla y sería una de las primeras imágenes de un hongo en el arte.',
       'Su nombre en euskera, «esnegorri», significa «leche roja».'],
  wp=['lactarius-deliciosus'])

extra('macrolepiota-procera', eu=['galanperna'], hab=['prado', 'claro', 'cuneta', 'frondosas', 'coniferas'],
  habt='Bosques de frondosas y coníferas, pero sobre todo en céspedes, prados, claros del bosque y junto a caminos, en suelos bien drenados. Fructifica de verano a finales de otoño; sola, en grupos o en corros de brujas.',
  rec=dict(acc='extraer', txt='Sácala entera la primera vez: hay que ver la base del pie (sin volva) y comprobar que el anillo se mueve. La Rioja: solo con el sombrero ya desplegado. El pie es muy fibroso y no se aprovecha.'),
  cur=['Scopoli la describió en 1772 como Agaricus procerus; Rolf Singer la pasó a Macrolepiota en 1948.',
       'En algunas zonas de Europa se llama «sombrero de serpiente» o «esponja de serpiente», por las escamas del pie.'],
  wp=['macrolepiota-procera'])

extra('marasmius-oreades', eu=['marasmio jangarri', 'hankaluzea'], hab=['prado', 'parque', 'cuneta'],
  habt='Zonas de hierba: céspedes, prados e incluso dunas costeras. Crece en grupos, arcos o corros; donde hay corro la hierba aparece en manchas pardas alrededor. Primavera, verano y otoño (de mayo a noviembre en el Reino Unido), y todo el año en climas cálidos. Fructifica en grandes cantidades en junio tras las lluvias.',
  rec=dict(acc='cortar', txt='Es pequeña y sale en grupos. Corta por la base y fíjate en cada una: crece en el mismo césped que Clitocybe rivulosa (tóxica). Se seca y se conserva muy bien.'),
  cur=['El micólogo David Arora la cita como una de las pocas «setitas pardas» que merece la pena aprender.',
       'En euskera se llama también «hankaluzea».'],
  wp=['marasmius-oreades'])

extra('calocybe-gambosa', eu=['zizazuri', 'perretxiko'], hab=['prado', 'claro', 'cuneta'],
  habt='Común en praderas de Europa, a menudo en zonas ricas en caliza. Sale de abril a junio en el Reino Unido, antes en países más cálidos y después en los más fríos.',
  rec=dict(acc='cortar', txt=CORTE + ' Tamaño mínimo (La Rioja): sombrero de 3 cm. Es mejor recogerla en tiempo seco. En la misma época y sitios salen setas tóxicas parecidas: comprueba siempre el olor a harina fresca.'),
  cur=['En los South Downs (sur de Inglaterra) forma corros de brujas enormes que parecen tener cientos de años.',
       'Fries la describió en 1821 como Agaricus gambosus: «gambosa» viene del latín y significa «de pie hinchado».',
       'Se apreciaba mucho en la Italia medieval; Costanzo Felici la mencionaba en 1569.',
       'Se importa en cantidad comercial desde Rumanía, Hungría y Turquía.'],
  wp=['calocybe-gambosa'])

extra('morchella', eu=['karraspina arrunt', 'seta-erlauski', 'tripa-ziza'], hab=['frondosas', 'prado', 'huerto', 'quemado'],
  habt='Suele salir en grupos, en hábitats muy variados. Prefiere suelos calizos, aunque también se ha encontrado en ácidos. Aparece al principio de la primavera, en bosques, huertos, patios, jardines y, a veces, en zonas recién quemadas.',
  rec=dict(acc='cortar', txt=CORTE + ' Pártela por la mitad: el sombrero debe estar hueco y unido al pie. A veces hay ciempiés dentro.'),
  cur=['Linneo la describió en 1753 como Phallus esculentus; Persoon le dio su nombre actual en 1801.',
       'Cruda irrita el estómago, por eso nunca se come cruda.',
       'La Wikipedia en euskera dice que es una de las setas más conocidas del mundo, pero en el País Vasco otras son más famosas.'],
  wp=['morchella-esculenta'])
