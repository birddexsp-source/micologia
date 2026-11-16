/* Pantalla «Plan»: ¿qué día salir a por X? Combina la ficha de cada seta (cuándo sale), el tiempo (Open-Meteo) y tus propias salidas.
   Nunca dice si algo es comestible: solo si es buen momento para BUSCAR. */
import * as db from './db.js';
import * as cat from './catalog.js';
import * as cl from './clima.js';
import * as md from './modelo.js';
import * as fi from './ficha.js';
import { gremioNom, GREMIO } from './habitat.js';
import { esc, $, $$, hoy, toast } from './util.js';

const BERMEO = { id: 'bermeo', nombre: 'Bermeo (centro)', lat: 43.42, lon: -2.7264 };
const LS = 'mi.plan', CAL = 'mi.cal', ACC = 'mi.acc', MIN_CAL = 10;
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], DIA1 = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const lee = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
const guarda = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };

const P = { obj: 'general', zona: 'bermeo', sel: null, cargando: false, ...lee(LS, {}) };
const nombre = e => { const n = e.nombresComunes && e.nombresComunes.es && e.nombresComunes.es[0]; return n ? n[0].toUpperCase() + n.slice(1) : e.nombreCientifico.split(' (')[0]; };
const especies = () => cat.todas().filter(e => e.fructificacion && !e.fructificacion.perenne);
const fechaLarga = f => { const d = cl.aFecha(f); return DIAS[d.getDay()] + ' ' + d.getDate() + ' ' + ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()]; };
export const calActual = () => { const c = lee(CAL, null); return c && c.n >= MIN_CAL ? c : null; };

/* ---------- objetivos y lugares ---------- */
export function gremios() { const m = new Map(); especies().forEach(e => m.set(e.fructificacion.gremio, e.fructificacion.gremioNombre)); return [...m].map(([id, nombre]) => ({ id, nombre: gremioNom(id, nombre) })); }
export function funcionObjetivo(obj, dias, cal) {
  const esp = especies();
  if (obj === 'general') return f => { const g = md.puntuarGeneral(esp, dias, f, cal); return { score: g.score, general: g }; };
  if (obj.startsWith('g:')) { const lista = esp.filter(e => e.fructificacion.gremio === obj.slice(2)); return f => { const g = md.puntuarGeneral(lista, dias, f, cal); return { score: g.score, general: g }; }; }
  const e = cat.byId(obj); if (!e || !e.fructificacion || e.fructificacion.perenne) return null;
  return f => md.puntuar(e, dias, f, cal);
}
async function lugares() { const z = (await db.list('zonas')).sort((a, b) => a.nombre.localeCompare(b.nombre)); return [BERMEO, ...z.filter(x => x.lat != null).map(x => ({ id: x.id, nombre: x.nombre, lat: x.lat, lon: x.lon }))]; }

/* ---------- aprendizaje: visitas pasadas con su resultado ---------- */
export async function ejemplos() {
  const [ss, hs, zs] = [await db.list('salidas'), await db.list('hallazgos'), await db.list('zonas')];
  const zon = new Map(zs.map(z => [z.id, z])), out = new Map();
  const ymd = ts => cl.iso(new Date(ts));
  ss.filter(s => s.estado === 'terminada' && s.fecha).forEach(s => (s.zonaIds || []).forEach(zid => {
    const z = zon.get(zid); if (!z || z.lat == null) return;
    out.set(s.fecha + '|' + zid, { f: s.fecha, zid, lat: z.lat, lon: z.lon, y: hs.some(h => h.salidaId === s.id && h.zonaId === zid) });
  }));
  hs.filter(h => !h.salidaId && h.zonaId && h.ts).forEach(h => { const z = zon.get(h.zonaId); if (!z || z.lat == null) return; out.set(ymd(h.ts) + '|' + h.zonaId, { f: ymd(h.ts), zid: h.zonaId, lat: z.lat, lon: z.lon, y: true }); });
  return [...out.values()];
}
/* Calcula la puntuación SIN calibrar de cada visita con el tiempo que hubo de verdad, y ajusta el modelo. Necesita conexión para los días que no estén guardados. */
export async function calcularAciertos() {
  const ex = await ejemplos(), esp = especies(), lista = [];
  const vistas = new Set();
  for (const v of ex) {
    const celda = cl.celda(v.lat, v.lon), k = celda.lat + ',' + celda.lon;
    if (!vistas.has(k)) { vistas.add(k); await cl.cargar(v.lat, v.lon); }          // últimos 92 días (previsión API) para esa zona
    const dias = await cl.asegurarRango(v.lat, v.lon, cl.sumaDias(v.f, -30), v.f);
    if (!dias[cl.sumaDias(v.f, -1)]) continue;                                   // sin datos de tiempo para ese día: no cuenta
    lista.push({ s: md.puntuarGeneral(esp, dias, v.f, null).score, y: v.y, f: v.f, zid: v.zid });
  }
  const ac = md.aciertos(lista), cal = md.ajustar(lista);
  guarda(ACC, { t: Date.now(), ac, total: ex.length }); guarda(CAL, { ...cal, t: Date.now() });
  return { ac, cal, total: ex.length, usadas: lista.length, lista };
}

