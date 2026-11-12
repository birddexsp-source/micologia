/* Guía visual para principiantes: partes de una seta, tipos de himenio, unión de las láminas y glosario. */
import { esc } from './util.js';

/* Cada parte tiene un color; las fichas usan el mismo color en «Qué mirar». */
export const PARTES = {
  sombrero: { n: 1, nombre: 'Sombrero', color: '#e0a458', txt: 'La parte de arriba. Mira su forma, color, tamaño, si es viscoso o seco, y si tiene escamas, verrugas o un bulto central (mamelón).' },
  cutis: { n: 2, nombre: 'Cutícula', color: '#ff7a59', txt: 'La piel del sombrero. En algunas especies se pela con facilidad; eso no dice nada sobre si es comestible.' },
  himenio: { n: 3, nombre: 'Himenio', color: '#4cc3d9', txt: 'Lo que hay debajo del sombrero y produce las esporas: láminas, poros (tubos), pliegues o pinchos. Es de lo primero que hay que mirar.' },
  carne: { n: 4, nombre: 'Carne', color: '#b69cf0', txt: 'El interior. Corta y mira si cambia de color (azulea, enrojece), cómo huele y si suelta leche (látex).' },
  pie: { n: 5, nombre: 'Pie', color: '#7ccf8e', txt: 'El tallo. Fíjate en su forma, si es hueco o macizo, si tiene red (retículo), escamas o color distinto en la base.' },
  anillo: { n: 6, nombre: 'Anillo', color: '#f06292', txt: 'Resto de la membrana que cubría las láminas de joven. Puede ser colgante, móvil o haber desaparecido.' },
  volva: { n: 7, nombre: 'Volva', color: '#d9d95c', txt: 'Bolsa o restos en la base del pie. Suele estar bajo tierra: hay que desenterrar la seta entera. En las Amanitas es clave.' },
  micelio: { n: 8, nombre: 'Micelio', color: '#9aa5a1', txt: 'La «raíz» de la seta, una red de filamentos en el suelo. La seta que ves es solo el fruto.' },
};
/* partes que no son una zona del dibujo pero se usan en las fichas */
export const OTROS = {
  olor: { nombre: 'Olor', color: '#c9b8ff', txt: 'Huele la carne al cortarla. A harina, rábano, fruta, almendra… ayuda a separar especies parecidas.' },
  esporada: { nombre: 'Esporada', color: '#8ad1c2', txt: 'El color del polvo de esporas (blanco, crema, rosa, pardo, negro). Se obtiene dejando el sombrero, láminas hacia abajo, sobre papel unas horas.' },
  habitat: { nombre: 'Hábitat', color: '#a3c46a', txt: 'Dónde crece: bajo qué árbol, en césped, sobre madera, en el suelo o en grupos. Y en qué época.' },
  otro: { nombre: 'Otros', color: '#8a9a95', txt: '' },
};
export const parte = k => PARTES[k] || OTROS[k] || OTROS.otro;

const C = { carne: '#efe3cf', capD: '#a9712f', capL: '#c78a3d', line: '#0a0f0e' };

