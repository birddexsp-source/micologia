/* Piezas visuales del catálogo: fotos con crédito, ficha completa, tarjetas de especie. Solo construye HTML. */
import * as cat from './catalog.js';
import { esc } from './util.js';
import { parte } from './guia.js';
import { esquemaEsp, partesDe, rasgos } from './esquema.js';
import { barrasHTML, fuenteTxt, datos, mesNombre, MESES } from './temporada.js';
import { H, GRUPOS, ARBOL, CONSEJOS, dondeSimple, GREMIO, gremioNom } from './habitat.js';

/* Commons: {w} = ancho en px · iNaturalist: {s} = small (240) / medium (500) / large (1024) */
export const fotoURL = (f, w) => f.url.includes('{s}') ? f.url.replace('{s}', w <= 250 ? 'small' : w <= 500 ? 'medium' : 'large') : f.url.replace('{w}', w);
export const credito = f => f.autor + ' · ' + f.licencia + ' · ' + f.origen;
/* Foto con marco: si falla la carga (sin red y sin caché) se queda el marco con la silueta de seta */
export function foto(f, w, { cls = '', alt = '' } = {}) {
  return '<span class="phw ' + cls + '"><img class="ph" src="' + esc(fotoURL(f, w)) + '" alt="' + esc(alt || f.sp) + '" loading="lazy" decoding="async" crossorigin="anonymous"></span>';
}
export const avatar = (e, w = 250) => e.fotos && e.fotos[0] ? foto(e.fotos[0], w, { cls: 'av', alt: e.nombreCientifico }) : '<span class="phw av"></span>';
export const tag = c => '<span class="tag" style="--c:' + cat.CLASES[c].color + '">' + cat.CLASES[c].label + '</span>';
/* Las candidatas no se presentan nunca como comestibles: chip propio mientras no haya ≥2 fuentes y revisión experta */
export const tagEsp = (e, largo) => e.comestibilidad ? '<span class="tag" style="--c:' + cat.CLASES[cat.vista(e)].color + '">' + (largo ? cat.CLASES[cat.vista(e)].label + ' · según fuentes' : e.comestibilidad.nivel === 'si' ? 'Comestible' : 'Con condiciones') + '</span>' : e.clase === 'sin_datos' && e.candidataComestible ? '<span class="tag cand">Candidata · sin confirmar</span>' : tag(e.clase);
export const nombres = e => [...(e.nombresComunes.es || []).slice(0, 2), ...(e.nombresComunes.eu || []).slice(0, 2)].join(' · ');
const nombresHTML = e => { const n = e.nombresComunes || {}, g = (l, xs) => xs && xs.length ? '<span class="nm"><b>' + l + '</b>' + xs.map(esc).join(' · ') + '</span>' : ''; return g('ES', n.es) + g('EU', n.eu); };
const GRAV = { alta: ['Riesgo alto', '#e5484d'], media: ['Riesgo medio', '#f08a3c'] };

