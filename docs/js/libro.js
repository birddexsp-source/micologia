/* «El libro»: capítulos para quien empieza de cero. Solo construye HTML; no guarda nada.
   Cada capítulo cita sus fuentes. Lo que no se ha podido comprobar se dice como tal. */
import { esc } from './util.js';

export const FUENTES = {
  rioja: ['Gobierno de La Rioja: Consejos para la recolección de setas', 'https://larioja.org/medio-ambiente/en/gestion-forestal-incendios-forestales/aprovechamiento-setas.files/753961-737604_CONSEJOS_recoleccion_setas.pdf'],
  consumer: ['Consumer (Eroski): Setas, cesta, navaja… y cautela', 'https://www.consumer.es/articulo/coger-setas-cesta-navaja-cautela'],
  ocu: ['OCU: Mitos sobre las setas (2020)', 'https://www.ocu.org/alimentacion/alimentos/noticias/mitos-sobre-setas'],
  summa: ['SUMMA 112 (Comunidad de Madrid): Ante la mínima sospecha, a Urgencias (2017)', 'https://www.comunidad.madrid/node/54017'],
  int: ['Instituto Nacional de Toxicología: Prevención de intoxicaciones, setas', 'https://www.mjusticia.gob.es/en/institucional/organismos/instituto-nacional/servicios/servicio-informacion/prevencion-intoxicaciones/setas1'],
  tuni: ['Universidad de Tampere: How can wild mushrooms be harvested sustainably?', 'https://blogs.tuni.fi/enve/blogpost/how-can-wild-mushrooms-be-harvested-sustainably/'],
};
const I = {
  mochila: '<svg viewBox="0 0 24 24"><path d="M6 9a6 6 0 0 1 12 0v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M9 9h6M9 14h6M10 5V3h4v2"/></svg>',
  mano: '<svg viewBox="0 0 24 24"><path d="M5 20h14M12 20V9M12 9c-3 0-6-1.500-6-4 4 0 6 1 6 4zM12 12c0-3 3-4 6-4 0 3-3 4-6 4z"/></svg>',
  lupa: '<svg viewBox="0 0 24 24"><circle cx="10.500" cy="10.500" r="6"/><path d="M15 15l6 6"/></svg>',
  no: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M5.600 5.600l12.800 12.800"/></svg>',
  cocina: '<svg viewBox="0 0 24 24"><path d="M4 11h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6zM8 4c0 2 2 2 2 4M13 4c0 2 2 2 2 4"/></svg>',
  alerta: '<svg viewBox="0 0 24 24"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
  mapa: '<svg viewBox="0 0 24 24"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/></svg>',
};
export const CAPS = [
  { id: 'antes', n: 1, titulo: 'Antes de salir', sub: 'Qué llevar, cuándo ir y dónde no', color: '#e0a458', ico: I.mochila },
  { id: 'recoger', n: 2, titulo: 'En el monte: cómo recoger', sub: '¿Cortar o arrancar? Qué dejar y qué llevar', color: '#7ccf8e', ico: I.mano },
  { id: 'identificar', n: 3, titulo: 'Aprender a identificar', sub: 'Cómo se aprende y la esporada paso a paso', color: '#4cc3d9', ico: I.lupa },
  { id: 'mitos', n: 4, titulo: 'Mitos peligrosos', sub: 'Lo que «todo el mundo sabe» y es falso', color: '#f06292', ico: I.no },
  { id: 'casa', n: 5, titulo: 'En casa', sub: 'Conservar, cocinar y cuánto comer', color: '#b69cf0', ico: I.cocina },
  { id: 'intox', n: 6, titulo: 'Si hay una intoxicación', sub: 'Qué hacer y qué decir en urgencias', color: '#e5484d', ico: I.alerta },
  { id: 'normas', n: 7, titulo: 'Normas y permisos', sub: 'Lo que no he podido verificar para Bizkaia', color: '#8a9a95', ico: I.mapa },
];
const cap = id => CAPS.find(c => c.id === id);
const ul = xs => '<ul class="lib-ul">' + xs.map(x => '<li>' + x + '</li>').join('') + '</ul>';
const note = (t, c = '') => '<div class="note ' + c + '" style="margin:10px 0">' + t + '</div>';
const sec = t => '<div class="sec">' + esc(t) + '</div>';
const E = esc;