/* Esquema principal: seta entera, abierta por la mitad (izquierda) para ver la carne. */
export function esquemaSVG() {
  const k = PARTES, pt = (n, x, y) => '<g class="mk"><circle cx="' + x + '" cy="' + y + '" r="11" fill="' + k[n].color + '" stroke="#0a0f0e" stroke-width="2"/><text x="' + x + '" y="' + (y + 4.5) + '" text-anchor="middle" font-size="13" font-weight="800" fill="#0a0f0e">' + k[n].n + '</text></g>';
  const ld = (c, x1, y1, x2, y2) => '<path d="M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2 + '" stroke="' + c + '" stroke-width="2" fill="none"/><circle cx="' + x2 + '" cy="' + y2 + '" r="3.2" fill="' + c + '"/>';
  /* laminillas (vista lateral bajo el sombrero) */
  let gills = ''; for (let x = 178; x <= 264; x += 7) { const y0 = 144 + 12 * (1 - Math.pow((x - 170) / 102, 2)); gills += '<path d="M' + x + ' ' + y0.toFixed(1) + ' L' + x + ' ' + (y0 + 9).toFixed(1) + '" stroke="#5a3d17" stroke-width="2" opacity=".75"/>'; }
  let mic = ''; [[170, 300, 120, 346], [170, 300, 150, 356], [170, 300, 190, 354], [170, 300, 230, 340], [140, 304, 96, 332], [200, 304, 262, 330], [150, 330, 130, 366], [190, 330, 204, 368]].forEach(l => { mic += '<path d="M' + l.slice(0, 2).join(' ') + ' Q' + (l[0] + (l[2] - l[0]) * .3) + ' ' + (l[1] + 24) + ' ' + l[2] + ' ' + l[3] + '" stroke="' + k.micelio.color + '" stroke-width="1.6" fill="none" opacity=".9"/>'; });
  return '<svg class="esq" viewBox="0 0 340 380" role="img" aria-label="Esquema de las partes de una seta: 1 sombrero, 2 cutícula, 3 himenio, 4 carne, 5 pie, 6 anillo, 7 volva, 8 micelio">' +
    '<defs><clipPath id="izq"><rect x="0" y="0" width="170" height="380"/></clipPath><clipPath id="der"><rect x="170" y="0" width="170" height="380"/></clipPath>' +
    '<linearGradient id="gs" x1="0" x2="1"><stop offset="0" stop-color="#cdbf9b"/><stop offset="1" stop-color="#efe6d2"/></linearGradient></defs>' +
    /* suelo */
    '<rect x="0" y="300" width="340" height="80" fill="#15201c"/><path d="M0 300 H340" stroke="#2c3d37" stroke-width="2"/>' + mic +
    /* pie */
    '<path d="M152 150 L148 268 Q140 276 144 300 L196 300 Q200 276 192 268 L188 150 Z" fill="url(#gs)" stroke="' + C.line + '" stroke-width="1.5"/>' +
    '<path d="M152 150 L148 268 Q140 276 144 300 L170 300 L170 150 Z" fill="' + C.carne + '" clip-path="url(#izq)" opacity=".95"/>' +
    '<path d="M159 160 V280 M164 160 V285" stroke="#d5c7a6" stroke-width="1" opacity=".8" clip-path="url(#izq)"/>' +
    '<path d="M176 160 L176 250 M183 168 L182 258" stroke="#b9a981" stroke-width="1" opacity=".6"/>' +
    /* volva */
    '<path d="M126 300 C122 270 134 258 148 266 L192 266 C206 258 218 270 214 300 Z" fill="#cdbf9b" stroke="' + C.line + '" stroke-width="1.5"/>' +
    '<path d="M126 300 C122 270 134 258 148 266 L170 266 L170 300 Z" fill="#e0d2ae" clip-path="url(#izq)"/>' +
    '<path d="M148 266 Q158 258 170 266 Q182 258 192 266" stroke="' + C.line + '" stroke-width="1.2" fill="none"/>' +
    /* anillo */
    '<path d="M146 186 Q170 196 194 186 L208 208 Q170 226 132 208 Z" fill="#f4f0e4" stroke="' + C.line + '" stroke-width="1.5"/><path d="M146 186 Q170 196 194 186" stroke="#bdb59d" stroke-width="1.2" fill="none"/>' +
    '<path d="M137 205 Q170 220 203 205" stroke="#cfc7b0" stroke-width="1.2" fill="none"/>' +
    /* sombrero: derecha exterior, izquierda abierta */
    '<path id="cap" d="M68 144 C66 82 118 50 170 50 C222 50 274 82 272 144 Q170 168 68 144 Z" fill="' + C.capD + '" stroke="' + C.line + '" stroke-width="1.6"/>' +
    '<path d="M68 144 C66 82 118 50 170 50 L170 158 Q118 156 68 144 Z" fill="' + C.carne + '" clip-path="url(#izq)"/>' +
    '<path d="M68 144 C66 82 118 50 170 50 C222 50 274 82 272 144" fill="none" stroke="#ff7a59" stroke-width="4" opacity=".95"/>' +
    '<path d="M110 122 C120 98 150 84 170 84" stroke="#e5d6b8" stroke-width="1.2" fill="none" clip-path="url(#izq)"/>' +
    '<circle cx="216" cy="82" r="5" fill="' + C.capL + '" opacity=".8"/><circle cx="244" cy="104" r="4" fill="' + C.capL + '" opacity=".8"/><circle cx="196" cy="68" r="3.5" fill="' + C.capL + '" opacity=".8"/>' +
    /* himenio */
    '<path d="M68 144 Q170 168 272 144 L266 154 Q170 182 74 154 Z" fill="#d8c59f" stroke="' + C.line + '" stroke-width="1.2"/>' + gills +
    '<path d="M74 154 Q170 182 266 154" stroke="' + C.line + '" stroke-width="1" fill="none" opacity=".5"/>' +
    '<line x1="170" y1="46" x2="170" y2="300" stroke="#0a0f0e" stroke-width="1" stroke-dasharray="3 4" opacity=".35"/>' +
    /* marcas y guías */
    ld(k.sombrero.color, 296, 70, 248, 86) + ld(k.cutis.color, 44, 60, 92, 92) + ld(k.himenio.color, 296, 168, 236, 156) + ld(k.carne.color, 44, 150, 128, 124) +
    ld(k.pie.color, 296, 236, 192, 236) + ld(k.anillo.color, 44, 212, 140, 200) + ld(k.volva.color, 44, 286, 134, 284) + ld(k.micelio.color, 296, 338, 224, 338) +
    pt('sombrero', 306, 70) + pt('cutis', 34, 60) + pt('himenio', 306, 168) + pt('carne', 34, 150) + pt('pie', 306, 236) + pt('anillo', 34, 212) + pt('volva', 34, 286) + pt('micelio', 306, 338) + '</svg>';
}