function hero(e) {
  const fs = e.fotos || []; if (!fs.length) return '';
  return '<div class="hero" id="hero">' + fs.map((f, i) => '<figure>' + foto(f, 960, { cls: 'big', alt: f.sp }) + '<figcaption><b>' + esc(f.sp) + '</b><span>' + esc(credito(f)) + '</span></figcaption></figure>').join('') + '</div>' +
    (fs.length > 1 ? '<div class="dots" id="dots">' + fs.map((_, i) => '<i' + (i ? '' : ' class="on"') + '></i>').join('') + '</div>' : '');
}
function queMirar(e) {
  const q = e.queMirar || []; if (!q.length) return '<div class="empty" style="padding:6px 0;text-align:left">Aún no hay rasgos de identificación para esta ficha.</div>';
  const dib = !!rasgos(e), DIB = ['sombrero', 'cutis', 'himenio', 'pie', 'anillo', 'volva', 'carne'];
  return '<ol class="qm' + (dib ? ' dib' : '') + '">' + q.map(x => { const p = parte(x.parte); return '<li>' + (dib ? '<span class="qd">' + (DIB.includes(x.parte) ? esquemaEsp(e, [x.parte], { talla: 64 }) : '<span class="qi" style="--c:' + p.color + '">' + (ICOP[x.parte] || '') + '</span>') + '</span>' : '') + '<button class="pt" data-g="' + esc(x.parte) + '" style="--c:' + p.color + '" aria-label="Ver «' + esc(p.nombre) + '» en la guía">' + esc(p.nombre) + '</button><div><b>' + esc(x.titulo) + '</b><span>' + esc(x.texto) + '</span></div></li>'; }).join('') + '</ol>';
}
const ICOP = {
  olor: '<svg viewBox="0 0 24 24"><path d="M9 4c-1 3 0 5 1 7s1 5-1 7M13 4c-1 3 0 5 1 7s1 5-1 7M17 6c-.7 2 0 3.500.7 5s.7 3.500-.7 5"/></svg>',
  esporada: '<svg viewBox="0 0 24 24"><rect x="3" y="15" width="18" height="5" rx="1"/><path d="M6 11c3-6 9-6 12 0z"/><circle cx="9" cy="17.500" r=".8"/><circle cx="13" cy="17.500" r=".8"/><circle cx="16" cy="17.500" r=".8"/></svg>',
  habitat: '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="6"/><path d="M12 15v6M4 21h16"/></svg>',
  otro: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M16 16l5 5"/></svg>'
};
const PELIG = o => o && (o.clase === 'mortal' || o.clase === 'toxica');
function confusiones(e) {
  const cs = e.confusiones || []; if (!cs.length) return '';
  return cs.map(c => {
    const o = c.id ? cat.byId(c.id) : null, g = GRAV[c.gravedad];
    return '<div class="conf fc">' +
      (o ? '<div class="cmp"><figure class="' + (PELIG(e) ? 'no' : 'si') + '">' + (e.fotos && e.fotos[0] ? foto(e.fotos[0], 250, { alt: e.nombreCientifico }) : '<span class="phw"></span>') + '<figcaption><b>' + (PELIG(e) ? '✗ Esta es ' + (e.clase === 'mortal' ? 'mortal' : 'tóxica') : '✓ Esta') + '</b>' + esc(e.nombreCientifico.split(' (')[0].split(' / ')[0]) + '</figcaption></figure><span class="vs">vs</span><figure class="' + (PELIG(o) ? 'no' : 'si') + '">' + (o.fotos && o.fotos[0] ? foto(o.fotos[0], 250, { alt: o.nombreCientifico }) : '<span class="phw"></span>') + '<figcaption><b>' + (PELIG(o) ? '✗ ' + (o.clase === 'mortal' ? 'Mortal' : 'Tóxica') : 'Parecida') + '</b>' + esc(o.nombreCientifico.split(' (')[0].split(' / ')[0]) + '</figcaption></figure></div>' : '') +
      '<div class="ch"><b>' + esc(c.nombre) + '</b>' + (g ? '<span class="tag" style="--c:' + g[1] + '">' + g[0] + '</span>' : '') + '</div>' +
      '<p>' + esc(c.comoDistinguir) + '</p>' + (o ? '<button class="lnk" data-e="' + o.id + '">Ver ficha de ' + esc(o.nombreCientifico.split(' (')[0].split(' / ')[0]) + ' ›</button>' : '<small class="mut">Sin ficha en el catálogo todavía.</small>') + '</div>';
  }).join('');
}

