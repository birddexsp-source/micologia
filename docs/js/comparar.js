/* «¿Cuál es?»: comprobar lo que dice la IA. Para cada candidata, la ficha de identificación paso a paso
   (qué mirar arriba, debajo, en el pie, en la base, al cortarla y al olerla) y una tabla de diferencias entre las candidatas.
   Solo construye HTML; app.js lo pone en pantalla completa y gestiona los toques. Nunca dice si se come. */
import * as cat from './catalog.js';
import { esc } from './util.js';
import { parte } from './guia.js';
import * as fi from './ficha.js';

/* orden en el que se mira una seta en el monte, y qué hacer en cada paso */
export const PASOS = [
  ['sombrero', 'Mira el sombrero', 'Forma, color, si es viscoso o seco, escamas o verrugas.'],
  ['cutis', 'Toca la piel del sombrero', ''],
  ['himenio', 'Dale la vuelta: ¿láminas, poros o pinchos?', 'Color y si bajan por el pie.'],
  ['pie', 'Mira el pie', 'Forma, color, redecilla, escamas, hueco o macizo.'],
  ['anillo', '¿Tiene anillo?', 'Una faldita en el pie (puede haberse caído).'],
  ['volva', 'Desentierra la base del pie', '¿Hay una bolsa o restos de bolsa? Sin la base no se puede descartar una Amanita.'],
  ['carne', 'Córtala', '¿De qué color es la carne y cambia al cortarla? ¿Suelta leche?'],
  ['olor', 'Huélela', 'A harina, rábano, anís, fruta…'],
  ['esporada', 'En casa: la esporada', 'El color del polvo de esporas.'],
  ['habitat', '¿Dónde estaba?', 'Con qué árboles, en suelo o en madera.'],
  ['otro', 'Otros detalles', '']
];
const ORDEN = Object.fromEntries(PASOS.map(([k], i) => [k, i]));
const peligro = e => e.clase === 'mortal' || e.clase === 'toxica';
const corto = e => (e.nombresComunes && e.nombresComunes.es && e.nombresComunes.es[0]) || e.nombreCientifico.split(' (')[0];

/* rasgos de una especie para un paso: lo que dice «qué mirar» y, si no hay, el dato del catálogo (anillo/volva…) */
function rasgo(e, k) {
  const q = (e.queMirar || []).filter(x => x.parte === k);
  if (q.length) return q;
  if ((k === 'anillo' || k === 'volva' || k === 'himenio') && e[k]) return [{ parte: k, titulo: e[k], texto: '' }];
  return [];
}

/* pestañas de candidatas */
export function tabsHTML(cands, i) {
  return '<div class="cq-tabs" role="tablist">' + cands.map((c, k) => '<button class="cq-t' + (k === i ? ' on' : '') + (peligro(c.e) ? ' pel' : '') + '" data-ck="' + k + '" style="--c:' + cat.CLASES[cat.vista(c.e)].color + '">' +
    fi.avatar(c.e, 250) + '<span><b>' + esc(corto(c.e)) + '</b>' + (c.pc != null ? '<small>IA ' + c.pc + ' %</small>' : '') + '</span></button>').join('') +
    (cands.length > 1 ? '<button class="cq-t dif' + (i === -1 ? ' on' : '') + '" data-ck="-1"><span><b>Diferencias</b><small>lado a lado</small></span></button>' : '') + '</div>';
}

/* lo que la IA vio en tus fotos para esa candidata */
export const iaHTML = ia => !ia || !(ia.encaja || ia.noEncaja || ia.comprobar) ? '' : '<div class="cq-iav"><small>Lo que ve la IA en tus fotos</small>' +
  (ia.encaja ? '<p class="si"><b>Encaja:</b> ' + esc(ia.encaja) + '</p>' : '') + (ia.noEncaja ? '<p class="no"><b>No cuadra o no se ve:</b> ' + esc(ia.noEncaja) + '</p>' : '') +
  (ia.comprobar ? '<p class="ck"><b>Compruébalo:</b> ' + esc(ia.comprobar) + '</p>' : '') + '</div>';
/* cómo separarlas, según la IA: comprobaciones con lo que puedes encontrar y a cuál lleva */
export const pasosIA = dif => !dif || !dif.length ? '' : '<div class="cq-dif"><small>Cómo diferenciarlas</small><ol>' + dif.map(d => '<li><b>' + esc(d.mira) + '</b><ul>' +
  d.opciones.map(o => '<li><span>' + esc(o.si) + '</span><em>→ ' + esc(o.entonces) + '</em></li>').join('') + '</ul></li>').join('') + '</ol><p class="mut sm">Lo propone la IA a partir de tus fotos: compruébalo con la ficha.</p></div>';