/* Tipos de himenio vistos desde abajo y tres formas de unión al pie */
function circ(inner) { return '<svg viewBox="0 0 80 80" class="mini"><defs><clipPath id="c80"><circle cx="40" cy="40" r="34"/></clipPath></defs><circle cx="40" cy="40" r="35" fill="#e9dcc3" stroke="#0a0f0e" stroke-width="1.5"/><g clip-path="url(#c80)">' + inner + '</g><circle cx="40" cy="40" r="5" fill="#cdbf9b" stroke="#0a0f0e"/></svg>'; }
export function himenioSVG() {
  let lam = '', por = '', pli = '', pin = '';
  for (let a = 0; a < 360; a += 12) { const r = a * Math.PI / 180; lam += '<path d="M' + (40 + 7 * Math.cos(r)).toFixed(1) + ' ' + (40 + 7 * Math.sin(r)).toFixed(1) + ' L' + (40 + 36 * Math.cos(r)).toFixed(1) + ' ' + (40 + 36 * Math.sin(r)).toFixed(1) + '" stroke="#8a6a3a" stroke-width="1.6"/>'; }
  for (let y = 10; y < 72; y += 6.5) for (let x = 6 + ((y / 6.5 | 0) % 2) * 3.2; x < 76; x += 6.4) por += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2" fill="#8a6a3a"/>';
  for (let a = 0; a < 360; a += 30) { const r = a * Math.PI / 180, m = (a + 15) * Math.PI / 180; pli += '<path d="M' + (40 + 8 * Math.cos(r)).toFixed(1) + ' ' + (40 + 8 * Math.sin(r)).toFixed(1) + ' Q' + (40 + 22 * Math.cos(m)).toFixed(1) + ' ' + (40 + 22 * Math.sin(m)).toFixed(1) + ' ' + (40 + 38 * Math.cos(r)).toFixed(1) + ' ' + (40 + 38 * Math.sin(r)).toFixed(1) + '" stroke="#a9852f" stroke-width="3.2" fill="none" stroke-linecap="round"/>'; }
  for (let y = 9; y < 72; y += 8) for (let x = 7 + ((y / 8 | 0) % 2) * 4; x < 76; x += 8) pin += '<path d="M' + (x - 2.5) + ' ' + (y + 3) + ' L' + x + ' ' + (y - 3.5) + ' L' + (x + 2.5) + ' ' + (y + 3) + ' Z" fill="#8a6a3a"/>';
  const t = [['Láminas', 'Como hojas finas en abanico', lam], ['Poros', 'Agujeritos: son tubos (boletos)', por], ['Pliegues', 'Crestas romas y ramificadas', pli], ['Pinchos', 'Agujas finas colgando', pin]];
  return '<div class="tiles">' + t.map(x => '<div class="tile">' + circ(x[2]) + '<b>' + x[0] + '</b><small>' + x[1] + '</small></div>').join('') + '</div>';
}
export function unionSVG() {
  const base = (g, t) => '<svg viewBox="0 0 100 84" class="mini"><path d="M0 14 H100" stroke="#0a0f0e" stroke-width="1" opacity=".3"/><path d="M0 6 Q50 0 100 12 L100 24 Q50 22 0 24 Z" fill="#a9712f" stroke="#0a0f0e"/><rect x="42" y="24" width="16" height="58" fill="#efe3cf" stroke="#0a0f0e" stroke-width="1.2"/>' + g + '</svg><b>' + t + '</b>';
  const L = (d) => '<path d="' + d + '" fill="#d8c59f" stroke="#0a0f0e" stroke-width="1"/>';
  return '<div class="tiles t3">' +
    '<div class="tile">' + base(L('M4 22 L36 22 L36 30 Q20 32 4 28 Z') + L('M96 22 L64 22 L64 30 Q80 32 96 28 Z'), 'Libres') + '<small>No tocan el pie</small></div>' +
    '<div class="tile">' + base(L('M4 22 L42 22 L42 34 Q20 32 4 28 Z') + L('M96 22 L58 22 L58 34 Q80 32 96 28 Z'), 'Adheridas') + '<small>Llegan al pie</small></div>' +
    '<div class="tile">' + base(L('M4 22 L42 22 L42 52 Q20 32 4 28 Z') + L('M96 22 L58 22 L58 52 Q80 32 96 28 Z'), 'Decurrentes') + '<small>Bajan por el pie</small></div></div>';
}
export const GLOSARIO = [
  ['Mamelón (umbo)', 'Bulto o punta en el centro del sombrero.'],
  ['Escamas / verrugas', 'Restos de velo sobre el sombrero. En la Amanita muscaria son las motas blancas.'],
  ['Velo', 'Membrana que protege la seta joven. Deja el anillo (velo parcial) y la volva (velo universal).'],
  ['Retículo', 'Red en relieve sobre el pie de algunos boletos.'],
  ['Látex', 'Líquido (leche) que sueltan algunas setas al cortarlas, por ejemplo los níscalos. Mira su color.'],
  ['Esporada', 'Huella de esporas: pon el sombrero con las láminas hacia abajo sobre papel (mejor mitad blanco y mitad oscuro) unas horas.'],
  ['Micorriza', 'Asociación de la seta con las raíces de un árbol. Por eso cada especie busca «su» árbol.'],
  ['Lignícola', 'Que crece sobre madera, a veces enterrada, y parece salir del suelo.'],
  ['Corro de brujas', 'Círculo de setas en el césped. Ojo: varias especies parecidas lo forman.'],
  ['Carne', 'Interior. Cámbiala de sitio al cortar: azulea, enrojece o no cambia.'],
];
const CONSEJOS = [
  'Recoge la seta entera, con la base del pie, para poder verla bien. No la cortes por el suelo.',
  'Lleva cesta o caja ventilada y separa cada especie. Evita bolsas de plástico.',
  'Haz fotos de arriba, de las láminas/poros y de la base antes de recogerla.',
  'Para dudas, lleva el ejemplar entero a una sociedad micológica o a una persona experta.',
];

