/* Guía de hábitats para principiantes: qué es cada sitio, cómo reconocerlo sin saber de árboles y dónde mirar.
   Es texto de guía general (no datos de una especie): los hábitats de cada seta salen de su ficha (`habitats`).
   Lo que dice de Bizkaia es orientativo y general; no son localizaciones concretas. */

/* nombre = cómo se llama aquí (sin jerga) · corto = «dónde mirar» en una frase · icono = clave de iconos de ficha.js */
export const H = {
  pinar: {
    nombre: 'Pinar', icono: 'conif', grupo: 'pinos', corto: 'bajo pinos',
    que: 'Bosque de pinos. Los pinos son árboles con «agujas» en vez de hojas.',
    reconoce: ['Las hojas son agujas largas y finas, de 10 a 20 cm, que salen de dos en dos o de tres en tres.', 'El suelo está cubierto por una capa marrón de agujas secas que amortigua los pasos.', 'Huele a resina y el tronco tiene corteza gruesa, rojiza o gris, y a veces gotas de resina.', 'Hay piñas (conos de madera) por el suelo.', 'Es verde todo el año: en invierno también tiene hojas.'],
    mirar: ['Entre los árboles, sobre la capa de agujas, a pocos pasos de un tronco: muchas setas viven pegadas a las raíces.', 'En los bordes de las pistas y senderos del pinar: ahí entra luz y suele haber setas.', 'En zonas con musgo y un poco de humedad, mejor que en laderas secas y soleadas.', 'Mueve las agujas con un palo con cuidado: algunas setas están medio tapadas.'],
    bizkaia: 'En Bizkaia es lo más fácil de encontrar: gran parte de los montes están plantados de pino (el llamado pino insignis o radiata). Son sitios cercanos y fáciles para empezar.',
    ojo: 'Los pinares plantados, tan apretados y oscuros, suelen tener menos setas que uno abierto con luz y musgo.'
  },
  coniferas: {
    nombre: 'Bosque de pinos y abetos', icono: 'conif', grupo: 'pinos', corto: 'bajo pinos o abetos',
    que: 'Bosque de árboles con agujas en vez de hojas (pinos, abetos y parecidos).',
    reconoce: ['Hojas en forma de aguja, verdes todo el año.', 'Dan piñas (conos).', 'El suelo está cubierto de agujas secas y huele a resina.'],
    mirar: ['Sobre la capa de agujas, cerca de los troncos.', 'En los bordes de pistas y senderos, donde entra luz.', 'En zonas con musgo y humedad.'],
    bizkaia: 'Aquí lo más común son los pinos de plantación; los abetos y píceas son más de montaña alta.', ojo: ''
  },
  abetal: {
    nombre: 'Abetal (bosque de abetos)', icono: 'conif', grupo: 'pinos', corto: 'bajo abetos',
    que: 'Bosque de abetos o píceas: árboles muy rectos, de aspecto oscuro y triangular, con agujas cortas.',
    reconoce: ['Agujas cortas (1–3 cm), planas o punzantes, repartidas a lo largo de la rama.', 'Forma de árbol de Navidad.', 'Sombra densa y suelo con poca hierba, cubierto de agujas.'],
    mirar: ['Sobre las agujas, cerca de los troncos.', 'En bordes de pistas y claros con luz.'],
    bizkaia: 'No es lo habitual en Bizkaia: es más típico de montaña alta (Pirineo, por ejemplo).', ojo: ''
  },
  robledal: {
    nombre: 'Robledal (bosque de robles)', icono: 'fron', grupo: 'anchas', corto: 'bajo robles',
    que: 'Bosque de robles. El roble es el árbol «de siempre» del norte: grande, de copa ancha, con hojas planas que se caen en invierno.',
    reconoce: ['Hojas planas de borde ondulado, con «lóbulos» redondeados (como una mano con dedos gordos).', 'En otoño hay bellotas en el suelo.', 'Corteza gris oscura, muy agrietada.', 'Troncos gruesos y copa ancha. En otoño las hojas se ponen amarillas o marrones y el suelo se cubre de hojas secas.'],
    mirar: ['Bajo la copa y entre las raíces, sobre las hojas caídas.', 'Zonas con helechos, musgo y humedad.', 'Bordes del bosque y sendas con algo de luz.'],
    bizkaia: 'Es el bosque original del Cantábrico. Hoy quedan manchas de robledal entre las plantaciones de pino, sobre todo en el interior.', ojo: ''
  },
  hayedo: {
    nombre: 'Hayedo (bosque de hayas)', icono: 'fron', grupo: 'anchas', corto: 'bajo hayas',
    que: 'Bosque de hayas: árboles altos y rectos que dan una sombra muy espesa.',
    reconoce: ['Tronco liso y gris claro, como piel de elefante.', 'Hojas ovaladas, pequeñas y de borde suave; en otoño se vuelven doradas y cobrizas.', 'Suelo cubierto de hojas pardas y casi sin matorral debajo: se ve «limpio».', 'Fruto: hayucos (una cápsula pequeña y espinosa con semillas triangulares).'],
    mirar: ['Sobre las hojas caídas, cerca de los troncos.', 'En troncos y ramas caídos y en tocones: muchas setas de madera salen ahí.', 'Zonas húmedas y con niebla.'],
    bizkaia: 'Suelen estar en montes altos y frescos del interior, más que en la costa baja.', ojo: ''
  },
  castanar: {
    nombre: 'Castañar (bosque de castaños)', icono: 'fron', grupo: 'anchas', corto: 'bajo castaños',
    que: 'Bosque de castaños: árboles grandes que dan castañas.',
    reconoce: ['Hojas largas y alargadas con el borde en forma de sierra, de dientes marcados.', 'Erizos verdes o pardos y espinosos por el suelo en otoño (con las castañas dentro).', 'Corteza con surcos que giran en espiral por el tronco.'],
    mirar: ['Bajo los castaños, entre las hojas secas y los erizos.', 'En los bordes y en caminos antiguos que cruzan el castañar.'],
    bizkaia: 'Suelen verse castaños en laderas y alrededor de caseríos del interior.', ojo: 'Los castañares suelen ser fincas con dueño: pide permiso o pregunta antes de entrar.'
  },
  encinar: {
    nombre: 'Encinar (bosque de encinas)', icono: 'fron', grupo: 'anchas', corto: 'bajo encinas',
    que: 'Bosque de encinas: árboles de hojas duras que no se caen en invierno.',
    reconoce: ['Hojas pequeñas, duras, verde oscuro y brillantes, a veces con espinitas en el borde. Siguen en el árbol todo el año.', 'Bellotas pequeñas.', 'Bosque oscuro, verde también en invierno.'],
    mirar: ['Bajo los árboles, entre las hojas secas.', 'En los bordes y claros del bosque.'],
    bizkaia: 'En el Cantábrico se ven sobre todo en sitios de roca caliza cerca de la costa, como en Urdaibai.', ojo: ''
  },
  abedular: {
    nombre: 'Abedular (bosque de abedules)', icono: 'fron', grupo: 'anchas', corto: 'junto a abedules',
    que: 'Grupo de abedules: árboles finos de tronco blanco.',
    reconoce: ['Tronco blanco con la corteza que se despega en tiras, como papel.', 'Hojas pequeñas con forma de triángulo y borde con dientes.', 'Ramas finas y colgantes.'],
    mirar: ['Pegado a los troncos y en el suelo bajo su copa.', 'Bordes de caminos y claros con suelo pobre.'],
    bizkaia: 'Suelen formar pequeños grupos en laderas y bordes de pista, más que bosques grandes.', ojo: ''
  },
  frondosas: {
    nombre: 'Bosque de hoja ancha', icono: 'fron', grupo: 'anchas', corto: 'bajo árboles de hoja ancha (robles, hayas, castaños…)',
    que: 'Bosque de árboles con hojas planas y anchas, no con agujas: robles, hayas, castaños, abedules, avellanos…',
    reconoce: ['Hojas planas y anchas (como una hoja «normal» de árbol), no agujas.', 'En otoño se ponen amarillas o marrones y caen: el suelo se cubre de hojas secas.', 'Suelo blando y oscuro que huele a tierra húmeda.', 'Si ves bellotas, castañas o hayucos, estás en uno.'],
    mirar: ['Sobre las hojas caídas, a pocos pasos de los troncos: muchas setas viven pegadas a las raíces.', 'En los bordes del bosque, en claros y junto a las sendas.', 'Laderas con humedad y sombra, mejor que cimas ventosas.', 'Troncos caídos y tocones: ahí salen setas de madera.'],
    bizkaia: 'Robles, hayas y castaños se ven sobre todo en valles y laderas del interior; cerca de la costa hay menos y más repartidos.', ojo: ''
  },
  mixto: {
    nombre: 'Bosque mezclado (pinos con robles o castaños)', icono: 'mixto', grupo: 'pinos', corto: 'donde se mezclan pinos y árboles de hoja ancha',
    que: 'Bosque donde conviven árboles de agujas (pinos) con árboles de hoja ancha (robles, castaños…).',
    reconoce: ['Ves a la vez árboles con agujas y árboles con hojas planas.', 'El suelo mezcla agujas secas y hojas caídas.'],
    mirar: ['En la zona de contacto entre las dos clases de árboles.', 'En los bordes de pistas: allí suelen juntarse.', 'Cada seta suele preferir un tipo de árbol: mira cuál tiene cerca.'],
    bizkaia: 'Es muy frecuente: manchas de pino pegadas a robles y castaños.', ojo: ''
  },
  bosque: {
    nombre: 'Bosque (de cualquier tipo)', icono: 'mixto', grupo: 'pinos', corto: 'en el bosque',
    que: 'Esta seta no es muy exigente con el árbol: puede salir en distintos tipos de bosque.',
    reconoce: ['Cualquier zona con árboles y suelo cubierto de hojas o agujas.'],
    mirar: ['Cerca de los troncos, entre las hojas o agujas del suelo.', 'En bordes de sendas, claros y zonas húmedas.'],
    bizkaia: '', ojo: ''
  },
  madera: {
    nombre: 'Sobre madera muerta', icono: 'madera', grupo: 'madera', corto: 'sobre troncos, tocones y madera muerta',
    que: 'Setas que no salen del suelo, sino de la madera podrida: viven alimentándose de ella.',
    reconoce: ['Troncos caídos, tocones y ramas gruesas en el suelo.', 'Madera blanda, oscura o húmeda y con musgo.', 'También leña apilada que lleva tiempo mojándose.'],
    mirar: ['Mira en todas las caras del tronco: arriba, a los lados y por debajo.', 'Los troncos en zonas sombrías y húmedas suelen tener más.', 'No solo en otoño: algunas salen en otras épocas.'],
    bizkaia: '', ojo: 'Algunas se parecen mucho entre sí y hay tóxicas: no te fíes solo del sitio, mira la ficha.'
  },
  arbol_vivo: {
    nombre: 'En árboles vivos', icono: 'madera', grupo: 'madera', corto: 'en el tronco de árboles vivos',
    que: 'Setas que crecen pegadas al tronco o a las ramas de un árbol vivo, normalmente en heridas o en árboles viejos o enfermos.',
    reconoce: ['Bultos o «repisas» pegados a la corteza.', 'Árboles viejos, con heridas, huecos o ramas rotas.'],
    mirar: ['Mira el tronco a todas las alturas, no solo el suelo.', 'Fíjate en árboles viejos o dañados.', 'Mira también la base del tronco, entre las raíces.'],
    bizkaia: '', ojo: ''
  },
  prado: {
    nombre: 'Prados y campas', icono: 'prado', grupo: 'abierto', corto: 'en prados de hierba',
    que: 'Zonas abiertas de hierba, sin árboles, como pastos de vacas y ovejas o campas.',
    reconoce: ['Hierba corta y mucho sol.', 'A veces hay vacas, ovejas o caballos, y excrementos.'],
    mirar: ['Entre la hierba, sobre todo tras unos días de lluvia.', 'Fíjate en círculos o filas de setas («corros de brujas»).', 'En bordes de prados, junto a setos y árboles sueltos.'],
    bizkaia: 'Hay muchas campas y pastos entre caseríos y montes.', ojo: 'Suelen ser propiedad privada o tener ganado: no entres en fincas ajenas ni cerca de animales. Si ves cercas, pide permiso.'
  },
  claro: {
    nombre: 'Claros y bordes de pista', icono: 'prado', grupo: 'abierto', corto: 'en claros y bordes de pista',
    que: 'Huecos sin árboles dentro del bosque, o los lados de una pista forestal.',
    reconoce: ['Zonas de hierba o suelo con sol dentro o al borde del bosque.', 'Los lados de caminos y pistas, donde se juntan hierba y árboles.'],
    mirar: ['En la línea donde la hierba se junta con los árboles.', 'Bordes de pistas, entradas y claros.'],
    bizkaia: '', ojo: ''
  },
  brezal: {
    nombre: 'Brezal (matorral bajo)', icono: 'prado', grupo: 'abierto', corto: 'en matorral bajo de brezo',
    que: 'Zona abierta cubierta de arbustos bajos, como brezo y tojo (una mata con espinas y flores amarillas).',
    reconoce: ['Matas bajas y leñosas, con flores moradas (brezo) o amarillas (tojo).', 'Suelos pobres y con piedras, en laderas o cumbres abiertas.', 'Viento y poca sombra.'],
    mirar: ['En los bordes del matorral y en los claros entre las matas.', 'Cerca de pinos o árboles sueltos que haya alrededor.'],
    bizkaia: 'Suele verse en laderas abiertas y cumbres de los montes.', ojo: 'Mucho tojo y espinas: lleva pantalón largo.'
  },
  parque: {
    nombre: 'Parques y jardines', icono: 'prado', grupo: 'abierto', corto: 'en parques y jardines',
    que: 'Césped, setos y árboles plantados en pueblos y ciudades.',
    reconoce: ['Césped cortado, parterres, árboles ornamentales y caminos.', 'A veces, mantillo o corteza triturada en los parterres.'],
    mirar: ['Bajo los árboles plantados y en los bordes del césped.', 'En los parterres con mantillo.'],
    bizkaia: 'Plazas, paseos y jardines de los pueblos.', ojo: 'En zonas urbanas puede haber tratamientos o contaminación: lo mejor es mirar, no recoger.'
  },
  huerto: {
    nombre: 'Huertos y tierra removida', icono: 'prado', grupo: 'abierto', corto: 'en huertos y tierra removida',
    que: 'Terrenos cultivados o abonados, como huertas, montones de compost o de estiércol.',
    reconoce: ['Tierra removida o muy rica, con restos de cultivo.', 'Montones de compost o de estiércol.'],
    mirar: ['En los bordes de las huertas y sobre el compost.'],
    bizkaia: 'Alrededor de caseríos y huertas.', ojo: 'Son fincas de otras personas: pide permiso.'
  },
  cuneta: {
    nombre: 'Caminos y cunetas', icono: 'camino', grupo: 'abierto', corto: 'en bordes de caminos',
    que: 'Los lados de caminos, pistas y senderos, y zonas de tierra pisada.',
    reconoce: ['Borde de un camino, con hierba, gravilla o tierra compactada.', 'Aparcamientos y entradas de pista.'],
    mirar: ['A lo largo del borde, caminando despacio.', 'Donde el camino se junta con hierba o árboles.'],
    bizkaia: '', ojo: 'Las setas absorben la contaminación: no recojas junto a carreteras con tráfico.'
  },
  quemado: {
    nombre: 'Zonas quemadas', icono: 'fuego', grupo: 'abierto', corto: 'en zonas quemadas',
    que: 'Sitios donde hubo un incendio o una hoguera: algunas setas salen justo ahí.',
    reconoce: ['Suelo negro con carbón y ceniza.', 'Troncos o tocones quemados.'],
    mirar: ['Sobre la tierra quemada, sobre todo el primer año tras el fuego.'],
    bizkaia: '', ojo: 'No es un sitio al que ir a buscar a propósito.'
  }
};
export const GRUPOS = [
  { id: 'anchas', t: 'Bosque de árboles de hoja ancha', s: 'Robles, hayas, castaños…' },
  { id: 'pinos', t: 'Pinares y bosques mezclados', s: 'Pinos, abetos, o pinos con robles' },
  { id: 'abierto', t: 'Fuera del bosque', s: 'Prados, bordes de caminos, matorral, jardines' },
  { id: 'madera', t: 'En madera', s: 'Troncos, tocones y árboles' }
];