/* ---------- pantalla ---------- */
let CACHE_L = [];
export async function renderPlan(root, arg) {
  if (arg && cat.byId(arg) && P.obj !== arg) { P.obj = arg; P.sel = null; guarda(LS, { obj: P.obj, zona: P.zona }); }
  CACHE_L = await lugares(); if (!CACHE_L.some(l => l.id === P.zona)) P.zona = 'bermeo';
  const lug = CACHE_L.find(l => l.id === P.zona);
  root.innerHTML = '<div class="pad pl"><div class="pl-sel" id="pl-sel"></div><button class="pl-donde" id="pl-donde"><i>?</i><b>¿No sabes dónde mirar?</b><span>Guía ›</span></button><div id="pl-res"><div class="pl-carg">Buscando el tiempo…</div></div><div id="pl-acc"></div></div>';
  pintarSelectores(root);
  root.onchange = e => {
    if (e.target.id === 'pl-obj') { P.obj = e.target.value; P.sel = null; } else if (e.target.id === 'pl-lug') { P.zona = e.target.value; P.sel = null; } else return;
    guarda(LS, { obj: P.obj, zona: P.zona }); renderPlan(root);
  };
  root.onclick = e => {
    const b = e.target.closest('[data-pf]'); if (b) { P.sel = b.dataset.pf; pintarResultado(root); return; }
    if (e.target.closest('#pl-ref')) { cargarTiempo(root, true); return; }
    if (e.target.closest('#pl-acc-b')) { aciertosUI(root, true); return; }
    const hb = e.target.closest('[data-hab]'); if (hb && window.__MI) { window.__MI.abrirHabitat(hb.dataset.hab); return; }
    if (e.target.closest('#pl-donde')) { window.__MI && window.__MI.abrirDondeBuscar(); return; }
    const f = e.target.closest('[data-pe]'); if (f && window.__MI) window.__MI.abrirFicha(f.dataset.pe);
  };
  await cargarTiempo(root, false, lug);
  aciertosUI(root, false);
}
function pintarSelectores(root) {
  const g = gremios(), esp = especies().sort((a, b) => nombre(a).localeCompare(nombre(b)));
  $('#pl-sel', root).innerHTML = '<div class="pl-f"><label class="l" for="pl-obj">¿A por qué salgo?</label><select id="pl-obj"><optgroup label="General"><option value="general">Setas en general</option></optgroup><optgroup label="Por tipo">' +
    g.map(x => '<option value="g:' + x.id + '">' + esc(x.nombre) + '</option>').join('') + '</optgroup><optgroup label="Una especie">' + esp.map(e => '<option value="' + e.id + '">' + esc(nombre(e)) + '</option>').join('') + '</optgroup></select></div>' +
    '<div class="pl-f"><label class="l" for="pl-lug">¿Dónde?</label><select id="pl-lug">' + CACHE_L.map(l => '<option value="' + l.id + '">' + esc(l.nombre) + '</option>').join('') + '</select></div>';
  $('#pl-obj', root).value = P.obj; $('#pl-lug', root).value = P.zona;
}
let ESTADO = null;
async function cargarTiempo(root, forzar, lug = CACHE_L.find(l => l.id === P.zona)) {
  const res = $('#pl-res', root); if (!res) return;
  ESTADO = { lug, ...(await cl.cargar(lug.lat, lug.lon, { forzar })) };
  pintarResultado(root);
}
function estadoTiempo(E) {
  const n = Object.keys(E.dias).length;
  if (!n) return '<div class="pl-st bad">Sin datos del tiempo. ' + (E.error === 'sin conexión' ? 'Necesito conexión la primera vez; después queda guardado.' : 'No he podido consultar Open-Meteo (' + esc(E.error || 'error') + ').') + ' <button class="btn" id="pl-ref">Reintentar</button></div>';
  const edad = E.edadMin == null ? '' : E.edadMin < 2 ? 'ahora mismo' : E.edadMin < 90 ? 'hace ' + E.edadMin + ' min' : 'hace ' + Math.round(E.edadMin / 60) + ' h';
  return '<div class="pl-st' + (E.error ? ' warn' : '') + '">Tiempo: Open-Meteo, ' + esc(E.lug.nombre) + ' · ' + (E.error ? 'sin conexión, datos guardados ' : 'actualizado ') + edad + ' <button class="btn" id="pl-ref">Actualizar</button></div>';
}
function pintarResultado(root) {
  const res = $('#pl-res', root); if (!res || !ESTADO) return;
  const E = ESTADO, h = hoy(), cal = calActual(), fn = funcionObjetivo(P.obj, E.dias, cal);
  if (!fn) { res.innerHTML = estadoTiempo(E) + '<div class="note">Esa seta es perenne de madera: se ve casi todo el año y la lluvia de estos días no cambia que esté. Elige otra.</div>'; return; }
  if (!Object.keys(E.dias).length) { res.innerHTML = estadoTiempo(E); return; }
  const s = md.serie(fn, h, 7, 10, E.dias), mejor = md.mejorDia(s), sel = P.sel && s.find(x => x.f === P.sel) ? P.sel : (mejor ? mejor.f : h), dia = s.find(x => x.f === sel);
  const titulo = P.obj === 'general' ? 'Setas en general' : P.obj.startsWith('g:') ? gremios().find(x => 'g:' + x.id === P.obj).nombre : nombre(cat.byId(P.obj));
  const mx = 100;
  res.innerHTML = estadoTiempo(E) +
    '<div class="pl-top" style="--c:' + md.COL(mejor ? mejor.score : 0) + '"><small>Mejor día para «' + esc(titulo) + '»</small>' +
    (mejor ? '<b>' + fechaLarga(mejor.f) + (mejor.d === 0 ? ' (hoy)' : mejor.d === 1 ? ' (mañana)' : '') + '</b><span class="pl-n">' + mejor.score + '<i>/100</i></span><em>' + md.ETIQ(mejor.score) + '</em>' : '<b>—</b>') +
    (mejor && mejor.score < 30 ? '<p>Ningún día de los próximos 10 pinta bien' + (dia && dia.r && dia.r.limitante ? '. Lo que más falta: ' + etiquetaLim(mejor.r) : '') + '.</p>' : '') + '</div>' +
    '<div class="pl-chart"><div class="pl-ch"><b>Día a día</b><span>Toca un día para ver el detalle</span></div><div class="pl-bars" role="img" aria-label="Puntuación por día">' + s.map(x => {
      const sc = x.score == null ? 0 : x.score;
      return '<button data-pf="' + x.f + '" class="pl-b' + (x.d < 0 ? ' pas' : '') + (x.d === 0 ? ' hoy' : '') + (x.f === sel ? ' on' : '') + '" style="--h:' + Math.max(4, sc / mx * 100) + '%;--c:' + md.COL(sc) + '"><span class="pl-v">' + (x.score == null ? '' : sc) + '</span><u></u><span class="pl-p">' + (x.p == null ? '' : x.p >= 1 ? Math.round(x.p) : '·') + '</span><span class="pl-d">' + DIA1[cl.aFecha(x.f).getDay()] + '<small>' + cl.aFecha(x.f).getDate() + '</small></span></button>';
    }).join('') + '</div><div class="pl-leg"><span>◀ ya pasado (tiempo real)</span><span>previsión ▶</span></div><div class="pl-leg2"><span class="pl-mm">azul</span> = lluvia del día (mm). Lo pasado son datos medidos; a más de 5 días, la previsión es menos fiable.</div></div>' +
    detalleDia(dia, titulo, E) + (dia && dia.score != null ? '<div class="pl-lista">' + listaDia(dia) + '</div>' : '') + (cal ? '<div class="note pl-cal">Modelo ajustado con tus ' + cal.n + ' visitas.</div>' : '') +
    '<div class="note pl-gente"><b>La gente también cuenta.</b> Tras un fin de semana de lluvia, el lunes ya ha pasado la gente a recoger y quedan sobre todo las setas que nadie se lleva; jueves y viernes por la mañana suele haber tanda nueva. Es una hipótesis tuya, sin contrastar: solo resta hasta un 30 % a las especies que la gente suele recoger.</div>';
}
const etiquetaLim = r => { const m = { lluvia: 'lluvia acumulada', temp: 'temperatura', helada: 'helada', seco: 'suelo seco', temporada: 'época del año', gente: 'gente (recolectores)' }; const x = r && (r.limitante || (r.general && r.general.mejor && null)); return m[x] || 'varios factores'; };
function detalleDia(d, titulo, E) {
  if (!d || d.score == null) return '';
  const tipo = d.d < 0 ? 'Cómo estaba' : d.d === 0 ? 'Hoy' : 'Previsión';
  let cuerpo = '';
  if (d.r.general) {
    const g = d.r.general, top = g.mejor;
    cuerpo += top ? '<p class="pl-q">Lo mejor ese día: <b>' + esc(gremioNom(top.gremio, top.nombre)) + '</b> (' + top.score + ').' + (GREMIO[top.gremio] ? ' <small>' + esc(GREMIO[top.gremio].d) + '</small>' : '') + '</p>' : '';
    const e0 = top && top.mejores[0]; if (e0) { const r0 = md.puntuar(e0, E.dias, d.f, calActual()); cuerpo += '<div class="pl-why-h">Por qué (' + esc(nombre(e0)) + '):</div>' + porque(r0); }
    cuerpo += '<details class="det"><summary>Todos los tipos de seta ese día</summary>' + g.gremios.map(x => '<div class="pl-g"><span>' + esc(gremioNom(x.gremio, x.nombre)) + '</span><i style="--w:' + x.score + '%;--c:' + md.COL(x.score) + '"></i><b>' + x.score + '</b></div>').join('') + '</details>';
  } else cuerpo += porque(d.r);
  const dd = E.dias[d.f], clima = dd ? ' · ' + (dd.p != null ? dd.p + ' mm' : '') + (dd.tmin != null ? ' · ' + Math.round(dd.tmin) + '/' + Math.round(dd.tmax) + ' °C' : '') : '';
  return '<div class="pl-det"><div class="pl-dh"><b>' + tipo + ': ' + fechaLarga(d.f) + '</b><span style="color:' + md.COL(d.score) + '">' + d.score + ' · ' + md.ETIQ(d.score) + '</span></div><div class="pl-dc">' + clima.replace(/^ · /, '') + '</div>' + cuerpo +
    (d.r.x && d.r.x.c.pHoy >= 10 ? '<p class="note">Ese día se prevén ' + Math.round(d.r.x.c.pHoy) + ' mm: sales mojado, aunque al monte no le viene mal.</p>' : '') + '</div>';
}
const porque = r => !r || !r.explicacion ? '' : '<ul class="pl-why">' + r.explicacion.map(x => '<li class="' + (x.v >= 0.85 ? 'ok' : x.v >= 0.5 ? 'mid' : 'no') + '"><i></i>' + esc(x.t) + '</li>').join('') + '</ul>';

