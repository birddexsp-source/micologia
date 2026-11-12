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
export const tagEsp = e => e.clase === 'sin_datos' && e.candidataComestible ? '<span class="tag cand">Candidata · sin confirmar</span>' : tag(e.clase);
export const nombres = e => [...(e.nombresComunes.es || []), ...(e.nombresComunes.eu || [])].join(' · ');
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
const RASGOS = [['sombrero', 'Sombrero'], ['himenio', 'Himenio'], ['reticulo', 'Retículo'], ['pie', 'Pie'], ['anillo', 'Anillo'], ['volva', 'Volva'], ['carne', 'Carne'], ['olor', 'Olor'], ['esporada', 'Esporada'], ['habitat', 'Hábitat']];

export function fichaHTML(e, mes) {
  const c = cat.CLASES[e.clase], peligro = e.clase === 'mortal' || e.clase === 'toxica', ras = RASGOS.filter(([k]) => e[k]), td = datos(e);
  const fuFotos = (e.fotos || []).map(f => '<li>' + esc(f.sp) + ': ' + esc(f.autor) + ', <a href="' + esc(f.licenciaUrl || f.pagina) + '" target="_blank" rel="noopener">' + esc(f.licencia) + '</a>, <a href="' + esc(f.pagina) + '" target="_blank" rel="noopener">Commons</a></li>').join('');
  return hero(e) +
    '<div class="fh" style="--c:' + c.color + '"><div class="chips">' + tagEsp(e) + '<span class="tag" style="--c:#3a4743">' + esc(cat.NIVELES[e.nivelVerificacion] || e.nivelVerificacion) + '</span></div>' +
    '<h2><i>' + esc(e.nombreCientifico) + '</i></h2>' + (nombres(e) ? '<p class="sub" style="font-family:inherit">' + esc(nombres(e)) + '</p>' : '') + '</div>' +
    (e.clave ? '<div class="clave' + (peligro ? ' pel' : '') + '"><small>' + (peligro ? 'Lo primero que hay que saber' : 'Lo primero que hay que mirar') + '</small><b>' + esc(e.clave) + '</b></div>' : '') +
    '<div class="warn">' + esc(cat.aviso()) + '</div>' +
    (e.notaComestibilidad ? '<div class="note" style="margin-top:10px">' + esc(e.notaComestibilidad) + '</div>' : '') +
    (e.notaNomenclatura ? '<div class="note" style="margin-top:10px"><b>Nombre:</b> ' + esc(e.notaNomenclatura) + '</div>' : '') +
    (e.sindrome ? '<div class="sec">Si es tóxica</div><dl class="kv"><dt>Síndrome</dt><dd>' + esc(e.sindrome) + '</dd>' + (e.latencia ? '<dt>Aparece a las</dt><dd>' + esc(e.latencia) + '</dd>' : '') + (e.gravedad ? '<dt>Gravedad</dt><dd>' + esc(e.gravedad) + '</dd>' : '') + '</dl><p class="note" style="margin-top:8px">Intoxicación: urgencias ya (112), con restos de la seta y la hora de ingestión. No esperar a que «pase».</p>' : '') +
    '<div class="sec">Qué mirar</div>' + queMirar(e) + '<div class="row"><button class="btn" data-g="">Ver las partes de la seta</button></div>' +
    confusiones(e) +
    '<div class="sec">Cuándo se ve</div>' + (td.hay ? barrasHTML(e, mes) + '<p class="note" style="margin-top:8px">' + esc(fuenteTxt(e)) + '</p>' : '<p class="note">' + esc(fuenteTxt(e)) + '</p>') +
    (ras.length ? '<details class="det"><summary>Datos del catálogo inicial (borrador)</summary><dl class="kv" style="margin-top:8px">' + ras.map(([k, l]) => '<dt>' + l + '</dt><dd>' + esc(e[k]) + '</dd>').join('') + '</dl></details>' : '') +
    (e.candidataComestible ? '<div class="row"><button class="btn big" id="fi-antes">Antes de comer</button></div>' : '') +
    '<div class="sec">Fuentes</div>' + e.fuentes.filter(f => !/Commons/.test(f.nombre)).map(f => '<div class="note" style="margin-bottom:8px"><b>' + esc(f.nombre) + '</b>' + (f.fechaConsulta ? ' <small style="color:var(--mut)">· ' + esc(f.fechaConsulta) + '</small>' : '') + (f.url ? '<br><a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.url) + '</a>' : '') + (f.nota ? '<br><small style="color:var(--mut)">' + esc(f.nota) + '</small>' : '') + '</div>').join('') +
    (fuFotos ? '<div class="sec">Créditos de las fotos</div><div class="note"><ul class="cred">' + fuFotos + '</ul><small style="color:var(--mut)">Fotos orientativas de otros autores (Wikimedia Commons). No confirman una identificación.</small></div>' : '');
}
export { mesNombre };