/* «Dónde mirar» en una frase, sacada de los hábitats de la ficha */
export function dondeSimple(e) {
  const ids = (e.habitats || []).filter(h => H[h]); if (!ids.length) return '';
  /* si hay hábitats concretos, los genéricos sobran */
  const gen = new Set(['frondosas', 'coniferas', 'bosque', 'mixto']), conc = ids.filter(h => !gen.has(h)), usar = (conc.length ? conc : ids).slice(0, 4);
  const frases = usar.map(h => H[h].corto), ult = frases.pop();
  return (frases.length ? frases.join(', ') + ' y ' : '') + ult;
}

/* Cómo distinguir el árbol, para el principiante */
export const ARBOL = [
  ['Agujas en vez de hojas', 'Es un pino o un abeto. Verde todo el año, con piñas. → Pinar'],
  ['Hojas planas y anchas que se caen en otoño', 'Roble, haya, castaño, abedul… → Bosque de hoja ancha'],
  ['Hojas pequeñas, duras y oscuras que NO se caen', 'Probablemente encina. → Encinar'],
  ['Tronco blanco que se pela en tiras', 'Abedul. → Abedular'],
  ['Tronco liso y gris', 'Haya. → Hayedo']
];
export const CONSEJOS = [
  'Empieza por un sitio cercano que ya conozcas y vuelve varias veces: aprendes cuándo y dónde sale cada cosa.',
  'Las setas suelen salir pegadas a un tipo de árbol: fíjate siempre qué árbol tienes al lado.',
  'Tras varios días de lluvia y con temperaturas suaves, mira primero los bordes de pistas y los claros: se ve más.',
  'Lleva un palo para mover las hojas, una cesta (no bolsas de plástico) y el móvil para hacer fotos de arriba, de abajo y de la base.',
  'En otoño hay cacerías en el monte: lleva ropa vistosa y atiende a los avisos.',
  'Respeta las fincas privadas y las zonas protegidas, y no arranques las setas que no te vayas a llevar.'
];

