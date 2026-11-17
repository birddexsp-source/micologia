/* GPS: vigila la posición y guarda siempre el último punto con su precisión. */
let watch = null, last = null, lastErr = null;
const subs = new Set();
/* posición que llega por otra vía (el GPS nativo de la app Android): sirve igual para el punto azul y para marcar */
export function poner(p) {
  if (!p || p.lat == null || (last && last.ts > p.ts + 1000 && Date.now() - last.ts < 15000)) return;
  last = { lat: p.lat, lon: p.lon, acc: Math.round(p.acc || 0), ts: p.ts || Date.now() }; lastErr = null; subs.forEach(f => f(last, null));
}
/* en la app Android el GPS de la web (dentro de la app) a veces no da posición: se usa también el GPS nativo, solo con la app abierta */
const nat = () => { try { const C = window.Capacitor; return C && C.isNativePlatform && C.isNativePlatform() ? ((C.Plugins && C.Plugins.BackgroundGeolocation) || (C.registerPlugin && C.registerPlugin('BackgroundGeolocation'))) : null; } catch (e) { return null; } };
let natW = null;
function startNativo() {
  const B = nat(); if (!B || natW) return; natW = 'pidiendo';
  Promise.resolve(B.addWatcher({ requestPermissions: true, stale: false, distanceFilter: 3 }, (l, err) => {
    if (l) poner({ lat: l.latitude, lon: l.longitude, acc: l.accuracy, ts: l.time || Date.now() });
    else if (err && !last) { lastErr = { code: err.code === 'NOT_AUTHORIZED' ? 1 : 2 }; subs.forEach(f => f(null, lastErr)); }
  })).then(id => { natW = id; }).catch(() => { natW = null; });
}
export function start() {
  startNativo();
  if (watch !== null || !navigator.geolocation) return;
  watch = navigator.geolocation.watchPosition(
    p => { last = { lat: p.coords.latitude, lon: p.coords.longitude, acc: Math.round(p.coords.accuracy), ts: p.timestamp }; lastErr = null; subs.forEach(f => f(last, null)); },
    e => { lastErr = e; subs.forEach(f => f(last, e)); },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
}
export const fix = () => last;
export const error = () => lastErr;
export const onFix = f => { subs.add(f); return () => subs.delete(f); };
export function waitFix(ms = 8000) {
  if (last) return Promise.resolve(last);
  if (lastErr && lastErr.code === 1) return Promise.resolve(null);   // permiso denegado: no hay nada que esperar
  return new Promise(ok => {
    const t = setTimeout(() => { off(); ok(null); }, ms);
    const off = onFix((f, e) => { if (f || (e && e.code === 1)) { clearTimeout(t); off(); ok(f); } });
  });
}
export const msgError = e => !e ? '' : e.code === 1 ? 'Permiso de ubicación denegado' : e.code === 2 ? 'Sin señal GPS' : 'GPS tardando…';