/* una candidata: lo esencial, fotos con los rasgos señalados y los pasos */
export function especieHTML(e, otras = [], ia = null) {
  const pasos = PASOS.map(([k, t, ayuda]) => ({ k, t, ayuda, q: rasgo(e, k) })).filter(p => p.q.length);
  const conf = (e.confusiones || []).filter(c => otras.some(o => o.id === c.id));
  return (peligro(e) ? '<div class="cq-pel">' + (e.clase === 'mortal' ? 'MORTAL' : 'TÓXICA') + ' · ' + esc(e.notaComestibilidad || 'Peligrosa: no se recoge para comer.') + '</div>' : '') +
    '<div class="cq-h"><h3><i>' + esc(e.nombreCientifico) + '</i></h3><div class="chips">' + fi.tagEsp(e, true) + '</div></div>' + iaHTML(ia) +
    (e.clave ? '<div class="clave' + (peligro(e) ? ' pel' : '') + '"><small>Lo esencial</small><div class="clv"><b>' + esc(e.clave) + '</b></div></div>' : '') +
    (conf.length ? conf.map(c => { const o = otras.find(x => x.id === c.id); return '<div class="cq-vs"><small>Para no confundirla con ' + esc(corto(o)) + '</small><p>' + esc(c.comoDistinguir) + '</p></div>'; }).join('') : '') +
    ((e.anotadas || []).length ? '<div class="sec">Fotos con los rasgos señalados</div>' + fi.anotadasHTML(e) : (e.fotos || []).length ? '<div class="cq-fs">' + e.fotos.slice(0, 4).map(f => fi.foto(f, 500, { alt: e.nombreCientifico })).join('') + '</div>' : '') +
    '<div class="sec">Comprueba, paso a paso</div><ol class="cq-pasos">' + pasos.map(p => { const c = parte(p.k).color;
      return '<li style="--c:' + c + '"><div class="cq-ph"><b>' + esc(p.t) + '</b>' + (p.ayuda ? '<small>' + esc(p.ayuda) + '</small>' : '') + '</div>' +
        p.q.map(x => '<div class="cq-r"><b>' + esc(x.titulo) + '</b>' + (x.texto ? '<span>' + esc(x.texto) + '</span>' : '') + '</div>').join('') + '</li>'; }).join('') + '</ol>' +
    ((e.confusiones || []).length > conf.length ? '<details class="det"><summary>Otras setas con las que se confunde (' + ((e.confusiones || []).length - conf.length) + ')</summary>' +
      e.confusiones.filter(c => !conf.includes(c)).map(c => '<div class="cq-vs' + (c.gravedad === 'alta' ? ' grave' : '') + '"><small>' + esc(c.nombre) + '</small><p>' + esc(c.comoDistinguir) + '</p></div>').join('') + '</details>' : '');
}

/* diferencias: una fila por paso, una columna por candidata; toca una fila para leer el detalle */
export function diferenciasHTML(cands, dif = []) {
  const es = cands.map(c => c.e);
  const filas = PASOS.map(([k, t]) => ({ k, t, v: es.map(e => rasgo(e, k)) })).filter(f => f.v.some(v => v.length));
  const vs = [];
  es.forEach((a, i) => es.forEach((b, j) => { if (j <= i) return; const c = (a.confusiones || []).find(x => x.id === b.id) || (b.confusiones || []).find(x => x.id === a.id); if (c) vs.push({ a, b, c }); }));
  return pasosIA(dif) + (vs.length ? vs.map(x => '<div class="cq-vs"><small>' + esc(corto(x.a)) + ' o ' + esc(corto(x.b)) + '</small><p>' + esc(x.c.comoDistinguir) + '</p></div>').join('') : '') +
    '<div class="cq-tab" style="--n:' + es.length + '"><div class="cq-fila cab"><span></span>' + es.map(e => '<b style="--c:' + cat.CLASES[cat.vista(e)].color + '">' + esc(corto(e)) + (peligro(e) ? ' ⚠' : '') + '</b>').join('') + '</div>' +
    '<div class="cq-fila"><span>Qué dice la ficha</span>' + es.map(e => '<em>' + esc(cat.CLASES[cat.vista(e)].label) + '</em>').join('') + '</div>' +
    filas.map(f => '<details class="cq-fd"><summary class="cq-fila" style="--c:' + parte(f.k).color + '"><span>' + esc(f.t) + '</span>' + f.v.map(v => '<em>' + (v.length ? esc(v.map(x => x.titulo).join(' · ')) : '—') + '</em>').join('') + '</summary>' +
      '<div class="cq-det">' + f.v.map((v, i) => v.length ? '<p><b>' + esc(corto(es[i])) + ':</b> ' + esc(v.map(x => x.titulo + (x.texto ? '. ' + x.texto : '')).join(' ')) + '</p>' : '').join('') + '</div></details>').join('') +
    '</div><p class="mut sm">Toca una fila para leer el detalle. «—» = la ficha no dice nada de esa parte.</p>';
}