/* Hábitat con iconos: árbol de hoja ancha, conífera, mixto, prado, camino, madera, fuego */
const ICO = {
  fron: '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="6"/><path d="M12 15v6"/></svg>',
  conif: '<svg viewBox="0 0 24 24"><path d="M12 3l6 9H6zM12 9l7 9H5zM12 18v3"/></svg>',
  mixto: '<svg viewBox="0 0 24 24"><circle cx="8" cy="10" r="4.500"/><path d="M8 14.500V20M17 5l4.500 8h-9zM17 13v7"/></svg>',
  prado: '<svg viewBox="0 0 24 24"><path d="M3 20h18M6 20c0-4 1-6 2-8M10 20c0-5 1-8 2-11M14 20c0-4 1-7 3-9M18 20c0-3 .5-4.500 1.500-6"/></svg>',
  camino: '<svg viewBox="0 0 24 24"><path d="M9 21l2-18M15 21l-2-18M12 7v2M12 12v2M12 17v2"/></svg>',
  madera: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="8" rx="3"/><circle cx="18" cy="13" r="2"/><path d="M7 9V6M11 9V5"/></svg>',
  fuego: '<svg viewBox="0 0 24 24"><path d="M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z"/></svg>',
};
const HAB = {
  robledal: ['Robledal', 'fron'], encinar: ['Encinar', 'fron'], hayedo: ['Hayedo', 'fron'], castanar: ['Castañar', 'fron'], abedular: ['Abedular', 'fron'], frondosas: ['Frondosas', 'fron'], arbol_vivo: ['Árbol vivo', 'madera'],
  pinar: ['Pinar', 'conif'], abetal: ['Abetal', 'conif'], coniferas: ['Coníferas', 'conif'], mixto: ['Bosque mixto', 'mixto'], bosque: ['Bosque', 'mixto'],
  prado: ['Prados', 'prado'], claro: ['Claros', 'prado'], parque: ['Parques y jardines', 'prado'], brezal: ['Brezal', 'prado'], huerto: ['Huertos', 'prado'], cuneta: ['Caminos y cunetas', 'camino'], madera: ['Sobre madera', 'madera'], quemado: ['Zonas quemadas', 'fuego']
};
const habitat = e => {
  const hs = (e.habitats || []).filter(h => H[h] && HAB[h]), donde = dondeSimple(e); if (!hs.length && !e.habitatTexto) return '';
  return card('hab', 'Dónde mirar', (donde ? '<p class="hb-donde"><b>Mira ' + esc(donde) + '.</b></p>' : '') +
    (hs.length ? '<div class="habs">' + hs.map(h => '<button class="hab" data-h="' + h + '"><i>' + ICO[HAB[h][1]] + '</i>' + esc(H[h].nombre) + '<em>›</em></button>').join('') + '</div><p class="hb-tip">Toca un sitio para saber cómo reconocerlo y dónde mirar.</p>' : '')) +
    (e.habitatTexto ? card('info', 'Detalle del hábitat', '<p class="fc-p">' + esc(e.habitatTexto) + '</p>') : '');
};
/* ---------- hoja de un hábitat: qué es, cómo se reconoce, dónde mirar y qué setas hay ---------- */
const lista = xs => '<ul class="hb-l">' + xs.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
const espHab = (id, e) => (e.habitats || []).includes(id);
const filaEsp = e => { const c = nombres(e).split(' · ')[0] || e.nombreCientifico, cien = e.nombreCientifico.split(' (')[0]; return '<button class="hb-sp" data-e="' + e.id + '">' + avatar(e, 250) + '<div class="t"><b>' + esc(c[0].toUpperCase() + c.slice(1)) + '</b><small><i>' + esc(cien) + '</i></small></div>' + tagEsp(e) + '</button>'; };
export function habitatHTML(id, { volver = '' } = {}) {
  const h = H[id]; if (!h) return '';
  const todas = cat.todas().filter(e => espHab(id, e)), pel = todas.filter(PELIG), otras = todas.filter(e => !PELIG(e));
  const vis = otras.slice(0, 10), mas = otras.slice(10);
  return '<h2 class="hb-h"><i class="hb-i">' + ICO[h.icono] + '</i>' + esc(h.nombre) + '</h2><p class="hb-q">' + esc(h.que) + '</p>' +
    '<div class="sec">Cómo lo reconoces</div>' + lista(h.reconoce) + '<div class="sec">Dónde mirar</div>' + lista(h.mirar) +
    (h.bizkaia ? '<div class="sec">Por aquí</div><p class="note">' + esc(h.bizkaia) + ' <small>(Orientativo.)</small></p>' : '') +
    (h.ojo ? '<div class="note hb-ojo">⚠ ' + esc(h.ojo) + '</div>' : '') +
    '<div class="sec">Setas que salen aquí (' + otras.length + ')</div>' + (otras.length ? '<div class="hb-ls">' + vis.map(filaEsp).join('') + '</div>' + (mas.length ? '<details class="det"><summary>Ver las ' + mas.length + ' restantes</summary><div class="hb-ls">' + mas.map(filaEsp).join('') + '</div></details>' : '') : '<p class="note">Ninguna de la colección está marcada en este sitio.</p>') +
    (pel.length ? '<div class="sec" style="color:#e0a458">⚠ Tóxicas y mortales que también salen aquí (' + pel.length + ')</div><div class="hb-ls">' + pel.map(filaEsp).join('') + '</div>' : '') +
    '<p class="note">Que una seta salga en un sitio no significa que se pueda comer. Identifica siempre con su ficha y, si dudas, no la cojas.</p>' +
    '<div class="row">' + (volver ? '<button class="btn" id="hb-b">‹ Volver</button>' : '') + '<button class="btn p" id="hb-x">Cerrar</button></div>';
}
/* ---------- «¿Dónde busco?»: guía general de principiante ---------- */
export function dondeBuscarHTML() {
  return '<h2 class="hb-h">¿Dónde busco setas?</h2><p class="hb-q">Casi todas las setas viven pegadas a algo concreto: un tipo de árbol, la hierba o la madera. Si sabes qué tienes delante, sabes qué setas puedes encontrar.</p>' +
    '<div class="sec">Reconocer el árbol en 10 segundos</div><div class="hb-ar">' + ARBOL.map(a => '<div><b>' + esc(a[0]) + '</b><span>' + esc(a[1]) + '</span></div>').join('') + '</div>' +
    GRUPOS.map(g => '<div class="sec">' + esc(g.t) + '</div><p class="hb-s">' + esc(g.s) + '</p><div class="hb-gr">' + Object.keys(H).filter(k => H[k].grupo === g.id).map(k => '<button class="hab" data-h="' + k + '"><i>' + ICO[H[k].icono] + '</i>' + esc(H[k].nombre) + '<em>›</em></button>').join('') + '</div>').join('') +
    '<div class="sec">Consejos para salir</div>' + lista(CONSEJOS) +
    '<div class="row"><button class="btn p" id="hb-x">Cerrar</button></div>';
}
export { H, GRUPOS, GREMIO, gremioNom, dondeSimple };
/* Color del polvo de esporas, para pintar la muestra. Si no se reconoce, no se pinta. */
const ESPC = [['negro', '#26212a'], ['oliva', '#6f6a3a'], ['oscuro', '#4a3226'], ['chocolate', '#4a3226'], ['blanc', '#f4f1ea'], ['crema', '#efe2c0'], ['amarill', '#e6cf7a'], ['naranja', '#e8a15a'], ['rosa', '#e6b8b0'], ['lila', '#bfb0d0'], ['pardo', '#7a5a3c']];
export const colorEsp = t => { const n = (t || '').toLowerCase(); const m = ESPC.find(([k]) => n.includes(k)); return m ? m[1] : null; };
const esporada = e => {
  if (!e.esporada) return '';
  const c = colorEsp(e.esporada);
  return '<div class="esp"><span class="sw" style="' + (c ? 'background:' + c : 'background:var(--s3)') + '"></span><div><small>Esporada</small><b>' + esc(e.esporada) + '</b></div><button class="lnk" data-g="esporada">Qué es ›</button></div>';
};
const RECO = { cortar: ['Cortar con navaja', '#7ccf8e', '<path d="M4 20L20 4M14 4h6v6"/>'], extraer: ['Sacar entera', '#e0a458', '<path d="M12 21V8M12 8l-4 4M12 8l4 4M5 3h14"/>'], dejar: ['No recoger', '#e5484d', '<circle cx="12" cy="12" r="9"/><path d="M5.600 5.600l12.800 12.800"/>'] };
const recoger = e => {
  const r = e.recoleccion; if (!r) return '';
  const a = RECO[r.acc] || RECO.dejar;
  return '<div class="recog" style="--c:' + a[1] + '"><div class="rh"><svg viewBox="0 0 24 24">' + a[2] + '</svg><b>' + a[0] + '</b></div><p>' + esc(r.txt) + '</p><button class="lnk" data-l="recoger">Cortar o arrancar, paso a paso ›</button></div>';
};
const curiosidades = e => (e.curiosidades && e.curiosidades.length) ? '<ol class="curi">' + e.curiosidades.map(c => '<li>' + esc(c) + '</li>').join('') + '</ol>' : '';
const comestible = e => { const m = e.comestibilidad, k = cat.CLASES[cat.vista(e)]; return '<div class="com" style="--c:' + k.color + '"><div class="ch"><svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg><b>' + esc(k.label) + '</b></div><p>' + esc(m.txt) + '</p><small>Fuente: ' + esc(m.segun) + '. La ficha sigue en borrador.</small><button class="lnk" id="fi-antes">Antes de comer ›</button></div>'; };
const peligroConf = e => (e.confusiones || []).some(c => c.gravedad === 'alta') && e.clase !== 'mortal' && e.clase !== 'toxica';
const RASGOS = [['sombrero', 'Sombrero'], ['himenio', 'Himenio'], ['reticulo', 'Retículo'], ['pie', 'Pie'], ['anillo', 'Anillo'], ['volva', 'Volva'], ['carne', 'Carne'], ['olor', 'Olor'], ['esporada', 'Esporada'], ['habitat', 'Hábitat']];