export function guiaHTML(sel) {
  const ps = Object.values(PARTES);
  return '<h2>Partes de una seta</h2><p class="sub" style="font-family:inherit">Las fichas usan estos mismos nombres y colores.</p>' +
    '<div class="esqw">' + esquemaSVG() + '</div>' +
    '<div class="leg">' + ps.map(p => '<div class="lg' + (sel && PARTES[sel] === p ? ' on' : '') + '"><span class="mk" style="--c:' + p.color + '">' + p.n + '</span><div><b>' + esc(p.nombre) + '</b><small>' + esc(p.txt) + '</small></div></div>').join('') + '</div>' +
    '<div class="sec">Debajo del sombrero</div>' + himenioSVG() +
    '<div class="sec">Cómo se unen las láminas al pie</div>' + unionSVG() +
    '<div class="sec">Qué mirar además</div><div class="leg">' + ['olor', 'esporada', 'habitat'].map(k => '<div class="lg' + (sel === k ? ' on' : '') + '"><span class="mk sm" style="--c:' + OTROS[k].color + '"></span><div><b>' + OTROS[k].nombre + '</b><small>' + esc(OTROS[k].txt) + '</small></div></div>').join('') + '</div>' +
    '<div class="sec">Palabras que vas a leer</div><dl class="kv gl">' + GLOSARIO.map(g => '<dt>' + esc(g[0]) + '</dt><dd>' + esc(g[1]) + '</dd>').join('') + '</dl>' +
    '<div class="sec">Cómo recoger para identificar</div><div class="note"><ul style="margin:0;padding-left:18px">' + CONSEJOS.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul></div>' +
    '<div class="row"><button class="btn p" id="gu-x">Cerrar</button></div>';
}
