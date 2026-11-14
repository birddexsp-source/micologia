/* Tiempo para el planificador: Open-Meteo (gratis, sin clave, datos de ECMWF/ERA5).
   - Previsión + últimos días en UNA llamada:  api.open-meteo.com/v1/forecast?past_days=…&forecast_days=…
   - Días antiguos (salidas pasadas):           archive-api.open-meteo.com/v1/archive?start_date=…&end_date=…
   Se guarda en el móvil (localStorage) por cuadrícula de 0,1° para poder consultarlo sin cobertura.
   Solo se envían a Open-Meteo unas coordenadas redondeadas a 0,1° (≈10 km): nunca el nombre ni el detalle de un spot. */
export const URL_PREV = 'https://api.open-meteo.com/v1/forecast', URL_ARCH = 'https://archive-api.open-meteo.com/v1/archive';
const VARS = 'precipitation_sum,temperature_2m_max,temperature_2m_min,temperature_2m_mean';
export const DIAS_ATRAS = 92, DIAS_ADELANTE = 16, VALIDEZ_MIN = 180;   // la previsión se refresca cada 3 h

const r1 = x => Math.round(x * 10) / 10;
export const celda = (lat, lon) => ({ lat: r1(lat), lon: r1(lon) });
const KEY = (lat, lon) => 'mi.clima.' + r1(lat).toFixed(1) + ',' + r1(lon).toFixed(1);
const IDX = 'mi.clima.idx';
const hay = () => { try { return !!localStorage; } catch (e) { return false; } };
const leer = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

/* fecha → AAAA-MM-DD (local) y operaciones de días sin líos de zona horaria */
const p2 = n => String(n).padStart(2, '0');
export const iso = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
export const aFecha = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const sumaDias = (s, n) => { const d = aFecha(s); d.setDate(d.getDate() + n); return iso(d); };
export const difDias = (a, b) => Math.round((aFecha(a) - aFecha(b)) / 864e5);

/* respuesta de Open-Meteo → { 'AAAA-MM-DD': {p, tmax, tmin, tmed} } (ignora los días sin dato) */
export function parsear(json) {
  const d = json && json.daily; if (!d || !Array.isArray(d.time)) throw new Error('respuesta inesperada');
  const out = {};
  d.time.forEach((t, i) => {
    const p = d.precipitation_sum && d.precipitation_sum[i], tx = d.temperature_2m_max && d.temperature_2m_max[i], tn = d.temperature_2m_min && d.temperature_2m_min[i], tm = d.temperature_2m_mean && d.temperature_2m_mean[i];
    if (p == null && tx == null && tn == null) return;
    out[t] = { p: p == null ? null : p, tmax: tx == null ? null : tx, tmin: tn == null ? null : tn, tmed: tm != null ? tm : (tx != null && tn != null ? r1((tx + tn) / 2) : null) };
  });
  return out;
}
async function pedir(url, ms = 12000) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(url, { signal: ac.signal }); if (!r.ok) throw new Error('Open-Meteo ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
export const urlPrevision = (lat, lon) => URL_PREV + '?latitude=' + r1(lat) + '&longitude=' + r1(lon) + '&daily=' + VARS + '&past_days=' + DIAS_ATRAS + '&forecast_days=' + DIAS_ADELANTE + '&timezone=Europe%2FMadrid';
export const urlArchivo = (lat, lon, desde, hasta) => URL_ARCH + '?latitude=' + r1(lat) + '&longitude=' + r1(lon) + '&start_date=' + desde + '&end_date=' + hasta + '&daily=' + VARS + '&timezone=Europe%2FMadrid';

/* guarda y recorta: máximo 8 celdas (las más recientes) */
function guardar(lat, lon, reg) {
  if (!hay()) return;
  const k = KEY(lat, lon); escribir(k, reg);
  let idx = leer(IDX) || []; idx = [k, ...idx.filter(x => x !== k)];
  idx.slice(8).forEach(x => { try { localStorage.removeItem(x); } catch (e) { } });
  escribir(IDX, idx.slice(0, 8));
}
export const enCache = (lat, lon) => (hay() && leer(KEY(lat, lon))) || null;

/* Devuelve { dias, fuente: 'red'|'cache'|'sin', edadMin, error }. Con red y datos frescos (<3 h) usa la caché. */
export async function cargar(lat, lon, { forzar = false, ahora = Date.now() } = {}) {
  const c = enCache(lat, lon), edad = c ? Math.round((ahora - c.t) / 60000) : null;
  if (c && !forzar && edad < VALIDEZ_MIN) return { dias: c.dias, fuente: 'cache', edadMin: edad };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return c ? { dias: c.dias, fuente: 'cache', edadMin: edad, error: 'sin conexión' } : { dias: {}, fuente: 'sin', edadMin: null, error: 'sin conexión' };
  try {
    const nuevo = parsear(await pedir(urlPrevision(lat, lon)));
    const dias = { ...(c ? c.dias : {}), ...nuevo };
    guardar(lat, lon, { t: ahora, dias });
    return { dias, fuente: 'red', edadMin: 0 };
  } catch (e) {
    return c ? { dias: c.dias, fuente: 'cache', edadMin: edad, error: String(e.message || e) } : { dias: {}, fuente: 'sin', edadMin: null, error: String(e.message || e) };
  }
}
/* Asegura que haya datos de un rango antiguo (salidas pasadas): lo que falte lo pide al archivo. Devuelve los días. */
export async function asegurarRango(lat, lon, desde, hasta, { ahora = Date.now() } = {}) {
  const c = enCache(lat, lon) || { t: 0, dias: {} };
  const faltan = []; for (let d = desde; d <= hasta; d = sumaDias(d, 1)) if (!c.dias[d]) faltan.push(d);
  if (!faltan.length || (typeof navigator !== 'undefined' && navigator.onLine === false)) return c.dias;
  const hastaArch = sumaDias(iso(new Date(ahora)), -6);                        // el archivo ERA5 va con ~5 días de retraso
  const a = faltan[0], b = faltan[faltan.length - 1] > hastaArch ? hastaArch : faltan[faltan.length - 1];
  if (a > b) return c.dias;
  try { const nuevo = parsear(await pedir(urlArchivo(lat, lon, a, b))); const dias = { ...c.dias, ...nuevo }; guardar(lat, lon, { t: c.t, dias }); return dias; }
  catch (e) { return c.dias; }
}
