/* Piezas visuales del catálogo: fotos con crédito, ficha completa, tarjetas de especie. Solo construye HTML. */
import * as cat from './catalog.js';
import { esc } from './util.js';
import { parte } from './guia.js';
import { barrasHTML, fuenteTxt, datos, mesNombre } from './temporada.js';

export const fotoURL = (f, w) => f.url.replace('{w}', w);
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
  return '<ol class="qm">' + q.map(x => { const p = parte(x.parte); return '<li><button class="pt" data-g="' + esc(x.parte) + '" style="--c:' + p.color + '" aria-label="Ver «' + esc(p.nombre) + '» en la guía">' + esc(p.nombre) + '</button><div><b>' + esc(x.titulo) + '</b><span>' + esc(x.texto) + '</span></div></li>'; }).join('') + '</ol>';
}
function confusiones(e) {
  const cs = e.confusiones || []; if (!cs.length) return '';
  return '<div class="sec">Se confunde con</div>' + cs.map(c => {
    const o = c.id ? cat.byId(c.id) : null, g = GRAV[c.gravedad];
    return '<div class="conf">' +
      (o ? '<div class="cmp"><figure>' + (e.fotos && e.fotos[0] ? foto(e.fotos[0], 250, { alt: e.nombreCientifico }) : '<span class="phw"></span>') + '<figcaption>Esta</figcaption></figure><span class="vs">vs</span><figure>' + (o.fotos && o.fotos[0] ? foto(o.fotos[0], 250, { alt: o.nombreCientifico }) : '<span class="phw"></span>') + '<figcaption>' + esc(o.nombreCientifico.split(' (')[0]) + '</figcaption></figure></div>' : '') +
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
  const hs = (e.habitats || []).filter(h => HAB[h]); if (!hs.length && !e.habitatTexto) return '';
  return '<div class="sec">Dónde crece</div>' + (hs.length ? '<div class="habs">' + hs.map(h => '<span class="hab"><i>' + ICO[HAB[h][1]] + '</i>' + HAB[h][0] + '</span>').join('') + '</div>' : '') +
    (e.habitatTexto ? '<p class="note" style="margin-top:8px">' + esc(e.habitatTexto) + '</p>' : '');
};
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
  return '<div class="sec">Cómo recogerla</div><div class="recog" style="--c:' + a[1] + '"><div class="rh"><svg viewBox="0 0 24 24">' + a[2] + '</svg><b>' + a[0] + '</b></div><p>' + esc(r.txt) + '</p><button class="lnk" data-l="recoger">Cortar o arrancar, paso a paso ›</button></div>';
};
const curiosidades = e => (e.curiosidades && e.curiosidades.length) ? '<div class="sec">Curiosidades</div><ol class="curi">' + e.curiosidades.map(c => '<li>' + esc(c) + '</li>').join('') + '</ol>' : '';
const comestible = e => { const m = e.comestibilidad, k = cat.CLASES[cat.vista(e)]; return '<div class="com" style="--c:' + k.color + '"><div class="ch"><svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg><b>' + esc(k.label) + '</b></div><p>' + esc(m.txt) + '</p><small>Fuente: ' + esc(m.segun) + '. La ficha sigue en borrador. Esto no te autoriza a comer ninguna seta: solo con identificación completa y confirmada por una persona experta.</small><button class="lnk" id="fi-antes">Antes de comer ›</button></div>'; };
const peligroConf = e => (e.confusiones || []).some(c => c.gravedad === 'alta') && e.clase !== 'mortal' && e.clase !== 'toxica';
const RASGOS = [['sombrero', 'Sombrero'], ['himenio', 'Himenio'], ['reticulo', 'Retículo'], ['pie', 'Pie'], ['anillo', 'Anillo'], ['volva', 'Volva'], ['carne', 'Carne'], ['olor', 'Olor'], ['esporada', 'Esporada'], ['habitat', 'Hábitat']];

export function fichaHTML(e, mes) {
  const c = cat.CLASES[cat.vista(e)], peligro = e.clase === 'mortal' || e.clase === 'toxica', ras = RASGOS.filter(([k]) => e[k]), td = datos(e);
  const fuFotos = (e.fotos || []).map(f => '<li>' + esc(f.sp) + ': ' + esc(f.autor) + ', <a href="' + esc(f.licenciaUrl || f.pagina) + '" target="_blank" rel="noopener">' + esc(f.licencia) + '</a>, <a href="' + esc(f.pagina) + '" target="_blank" rel="noopener">Commons</a></li>').join('');
  return hero(e) +
    '<div class="fh" style="--c:' + c.color + '"><div class="chips">' + tagEsp(e, true) + '<span class="tag" style="--c:#3a4743">' + esc(cat.NIVELES[e.nivelVerificacion] || e.nivelVerificacion) + '</span>' + (peligroConf(e) ? '<span class="tag" style="--c:#e5484d">Se confunde con tóxicas</span>' : '') + '</div>' +
    '<h2><i>' + esc(e.nombreCientifico) + '</i></h2>' + (nombresHTML(e) ? '<div class="nms">' + nombresHTML(e) + '</div>' : '') + '</div>' +
    (e.clave ? '<div class="clave' + (peligro ? ' pel' : '') + '"><small>' + (peligro ? 'Lo primero que hay que saber' : 'Lo primero que hay que mirar') + '</small><b>' + esc(e.clave) + '</b></div>' : '') +
    '<div class="warn">' + esc(cat.aviso()) + '</div>' +
    (e.comestibilidad ? comestible(e) : e.notaComestibilidad ? '<div class="note" style="margin-top:10px">' + esc(e.notaComestibilidad) + '</div>' : '') +
    (e.notaNomenclatura ? '<div class="note" style="margin-top:10px"><b>Nombre:</b> ' + esc(e.notaNomenclatura) + '</div>' : '') +
    (e.sindrome ? '<div class="sec">Si es tóxica</div><dl class="kv"><dt>Síndrome</dt><dd>' + esc(e.sindrome) + '</dd>' + (e.latencia ? '<dt>Aparece a las</dt><dd>' + esc(e.latencia) + '</dd>' : '') + (e.gravedad ? '<dt>Gravedad</dt><dd>' + esc(e.gravedad) + '</dd>' : '') + '</dl><p class="note" style="margin-top:8px">Intoxicación: urgencias ya (112), con restos de la seta y la hora de ingestión. No esperar a que «pase».</p>' : '') +
    '<div class="sec">Qué mirar</div>' + queMirar(e) + esporada(e) + '<div class="row"><button class="btn" data-g="">Ver las partes de la seta</button></div>' +
    confusiones(e) + habitat(e) +
    '<div class="sec">Cuándo se ve</div>' + (td.hay ? barrasHTML(e, mes) + '<p class="note" style="margin-top:8px">' + esc(fuenteTxt(e)) + '</p>' : '<p class="note">' + esc(fuenteTxt(e)) + '</p>') +
    recoger(e) + curiosidades(e) +
    (ras.length ? '<details class="det"><summary>Datos del catálogo inicial (borrador)</summary><dl class="kv" style="margin-top:8px">' + ras.map(([k, l]) => '<dt>' + l + '</dt><dd>' + esc(e[k]) + '</dd>').join('') + '</dl></details>' : '') +
    (e.candidataComestible && !e.comestibilidad ? '<div class="row"><button class="btn big" id="fi-antes">Antes de comer</button></div>' : '') +
    '<div class="sec">Fuentes</div>' + e.fuentes.filter(f => !/Commons/.test(f.nombre)).map(f => '<div class="note" style="margin-bottom:8px"><b>' + esc(f.nombre) + '</b>' + (f.fechaConsulta ? ' <small style="color:var(--mut)">· ' + esc(f.fechaConsulta) + '</small>' : '') + (f.url ? '<br><a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.url) + '</a>' : '') + (f.nota ? '<br><small style="color:var(--mut)">' + esc(f.nota) + '</small>' : '') + '</div>').join('') +
    (fuFotos ? '<div class="sec">Créditos de las fotos</div><div class="note"><ul class="cred">' + fuFotos + '</ul><small style="color:var(--mut)">Fotos orientativas de otros autores (Wikimedia Commons). No confirman una identificación.</small></div>' : '');
}
export { mesNombre };