/* números del dibujo de la regla clave */
function leyenda(e) {
  if (!rasgos(e)) return ''; const ps = partesDe(e.clave); if (ps.length < 2) return '';
  return '<div class="clv-l">' + ps.map((p, i) => '<span style="--c:' + parte(p).color + '"><i>' + (i + 1) + '</i>' + esc(parte(p).nombre) + '</span>').join('') + '</div>';
}
/* Fotos reales con los rasgos señalados (puntos numerados sobre la foto) */
/* Fotos con flechas: cada punto marca el sitio exacto (x, y en % de la foto) con un aro y una línea hasta su número.
   `d` dice hacia dónde sale el número (arriba, abajo, izq, der o combinaciones); por defecto, arriba (abajo si está muy arriba). */
const ANG = { der: 0, 'abajo-der': 45, abajo: 90, 'abajo-izq': 135, izq: 180, 'arriba-izq': -135, arriba: -90, 'arriba-der': -45 };
/* el número nunca se sale de la foto: si el punto está pegado a un borde, se le da la vuelta */
function angulo(p) {
  let a = ANG[p.d] != null ? ANG[p.d] : p.y < 18 ? 90 : -90;
  const dx = Math.cos(a * Math.PI / 180), dy = Math.sin(a * Math.PI / 180);
  const fx = (p.x < 20 && dx < -0.3) || (p.x > 80 && dx > 0.3), fy = (p.y < 24 && dy < -0.3) || (p.y > 76 && dy > 0.3);
  if (fx || fy) a = Math.round(Math.atan2(fy ? -dy : dy, fx ? -dx : dx) * 180 / Math.PI);
  return a;
}
function anotadas(e) {
  const A = e.anotadas || []; if (!A.length) return '';
  return A.map(a => '<figure class="anot">' + (a.titulo ? '<b class="a-t">' + esc(a.titulo) + '</b>' : '') + '<span class="anw"' + (a.foto.ar ? ' style="--ar:' + a.foto.ar + '"' : '') + '>' + foto(a.foto, 960, { cls: 'big', alt: e.nombreCientifico + (a.titulo ? ': ' + a.titulo : '') }) +
    a.puntos.map((p, i) => '<span class="ap" style="left:' + p.x + '%;top:' + p.y + '%;--c:' + parte(p.parte).color + ';--a:' + angulo(p) + 'deg"><i class="ap-l"></i><i class="ap-p"></i><b class="ap-n">' + (i + 1) + '</b></span>').join('') + '</span>' +
    '<ol class="apl">' + a.puntos.map((p, i) => '<li style="--c:' + parte(p.parte).color + '"><i>' + (i + 1) + '</i><span><b>' + esc(p.titulo) + '</b>' + (p.texto ? ' ' + esc(p.texto) : '') + '</span></li>').join('') + '</ol>' +
    (a.ojo ? '<p class="a-ojo">⚠ ' + esc(a.ojo) + '</p>' : '') +
    '<figcaption>' + esc(a.foto.sp) + ' · ' + esc(a.foto.autor) + ' · ' + esc(a.foto.licencia) + '</figcaption></figure>').join('');
}
/* ---------- estructura: cabecera fija, resumen rápido y pestañas; dentro, tarjetas con el mismo formato ---------- */
const sv = d => '<svg viewBox="0 0 24 24">' + d + '</svg>';
const FI = {
  lista: sv('<path d="M9 6h12M9 12h12M9 18h12M4 6h.5M4 12h.5M4 18h.5"/>'), foto: sv('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.500"/>'),
  hab: sv('<path d="M12 21V11M12 11c0-5 3-7 8-7 0 5-2 8-8 7zM12 15c0-4-2-6-7-6 0 4 2 7 7 6z"/>'), info: sv('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>'),
  cal: sv('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'), nube: sv('<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.500-1A4.500 4.500 0 0 1 17 18z"/><path d="M9 21v-2M13 21v-2"/>'),
  ok: sv('<path d="M5 13l4 4L19 7"/>'), corta: sv(RECO.cortar[2]), aviso: sv('<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>'),
  estrella: sv('<path d="M12 3l2.800 5.800 6.200.9-4.500 4.400 1 6.200L12 17.400 6.500 20.300l1-6.200L3 9.700l6.200-.9z"/>'), libro: sv('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19a2 2 0 0 1 2-2h13"/>'),
  nombre: sv('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.500" cy="8.500" r="1"/>'), pares: sv('<circle cx="8" cy="12" r="5"/><circle cx="16" cy="12" r="5"/>'), dato: sv('<path d="M4 6h16M4 12h16M4 18h10"/>')
};
const card = (ic, t, body, o = {}) => body ? '<section class="fc' + (o.cls ? ' ' + o.cls : '') + '"><header class="fc-h"><i>' + FI[ic] + '</i><h3>' + t + '</h3>' + (o.sub ? '<small>' + o.sub + '</small>' : '') + '</header>' + body + '</section>' : '';
/* meses de pleno: «Sep–Nov» */
function rangoMeses(e) {
  const niv = datos(e).niv, mx = Math.max(...niv.map(x => x.nivel)); if (!mx) return '';
  const on = niv.map(x => x.nivel === mx), runs = []; on.forEach((v, i) => { if (v) { const l = runs[runs.length - 1]; if (l && l[1] === i - 1) l[1] = i; else runs.push([i, i]); } });
  const ab = m => cap3(MESES[m]); return runs.slice(0, 2).map(([a, b]) => a === b ? ab(a) : ab(a) + '–' + ab(b)).join(' y ');
}
const cap3 = x => x[0].toUpperCase() + x.slice(1, 3);
function resumen(e) {
  const hs = (e.habitats || []).filter(h => H[h]), gen = new Set(['frondosas', 'coniferas', 'bosque', 'mixto']), pri = hs.find(h => !gen.has(h)) || hs[0];
  const c = cat.CLASES[cat.vista(e)], mes = rangoMeses(e);
  const t = (ft, ic, l, v, st) => '<button class="rs" data-ft="' + ft + '"' + (st ? ' style="--c:' + st + '"' : '') + '><i>' + FI[ic] + '</i><small>' + l + '</small><b>' + esc(v) + '</b></button>';
  return '<div class="rsm">' + t('hab', 'hab', 'Dónde', pri ? H[pri].nombre.replace(/ \(.*\)$/, '') + (hs.length > 1 ? ' +' + (hs.length - 1) : '') : 'Sin datos') + t('cuando', 'cal', 'Cuándo', mes || 'Sin datos') + t('comer', 'ok', 'Comer', c.label, c.color) + '</div>';
}
export const PESTANAS = [['ident', 'Identificar'], ['conf', 'Confusiones'], ['hab', 'Hábitat'], ['cuando', 'Cuándo'], ['comer', 'Recoger y comer'], ['mas', 'Más']];
function paneles(e, mes) {
  const td = datos(e), ras = RASGOS.filter(([k]) => e[k]), peligro = e.clase === 'mortal' || e.clase === 'toxica';
  const fuFotos = (e.fotos || []).map(f => '<li>' + esc(f.sp) + ': ' + esc(f.autor) + ', <a href="' + esc(f.licenciaUrl || f.pagina) + '" target="_blank" rel="noopener">' + esc(f.licencia) + '</a>, <a href="' + esc(f.pagina) + '" target="_blank" rel="noopener">Commons</a></li>').join('');
  const fu = e.fuentes.filter(f => !/Commons/.test(f.nombre)).map(f => '<div class="fc-src"><b>' + esc(f.nombre) + '</b>' + (f.fechaConsulta ? ' <small>· ' + esc(f.fechaConsulta) + '</small>' : '') + (f.url ? '<a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.url) + '</a>' : '') + (f.nota ? '<small>' + esc(f.nota) + '</small>' : '') + '</div>').join('');
  const fr = e.fructificacion, frFu = fr && fr.fuentes && fr.fuentes.length ? fr.fuentes.map(x => '<div class="fc-src"><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.t) + '</a></div>').join('') : '';
  const comer = (e.comestibilidad ? card('ok', 'Comestibilidad', comestible(e)) : e.notaComestibilidad ? card('ok', 'Comestibilidad', '<p class="fc-p">' + esc(e.notaComestibilidad) + '</p>') : '') +
    (e.candidataComestible && !e.comestibilidad ? card('aviso', 'Antes de comer', '<p class="fc-p">Esta seta es candidata a comestible, pero no está confirmada.</p><div class="row"><button class="btn big" id="fi-antes">Antes de comer</button></div>') : '') +
    (e.sindrome ? card('aviso', 'Si es tóxica', '<dl class="kv"><dt>Síndrome</dt><dd>' + esc(e.sindrome) + '</dd>' + (e.latencia ? '<dt>Aparece a las</dt><dd>' + esc(e.latencia) + '</dd>' : '') + (e.gravedad ? '<dt>Gravedad</dt><dd>' + esc(e.gravedad) + '</dd>' : '') + '</dl><p class="fc-p">Intoxicación: urgencias ya (112), con restos de la seta y la hora de ingestión. No esperar a que «pase».</p>', { cls: 'tox' }) : '') +
    card('corta', 'Cómo recogerla', recoger(e));
  const P = {
    ident: card('lista', 'Qué mirar', queMirar(e) + esporada(e) + '<div class="row"><button class="btn" data-g="">Ver las partes de la seta</button></div>') + card('foto', 'En la foto: dónde mirar', anotadas(e)),
    conf: (e.confusiones || []).length ? '<p class="fp-intro">Estas setas se parecen a esta. Compara las diferencias antes de decidir nada.</p>' + confusiones(e) : '',
    hab: habitat(e),
    cuando: card('cal', 'Meses del año', td.hay ? barrasHTML(e, mes) + '<p class="fc-p">' + esc(fuenteTxt(e)) + '</p>' : '<p class="fc-p">' + esc(fuenteTxt(e)) + '</p>') + cuandoSale(e),
    comer: comer,
    mas: card('estrella', 'Curiosidades', curiosidades(e)) + card('nombre', 'Sobre el nombre', e.notaNomenclatura ? '<p class="fc-p">' + esc(e.notaNomenclatura) + '</p>' : '') +
      card('dato', 'Datos del catálogo inicial', ras.length ? '<details class="det"><summary>Ver el borrador (' + ras.length + ' datos)</summary><dl class="kv" style="margin-top:8px">' + ras.map(([k, l]) => '<dt>' + l + '</dt><dd>' + esc(e[k]) + '</dd>').join('') + '</dl></details>' : '') +
      card('libro', 'Fuentes', fu + (frFu ? '<small class="fc-sub">Para el tiempo que necesita:</small>' + frFu : '')) +
      card('foto', 'Créditos de las fotos', fuFotos ? '<ul class="cred">' + fuFotos + '</ul><small class="fc-sub">Fotos orientativas de otros autores (Wikimedia Commons). No confirman una identificación.</small>' : '')
  };
  return { P, peligro };
}
export function fichaHTML(e, mes) {
  const c = cat.CLASES[cat.vista(e)], { P, peligro } = paneles(e, mes), nConf = (e.confusiones || []).length, grave = (e.confusiones || []).some(x => x.gravedad === 'alta');
  const tabs = PESTANAS.filter(([k]) => P[k]);
  return hero(e) +
    '<div class="fh" style="--c:' + c.color + '"><div class="chips">' + tagEsp(e, true) + '<span class="tag" style="--c:#3a4743">' + esc(cat.NIVELES[e.nivelVerificacion] || e.nivelVerificacion) + '</span>' + (peligroConf(e) ? '<span class="tag" style="--c:#e5484d">Se confunde con tóxicas</span>' : '') + '</div>' +
    '<h2><i>' + esc(e.nombreCientifico) + '</i></h2>' + (nombresHTML(e) ? '<div class="nms">' + nombresHTML(e) + '</div>' : '') + (e.familia ? '<div class="famc"><span>Familia <b>' + esc(e.familia) + '</b></span><span style="--c:' + cat.coleccion(e).color + '">' + esc(cat.coleccion(e).titulo) + '</span></div>' : '') + '</div>' +
    (e.clave ? '<div class="clave' + (peligro ? ' pel' : '') + '"><small>' + (peligro ? 'Lo primero que hay que saber' : 'Lo primero que hay que mirar') + '</small><div class="clv"><b>' + esc(e.clave) + '</b>' + (rasgos(e) ? '<span class="clv-d">' + esquemaEsp(e, partesDe(e.clave), { talla: 112 }) + '</span>' : '') + '</div>' + leyenda(e) + '</div>' : '') +
    '<div class="warn">' + esc(cat.aviso()) + '</div>' + resumen(e) +
    '<nav class="ftabs" id="ftabs" role="tablist">' + tabs.map(([k, n], i) => '<button role="tab" class="ft' + (i ? '' : ' on') + (k === 'conf' && grave ? ' grave' : '') + '" data-ft="' + k + '" aria-selected="' + (i ? 'false' : 'true') + '">' + n + (k === 'conf' ? '<em>' + nConf + '</em>' : '') + '</button>').join('') + '</nav>' +
    tabs.map(([k], i) => '<div class="fp" role="tabpanel" data-fp="' + k + '"' + (i ? ' hidden' : '') + '>' + P[k] + '</div>').join('');
}
export { mesNombre };

/* Cuándo sale: condiciones de tiempo (lluvia, temperatura, helada) según el gremio de la especie. Lo medido va separado de las hipótesis. */
function cuandoSale(e) {
  const f = e.fructificacion; if (!f) return '';
  const est = f.base === 'estudio', li = f.texto.map(t => { const i = t.indexOf(': '); return i < 0 ? '<li>' + esc(t) + '</li>' : '<li><b>' + esc(t.slice(0, i)) + '</b> ' + esc(t.slice(i + 2)) + '</li>'; }).join('');
  return card('nube', 'El tiempo que necesita', '<div class="cs"><div class="cs-tag ' + (est ? 'est' : 'hip') + '">' + (est ? 'Con estudio' : 'Orientativo') + ' · ' + esc(gremioNom(f.gremio, f.gremioNombre)) + '</div>' + (GREMIO[f.gremio] ? '<p class="fc-p">' + esc(GREMIO[f.gremio].d) + '</p>' : '') + '<ul class="cs-l">' + li + '</ul>' +
    (f.nota ? '<p class="fc-p">' + esc(f.nota) + '</p>' : '') +
    (est ? '' : '<p class="fc-p fc-hip">Son los valores de partida del modelo para este tipo de seta, no umbrales medidos para esta especie. Se irán ajustando con tus salidas.</p>') + '</div>' +
    (f.perenne ? '' : '<div class="row"><a class="btn p" href="#plan/' + esc(e.id) + '">¿Qué día salir a por esta?</a></div>'));
}