/* ---------- lista visual de especies de un día ---------- */
const PELIGRO = e => e.clase === 'mortal' || e.clase === 'toxica';
const corta = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).replace(/[ ,.;:]+\S*$/, '') + '…' : t; };
/* especies del objetivo con su puntuación ese día, de mayor a menor */
export function especiesDelDia(obj, dias, f, cal) {
  let lista = especies();
  if (obj.startsWith('g:')) lista = lista.filter(e => e.fructificacion.gremio === obj.slice(2));
  else if (obj !== 'general') lista = lista.filter(e => e.id === obj);
  return lista.map(e => ({ e, r: md.puntuar(e, dias, f, cal) })).filter(x => x.r).sort((a, b) => b.r.score - a.r.score);
}
function tarjetaEsp(x, f) {
  const e = x.e, c = nombre(e), cien = e.nombreCientifico.split(' (')[0], gr = gremioNom(e.fructificacion.gremio, e.fructificacion.gremioNombre), col = md.COL(x.r.score);
  const hab = fi.dondeSimple(e), chips = (e.habitats || []).filter(h => fi.H[h]).slice(0, 3);
  return '<button class="pl-sp' + (PELIGRO(e) ? ' pel' : '') + '" data-pe="' + e.id + '">' + fi.avatar(e, 250) +
    '<div class="t"><b>' + esc(c) + '</b>' + (c !== cien ? '<small><i>' + esc(cien) + '</i></small>' : '') +
    '<div class="pl-sp-m">' + fi.tagEsp(e) + fi.rarezaTag(e) + '<span class="pl-sp-s" style="color:' + col + '">' + x.r.score + ' · ' + md.ETIQ(x.r.score) + '</span></div>' +
    (e.clave ? '<p class="pl-sp-k"><b>Cómo reconocerla:</b> ' + esc(corta(e.clave, 150)) + '</p>' : '') +
    (hab ? '<p class="pl-sp-h"><b>Dónde mirar:</b> ' + esc(hab) + '</p>' : '') +
    (chips.length ? '<span class="pl-sp-hs">' + chips.map(h => '<span class="pl-hab" data-hab="' + h + '">' + esc(fi.H[h].nombre) + ' ›</span>').join('') + '</span>' : '') +
    '<small class="pl-sp-g">' + esc(gr) + '</small></div>' + '<span class="pl-sp-c">›</span></button>';
}
function listaDia(d) {
  const lista = especiesDelDia(P.obj, ESTADO.dias, d.f, calActual());
  const buenas = lista.filter(x => !PELIGRO(x.e) && x.r.score >= 30).slice(0, 8), pel = lista.filter(x => PELIGRO(x.e) && x.r.score >= 30).slice(0, 5);
  const unica = !P.obj.startsWith('g:') && P.obj !== 'general';
  if (unica) return '';                                                              // con una sola especie ya se ve en el resumen del día
  let h = '<div class="pl-lh">Setas para buscar ' + (d.d === 0 ? 'hoy' : d.d < 0 ? 'ese día' : 'ese día') + '</div>';
  h += buenas.length ? buenas.map(x => tarjetaEsp(x, d.f)).join('') : '<p class="note">Ninguna seta tiene buen momento ese día.</p>';
  if (buenas.length) h += '<p class="note pl-ident">Toca una para ver su ficha con fotos y cómo reconocerla. Que salga no significa que sea comestible: identifica siempre con la ficha y, si dudas, no la cojas.</p>';
  if (pel.length) h += '<div class="pl-lh pl-lh-pel">⚠ Tóxicas y mortales que también salen</div>' + pel.map(x => tarjetaEsp(x, d.f)).join('');
  return h;
}