/* Dibujo: cortar por la base / sacar entera. La misma seta en los dos casos. */
function cortarSVG() {
  const seta = (x, y, entera) => '<g transform="translate(' + x + ' ' + y + ')"><path d="M-30 0C-30-26 30-26 30 0z" fill="#c78a3d" stroke="#0a0f0e" stroke-width="1.500"/><path d="M-8 0V40H8V0z" fill="#efe3cf" stroke="#0a0f0e" stroke-width="1.500"/>' +
    (entera ? '<path d="M-14 40C-14 52-10 58 0 58S14 52 14 40z" fill="#e0d2ae" stroke="#0a0f0e" stroke-width="1.500"/>' : '') + '</g>';
  return '<svg class="esq" viewBox="0 0 340 150" role="img" aria-label="A la izquierda, una seta cortada por la base: el pie queda en el suelo. A la derecha, una seta sacada entera con su base">' +
    '<rect x="0" y="92" width="340" height="58" fill="#15201c"/><path d="M0 92H340" stroke="#2c3d37" stroke-width="2"/>' +
    '<path d="M70 92V102M62 92v6M78 92v6" stroke="#9aa5a1" stroke-width="1.600"/>' + seta(70, 50, false) +
    '<path d="M44 94L96 94" stroke="#ff7a59" stroke-width="2" stroke-dasharray="4 3"/><text x="70" y="124" text-anchor="middle" font-size="12" font-weight="700" fill="#ff7a59">Cortar</text><text x="70" y="140" text-anchor="middle" font-size="10.500" fill="#9aa5a1">navaja, por la base</text>' +
    '<path d="M250 92V120M238 92v14M262 92v14" stroke="#9aa5a1" stroke-width="1.600"/>' + seta(250, 50, true) +
    '<text x="250" y="124" text-anchor="middle" font-size="12" font-weight="700" fill="#7ccf8e">Extraer entera</text><text x="250" y="140" text-anchor="middle" font-size="10.500" fill="#9aa5a1">y tapar el hueco</text></svg>';
}
/* Dibujo: esporada sobre papel mitad blanco, mitad negro */
function esporadaSVG() {
  let r = ''; for (let a = 0; a < 360; a += 15) { const t = a * Math.PI / 180; r += '<path d="M' + (170 + 8 * Math.cos(t)).toFixed(1) + ' ' + (62 + 8 * Math.sin(t)).toFixed(1) + ' L' + (170 + 44 * Math.cos(t)).toFixed(1) + ' ' + (62 + 44 * Math.sin(t)).toFixed(1) + '" stroke="#b07b5a" stroke-width="3" stroke-linecap="round" opacity=".85"/>'; }
  return '<svg class="esq" viewBox="0 0 340 124" role="img" aria-label="Esporada: un sombrero con las láminas hacia abajo sobre papel mitad blanco y mitad negro deja un dibujo radial del color de sus esporas">' +
    '<rect x="60" y="6" width="110" height="112" rx="4" fill="#f4f1ea"/><rect x="170" y="6" width="110" height="112" rx="4" fill="#1b1b1f"/>' + r +
    '<circle cx="170" cy="62" r="5" fill="#0a0f0e" opacity=".25"/><text x="115" y="116" text-anchor="middle" font-size="9" fill="#555">papel blanco</text><text x="225" y="116" text-anchor="middle" font-size="9" fill="#999">papel oscuro</text></svg>';
}
const paso = (n, t, d) => '<li><span class="mk">' + n + '</span><div><b>' + E(t) + '</b><small>' + d + '</small></div></li>';
const pasos = xs => '<ol class="lib-steps">' + xs.map((x, i) => paso(i + 1, x[0], x[1])).join('') + '</ol>';
const par = (no, si) => '<div class="lib-par"><div class="no"><b>No</b>' + no + '</div><div class="si"><b>Sí</b>' + si + '</div></div>';
const fu = ks => '<div class="sec">Fuentes de este capítulo</div><div class="note"><ul class="cred">' + ks.map(k => '<li><a href="' + E(FUENTES[k][1]) + '" target="_blank" rel="noopener">' + E(FUENTES[k][0]) + '</a></li>').join('') + '</ul><small style="color:var(--mut)">Consultadas el 12-nov-2026. Son guías divulgativas y oficiales, no un tratado de micología.</small></div>';

