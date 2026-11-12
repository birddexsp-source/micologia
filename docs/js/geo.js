/* GPS: vigila la posición y guarda siempre el último punto con su precisión. */
let watch = null, last = null, lastErr = null;
const subs = new Set();
export function start() {
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