/* Tipos de seta según cuándo y cómo salen, en palabras normales (los nombres técnicos quedan en los datos) */
export const GREMIO = {
  termo: { n: 'Setas de bosque que piden calor (boletos…)', d: 'Viven pegadas a las raíces de los árboles. Piden semanas templadas y mucha lluvia: típicas de finales de verano y principios de otoño.' },
  ecm: { n: 'Setas de bosque de otoño', d: 'Viven pegadas a las raíces de los árboles, por eso salen siempre cerca de un árbol concreto. Salen en otoño tras semanas de lluvia.' },
  tardia: { n: 'Setas que aguantan el frío', d: 'Salen tarde, con el tiempo ya fresco, y duran hasta bien entrado el otoño.' },
  prado: { n: 'Setas de prados y suelo', d: 'Crecen en la hierba y en el suelo, sin depender de un árbol.' },
  madera: { n: 'Setas de madera (troncos y tocones)', d: 'Se alimentan de madera muerta: salen sobre troncos, tocones y ramas.' },
  primavera: { n: 'Setas de primavera', d: 'Salen en primavera, no en otoño.' },
  perenne: { n: 'Setas duras de madera (todo el año)', d: 'Son duras y se ven casi todo el año.' }
};
export const gremioNom = (id, orig) => GREMIO[id] ? GREMIO[id].n : orig;