/* ---------- aciertos ---------- */
async function aciertosUI(root, calcular) {
  const box = $('#pl-acc', root); if (!box) return;
  const ex = await ejemplos(), prev = lee(ACC, null);
  if (!ex.length) { box.innerHTML = '<section class="aj"><div class="aj-h"><span class="aj-i"><svg viewBox="0 0 24 24"><path d="M4 19h16"/><path d="M5 15l4-4 3 3 6-7"/><path d="M14 7h4v4"/></svg></span><div><h3>Tus aciertos</h3><small>El modelo aprende de tus salidas</small></div></div><p class="note">Aún no hay salidas terminadas con spots. Cuando termines salidas (con o sin hallazgos), aquí verás si los días que el modelo daba por buenos fueron los de éxito, y se ajusta solo.</p></section>'; return; }
  if (calcular) { box.innerHTML = '<p class="note">Calculando con el tiempo real de tus salidas…</p>'; try { await calcularAciertos(); } catch (e) { toast('No se han podido calcular los aciertos'); } renderPlan(root); return; }
  const a = prev && prev.ac, cal = lee(CAL, null);
  const fila = (t, x) => '<tr><td>' + t + '</td><td>' + x.n + '</td><td>' + (x.tasa == null ? '—' : x.tasa + ' %') + '</td></tr>';
  box.innerHTML = '<section class="aj"><div class="aj-h"><span class="aj-i"><svg viewBox="0 0 24 24"><path d="M4 19h16"/><path d="M5 15l4-4 3 3 6-7"/><path d="M14 7h4v4"/></svg></span><div><h3>Tus aciertos</h3><small>' + ex.length + ' visitas a spots · ' + (a ? 'con tiempo real de cada día' : 'sin calcular') + '</small></div></div>' +
    (a && a.n ? '<table class="pl-t"><tr><th>El modelo daba</th><th>Visitas</th><th>Con hallazgo</th></tr>' + fila('Buen momento (≥ 60)', a.alto) + fila('Regular (40–59)', a.medio) + fila('Flojo (< 40)', a.bajo) + '</table>' +
      '<p class="note">Base: encontraste algo en el ' + a.base + ' % de tus visitas.' + (a.auc != null ? ' Acierto al ordenar (AUC): ' + String(a.auc).replace('.', ',') + ' (0,5 = azar, 1 = perfecto).' : '') + '</p>' +
      '<p class="note">' + (cal && cal.n >= MIN_CAL ? 'El modelo ya está ajustado con tus ' + cal.n + ' visitas.' : 'Con ' + (MIN_CAL - (cal ? cal.n : 0)) + ' visitas más el modelo empezará a ajustarse a ti; hasta entonces usa solo la ficha de cada seta.') + '</p>' : '<p class="note">Pulsa para calcular qué puntuaba el modelo en cada visita (necesita conexión para traer el tiempo de esos días).</p>') +
    '<div class="row"><button class="btn" id="pl-acc-b">' + (a ? 'Recalcular' : 'Calcular mis aciertos') + '</button></div></section>';
}
