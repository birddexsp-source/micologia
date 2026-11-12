/* Recorrido de la salida: mientras hay una salida en curso se guardan los puntos GPS (uno cada ≥12 m, solo con buena precisión).
   Limitación de la web: si el móvil bloquea la pantalla o la app pasa a segundo plano, el navegador puede dejar de dar posiciones.
   Por eso hay un botón para mantener la pantalla encendida; los huecos se unen con una línea recta. */
import * as db from './db.js';
import * as geo from './geo.js';
export const MIN_M = 12, MAX_ACC = 40, FLUSH_MS = 45000, HUECO_S = 1200;
let R = null, wake = null, escribiendo = false; const subs = new Set();
export const guardando = () => escribiendo;

export const dist = (a, b) => { const r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r, x = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2; return 12742000 * Math.asin(Math.sqrt(x)); };
/* Un punto con 4.º valor = 1 empieza un tramo nuevo (tras una pausa o un hueco largo): no se une con el anterior */
export const lineas = pts => { const o = []; (pts || []).forEach(p => { if (!o.length || p[3]) o.push([]); o[o.length - 1].push(p); }); return o; };
export const metros = pts => lineas(pts).reduce((t, l) => t + l.reduce((s, p, i, a) => i ? s + dist(a[i - 1], p) : 0, 0), 0);
export const fmtKm = m => m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km';
export const duracion = pts => { if (!pts || pts.length < 2) return 0; return Math.max(0, pts[pts.length - 1][2] - pts[0][2]); };
export const fmtDur = s => { const h = Math.floor(s / 3600), m = Math.round(s % 3600 / 60); return h ? h + ' h ' + String(m).padStart(2, '0') + ' min' : m + ' min'; };
export const activo = () => R ? R.id : null;
export const puntos = () => R ? R.pts : [];
export const onAdd = f => { subs.add(f); return () => subs.delete(f); };

function add(f) {
  if (!R || !f || f.acc > MAX_ACC) return false;
  const p = [+f.lat.toFixed(5), +f.lon.toFixed(5), Math.round((f.ts || Date.now()) / 1000)], l = R.pts[R.pts.length - 1];
  if (l && dist(l, p) < MIN_M) return false;
  if (R.corte || (l && p[2] - l[2] > HUECO_S)) { p.push(1); R.corte = false; }
  R.pts.push(p); R.dirty = true; subs.forEach(fn => { try { fn(p, R.pts); } catch (e) { } }); return true;
}
export async function flush() {
  if (!R || !R.dirty) return; R.dirty = false; escribiendo = true;
  try { await db.patch('salidas', R.id, { track: R.pts }); } catch (e) { if (R) R.dirty = true; } finally { escribiendo = false; }
}
const onVis = () => { if (document.visibilityState === 'hidden') flush(); else if (wake === 'on') pantalla(true); };
/* corte = true al reanudar tras una pausa: el primer punto nuevo abre un tramo */
export async function start(id, corte = false) {
  await parar(); const s = await db.get('salidas', id);
  R = { id, pts: ((s && s.track) || []).map(p => p.slice()), off: null, timer: null, dirty: false, corte: !!corte };
  geo.start(); R.off = geo.onFix(f => add(f)); const f = geo.fix(); if (f) add(f);
  R.timer = setInterval(flush, FLUSH_MS); document.addEventListener('visibilitychange', onVis);
}
async function parar() {
  if (!R) return; const r = R; if (r.off) r.off(); clearInterval(r.timer); document.removeEventListener('visibilitychange', onVis);
  await flush(); R = null;
}
/* Parar de grabar (terminar, pausar, borrar). La pantalla vuelve a poder apagarse. */
export async function stop() { await parar(); await pantalla(false); }
/* Mantener la pantalla encendida (Wake Lock). Gasta batería: solo si el usuario lo pide. */
let lock = null;
export const pantallaOn = () => wake === 'on';
export async function pantalla(on) {
  wake = on ? 'on' : 'off';
  try {
    if (on && navigator.wakeLock && !lock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); }
    else if (!on && lock) { await lock.release(); lock = null; }
  } catch (e) { lock = null; }
  return !!lock;
}
export const pantallaSoportada = () => !!navigator.wakeLock;

/* GPX para abrirlo en otras apps. Contiene coordenadas reales: se queda en el móvil, nunca en el repo público. */
const x = s => String(s == null ? '' : s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
const iso = t => new Date(t).toISOString();
export function gpx(s, hs, nombre) {
  const pts = s.track || [];
  return '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Micología" xmlns="http://www.topografix.com/GPX/1/1">\n' +
    '<metadata><name>' + x('Salida ' + s.fecha + (s.titulo ? ' · ' + s.titulo : '')) + '</name></metadata>\n' +
    hs.map(h => '<wpt lat="' + h.lat + '" lon="' + h.lon + '"><time>' + iso(h.ts) + '</time><name>' + x(nombre(h)) + '</name>' + (h.cantidad ? '<desc>' + x(h.cantidad) + '</desc>' : '') + '</wpt>').join('\n') +
    (pts.length ? '\n<trk><name>' + x('Recorrido ' + s.fecha) + '</name>' + lineas(pts).map(l => '<trkseg>\n' + l.map(p => '<trkpt lat="' + p[0] + '" lon="' + p[1] + '"><time>' + iso(p[2] * 1000) + '</time></trkpt>').join('\n') + '\n</trkseg>').join('\n') + '</trk>' : '') + '\n</gpx>\n';
}