const CUERPO = {
  antes: () => note('Lo más importante, antes de nada: <b>no se come nada que no hayas identificado con seguridad</b>. Salir a buscar setas y aprender a distinguirlas son dos cosas distintas, y se puede empezar solo mirando y fotografiando.', 'ok') +
    sec('Qué llevar') + ul([
      '<b>Cesta</b> de mimbre u otro material rígido y aireado, que no golpee las setas (La Rioja). Nunca bolsas de plástico: retienen humedad y las fermentan.',
      '<b>Navaja</b> y <b>cepillo</b> pequeño: la navaja para cortar y el cepillo para limpiar en el sitio. También una lupa, una guía de campo, mapa y móvil.',
      '<b>Calzado alto</b>, bastón y ropa para el tiempo que haga. No vayas solo al monte.']) +
    sec('Cuándo no salir a coger') + ul([
      'Tras <b>lluvias intensas</b>: las setas pierden calidad y su aspecto puede engañar.',
      'Tras <b>heladas de noche con deshielo de día</b>.',
      '<b>Nunca de noche.</b>']) +
    sec('Dónde no coger') + ul([
      'Cerca de <b>vertederos, zonas industriales, bordes de carretera, sotos inundables, fincas agrícolas o naves de ganado</b>: las setas acumulan metales y sustancias tóxicas (La Rioja; SUMMA 112 dice lo mismo de las cercanas a ciudades o industrias).']) +
    sec('Seguridad en el monte') + ul([
      'Infórmate de si hay <b>monterías</b> y presta atención a los ladridos de perros de caza. Lleva ropa visible.',
      '<b>Garrapatas</b>: ropa cerrada y oscura, repelente, revisión del cuerpo y ducha al llegar. Si encuentras una, retírala despacio con pinzas, sujetándola por la boca. Ve al médico si te da fiebre o dolor de cabeza.']) + fu(['rioja', 'summa']),
  recoger: () => sec('¿Cortar o arrancar?') + '<div class="esqw">' + cortarSVG() + '</div>' +
    '<p class="note">Hay dos posturas, las dos con fuentes, y no se contradicen: depende de para qué recoges.</p>' +
    '<div class="lib-par"><div class="si"><b>Cortar con navaja</b>Cuando la especie está <b>bien identificada</b> y es para comer: córtala por el pie, sin arrastrar ni dañar el micelio (La Rioja).</div><div class="si"><b>Extraer entera</b>Para <b>estudiar</b> una especie nueva: recoge 4–6 ejemplares completos, con la base, y <b>cubre el hueco con tierra</b> (La Rioja). En las Amanitas, la base (volva) es clave.</div></div>' +
    note('<b>¿Importa de verdad?</b> Un estudio suizo de 27 años que resume la Universidad de Tampere no vio diferencias significativas de producción entre cortar y arrancar. Lo que sí reduce las setas es <b>pisar el terreno</b> y destruir el hábitat. Cortar o arrancar es, según ese texto, una cuestión de preferencia.') +
    sec('Cómo se hace, paso a paso') + pasos([
      ['Busca solo con la vista', 'Sin rastrillos ni azadas, y sin remover el suelo: así proteges el micelio (La Rioja).'],
      ['Mira la seta antes de tocarla', 'Si no la conoces, estúdiala entera. Las dudosas no se mezclan en la cesta.'],
      ['Corta o extrae', 'Corta si conoces la especie; extrae entera si quieres estudiarla. Tapa siempre el hueco.'],
      ['Límpiala allí mismo', 'Con el cepillo: así las esporas y los restos se quedan en el monte. Sin lavarla de más: pierde aroma.'],
      ['Al cesto con las láminas hacia abajo', 'Así no entra tierra ni arena (La Rioja). La cesta deja que las esporas se dispersen por el camino.'],
      ['Separa por especies', 'Y aparta las que no conozcas del resto: las tóxicas no deben tocarse con las que vayas a comer (INT).']]) +
    sec('Qué dejar en el monte') + par('Setas <b>pequeñas</b> sin madurar, <b>primordios</b> y «huevos» (por ejemplo, la Amanita caesarea en huevo).<br>Setas <b>pasadas</b>, blandas, con larvas, con moho o mal olor.<br>Las <b>deterioradas</b>, malformadas o mordisqueadas.<br>Las que <b>no conoces</b>: <b>no las pises ni las destroces</b>, también son parte del bosque.', 'Las <b>muy maduras</b> (sombrero abierto y láminas negras) sueltan muchas esporas y ayudan a regenerar la especie (Consumer).<br>Recoge <b>solo lo que vayas a consumir</b> y deja ejemplares para que se reproduzcan (La Rioja).') +
    sec('Tamaños mínimos (La Rioja)') + '<dl class="kv gl"><dt>3 cm</dt><dd>Calocybe gambosa, níscalos del grupo Dapetes, Pleurotus eryngii, Agrocybe aegerita.</dd><dt>4 cm</dt><dd>Lepista nuda-personata, Clitocybe nebularis, Agaricus, Hygrophorus.</dd><dt>5 cm</dt><dd>Boletus edulis, aestivalis, pinophilus y aereus.</dd><dt>Macrolepiota</dt><dd>Solo con el sombrero ya desplegado.</dd><dt>Boletos</dt><dd>Los que tienen los poros verdes suelen estar parasitados: déjalos.</dd></dl>' +
    fu(['rioja', 'tuni', 'consumer']),
  identificar: () => note('<b>No hay ninguna regla general</b> que distinga una seta comestible de una tóxica: ni el color, ni el tamaño, ni el sabor, ni el olor (La Rioja; Consumer). Hay que aprender a reconocer cada especie.', 'warn') +
    sec('Cómo se aprende') + ul([
      '<b>Dos o tres especies por año</b>, bien aprendidas, y recoge solo las que conozcas con seguridad (Consumer).',
      'Con una <b>guía de campo</b>, mirando <b>todas</b> las características y no solo la foto (La Rioja).',
      'Con <b>cursos</b> o <b>sociedades micológicas</b> cuando haya cualquier duda. Saber lo que se aprende en un vídeo o en una web no basta (INT).',
      'Usa las <b>fichas de esta app</b> para entrenar el ojo: «Qué mirar», «Se confunde con» y «Cuándo se ve».']) +
    sec('Los cinco sitios donde mirar') + ul([
      '<b>Debajo del sombrero</b>: láminas, poros, pliegues o pinchos.',
      '<b>La base del pie</b>: una bolsa (volva) o un bulbo suelen estar bajo tierra. Por eso se desentierra.',
      '<b>El anillo</b> del pie, si lo hay.',
      '<b>La carne</b>: córtala, huélela y mira si cambia de color o suelta leche.',
      '<b>El sitio</b>: bajo qué árbol, en césped o sobre madera.']) +
    sec('La esporada, paso a paso') + '<div class="esqw">' + esporadaSVG() + '</div>' + pasos([
      ['Corta el pie al ras', 'Y deja el sombrero con las láminas (o poros) hacia abajo.'],
      ['Sobre papel mitad blanco, mitad oscuro', 'Así se ve el color de las esporas sea claro u oscuro.'],
      ['Tápalo con un vaso o un cuenco', 'Para que no haya corrientes y no se seque.'],
      ['Espera unas horas', 'Retira el sombrero con cuidado: queda un dibujo del color de las esporas (blanco, crema, rosa, pardo, negro…).']]) +
    '<p class="note">La esporada es uno de los caracteres que separan especies parecidas: por ejemplo, la Armillaria mellea la tiene blanca y la Galerina marginata, pardo-óxido. Cada ficha indica el color cuando se conoce.</p>' + fu(['rioja', 'consumer', 'int']),
  mitos: () => '<p class="sub" style="font-family:inherit">Seis ideas que se repiten mucho y que están desmentidas por las guías oficiales.</p>' +
    [['Si lo ha mordido un bicho, se puede comer', 'Que lo coman animales no dice nada de lo que nos pasará a nosotros. Mordida o con larvas no significa segura.'],
     ['Con una cuchara de plata, ajo o cebolla se detecta una seta tóxica', 'Que ennegrezcan no tiene ningún fundamento.'],
     ['Cocinarla, o ponerla en vinagre o sal, quita el veneno', 'Ni la cocción, ni el vinagre ni la sal vuelven segura una seta tóxica. Las amatoxinas de la Amanita phalloides resisten la cocción.'],
     ['Solo son malas las que cambian de color al cortar', 'Los níscalos cambian de color y no son tóxicos; la Amanita phalloides no cambia y puede ser mortal.'],
     ['Si sabe o huele bien, es buena. Las malas saben mal', 'El sabor y el olor agradables no garantizan nada (La Rioja). Tricholoma pardinum, muy tóxica, huele y sabe bien.'],
     ['Las de pradera son siempre comestibles', 'No hay una regla así: en el césped crecen setas tóxicas, como Clitocybe rivulosa o Agaricus xanthodermus.'],
     ['Las que crecen en madera son todas buenas', 'No todas son tóxicas, pero tampoco todas son comestibles. Y hay una mortal que crece sobre madera: Galerina marginata.'],
     ['Existe un antídoto rápido', 'No lo hay para las amatoxinas ni se puede garantizar la curación con tratamiento (INT; SUMMA 112). Hay que ir a urgencias.']].map(m => '<div class="lib-mito"><div class="m"><b>Mito</b>' + E(m[0]) + '</div><div class="r"><b>Realidad</b>' + E(m[1]) + '</div></div>').join('') + fu(['ocu', 'int', 'rioja', 'summa']),
  casa: () => sec('Conservar') + ul([
    'Al <b>frigorífico lo antes posible</b>, con aireación y sin calor en el trayecto (Consumer). Consúmelas pronto y no las guardes mucho tiempo (La Rioja).',
    '<b>Guarda un ejemplar crudo</b> en el frigorífico: si hay síntomas, servirá para identificar la especie (INT). Avisa a la casa para que nadie lo cocine sin saber lo que es.',
    'Las <b>conservas caseras</b> tienen riesgo de botulismo: extrema las precauciones (La Rioja).']) +
    sec('Cocinar y comer') + ul([
      '<b>Nunca crudas ni poco hechas.</b>',
      '<b>No mezcles especies</b> en el mismo plato (INT).',
      '<b>Sin alcohol</b>: SUMMA 112 avisa de que combinarlas con alcohol puede ser peligroso incluso con especies no tóxicas. Con la Coprinopsis atramentaria, el efecto está demostrado.',
      '<b>Cantidad máxima:</b> la guía de La Rioja dice no más de 200 g a la semana; el Instituto Nacional de Toxicología, unos 250 g. Mejor como acompañamiento.',
      'Aunque sean comestibles, <b>en cantidad cuestan de digerir</b>. Las personas con problemas de riñón, hígado o digestivos deberían evitarlas (La Rioja).',
      'Una persona nueva en las setas: <b>prueba un poco y espera</b>. No las comas por compromiso o cortesía (La Rioja).',
      'Mantén a los <b>niños</b> lejos de las setas silvestres (INT).']) + note('La app nunca dice que una seta se pueda comer. Las candidatas de las fichas siguen «sin confirmar» hasta que ≥2 fuentes y una persona experta las verifiquen.') + fu(['consumer', 'int', 'rioja', 'summa']),
  intox: () => '<div class="dang" style="margin-bottom:12px"><h3>Ante la mínima sospecha: urgencias, ya.</h3><p>No esperes a que «se pase» ni a ver si empeora. Llama al <b>112</b> o ve al hospital más cercano.</p></div>' +
    sec('Qué hacer, por orden') + pasos([
      ['Ve a urgencias o llama al 112', 'Con cualquier síntoma tras comer setas, aunque sea leve (SUMMA 112).'],
      ['Lleva restos de la seta', 'El ejemplar que guardaste crudo en el frigorífico, lo que sobró del plato y, si es posible, los vómitos. En un recipiente de papel, no de plástico (INT; SUMMA 112).'],
      ['Avisa a los demás que comieron', 'Aunque no tengan síntomas todavía: algunas intoxicaciones tardan.'],
      ['No te fíes de remedios caseros', 'No hay antídoto rápido ni tratamiento que garantice la curación (SUMMA 112).']]) +
    sec('Qué contar al personal sanitario') + ul(['Qué setas crees que eran y <b>dónde y en qué hábitat</b> se recogieron.', 'La <b>hora</b> a la que las comisteis y el <b>tiempo</b> hasta los primeros síntomas.', 'Cómo las <b>preparasteis</b> y <b>cuántas veces</b> las comisteis.', 'Cuántas personas las comieron y <b>los síntomas</b> de cada una.', 'Si bebisteis <b>alcohol</b> o comisteis otra cosa.']) +
    sec('Cuándo aparecen los síntomas') + '<dl class="kv gl"><dt>Pronto</dt><dd>De 15 minutos a 6 horas tras comerlas.</dd><dt>Tardíos</dt><dd>De 6 a 24 horas. Suelen ser más graves y a veces tardan hasta 10–15 días.</dd><dt>Mixtos</dt><dd>Con síntomas tempranos y tardíos, por toxinas poco habituales.</dd></dl>' +
    '<p class="note" style="margin-top:8px">Un cuadro que mejora al cabo de unas horas <b>no significa que haya pasado</b>: con la Amanita phalloides hay una falsa mejoría antes de lo peor.</p>' +
    '<p class="note" style="margin-top:8px">También existe el Servicio de Información Toxicológica del Instituto Nacional de Toxicología. Su web no sustituye una llamada. Busca su número oficial y apúntalo antes de salir al monte.</p>' + fu(['summa', 'int']),
  normas: () => note('<b>No lo he podido verificar.</b> No encontré (ni pude abrir) la normativa vigente sobre recolección de setas en Bizkaia ni en Euskadi: cantidades máximas, permisos, zonas vedadas o parques naturales. No te fíes de lo que recuerdes de otros sitios.', 'warn') +
    ul(['Cada <b>territorio y cada parque natural</b> puede tener sus propias reglas. Por ejemplo, en el Parque Natural Sierra Cebollera (La Rioja) hay normas propias de recolección y de circulación por pistas, y se consultan en su centro de interpretación.',
        'Antes de salir, pregunta a la <b>Diputación Foral de Bizkaia</b>, al ayuntamiento o al <b>parque natural</b> donde vayas a ir.',
        'No hagas fuego ni acampes fuera de las zonas habilitadas, y lleva una bolsa para tu basura (La Rioja, para su parque).']) +
    '<p class="note">Cuando lo compruebe con la fuente oficial, esta pantalla se actualizará con el enlace y la fecha.</p>' + fu(['rioja'])
};
export const capHTML = id => {
  const c = cap(id); if (!c) return '';
  const sig = CAPS[CAPS.findIndex(x => x.id === id) + 1];
  return '<div class="lib-h" style="--c:' + c.color + '"><span class="ic">' + c.ico + '</span><div><small>Capítulo ' + c.n + ' de ' + CAPS.length + '</small><h2>' + E(c.titulo) + '</h2></div></div>' + CUERPO[id]() +
    '<div class="row">' + (sig ? '<button class="btn" data-l="' + sig.id + '">Siguiente: ' + E(sig.titulo) + ' ›</button>' : '') + '<button class="btn" data-l="">Índice</button><button class="btn p" id="gu-x">Cerrar</button></div>';
};
export const indiceHTML = () => '<h2>El libro</h2><p class="sub" style="font-family:inherit">Si no sabes nada de setas, empieza por aquí.</p>' +
  '<div class="lib-idx">' + CAPS.map(c => '<button class="lib-card" data-l="' + c.id + '" style="--c:' + c.color + '"><span class="ic">' + c.ico + '</span><div><b>' + c.n + '. ' + E(c.titulo) + '</b><small>' + E(c.sub) + '</small></div></button>').join('') + '</div>' +
  '<div class="row"><button class="btn p" id="gu-x">Cerrar</button></div>';
