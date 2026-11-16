/* Zona de una salida: el «círculo» que cubre los spots y los hallazgos de esa salida (por dónde te has movido buscando).
   Centro = centro del rectángulo que los envuelve; radio = distancia al punto más lejano + un margen (mínimo 40 m). */
import * as tr from './tramos.js';
const R = 6371000, rad = x => x * Math.PI / 180;
export const dist = (a, b) => { const q = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(q)); };
const ok = p => p && Number.isFinite(p.lat) && Number.isFinite(p.lon);

/* puntos de una salida: sus spots (zonaIds y los de sus hallazgos) y todos sus hallazgos */
export function puntosSalida(s, hs, zonas) {
  const ids = new Set([...(s.zonaIds || []), ...hs.filter(h => h.salidaId === s.id).map(h => h.zonaId).filter(Boolean)]);
  const sp = zonas.filter(z => ids.has(z.id) && ok(z)), hh = hs.filter(h => h.salidaId === s.id && ok(h));
  return { spots: sp, hallazgos: hh, puntos: [...sp, ...hh].map(p => ({ lat: p.lat, lon: p.lon })) };
}
export function circulo(puntos, margen = 25) {
  const p = puntos.filter(ok); if (!p.length) return null;
  const la = p.map(x => x.lat), lo = p.map(x => x.lon), c = { lat: (Math.min(...la) + Math.max(...la)) / 2, lon: (Math.min(...lo) + Math.max(...lo)) / 2 };
  return { lat: c.lat, lon: c.lon, r: Math.round(Math.max(40, Math.max(...p.map(x => dist(c, x))) + margen)), n: p.length };
}
export const zonaSalida = (s, hs, zonas) => { const { spots, hallazgos, puntos } = puntosSalida(s, hs, zonas); const c = circulo(puntos); return c && { ...c, spots: spots.length, especies: new Set(hallazgos.map(h => h.especieId || h.especieTxt).filter(Boolean)).size, hallazgos: hallazgos.length }; };

/* spot por defecto en la posición `pos`: dentro de una salida, el spot más cercano de ESA salida (hasta 600 m, es su zona);
   si no, el spot más cercano a menos de 150 m */
export function spotDefecto(pos, zonas, salida) {
  if (!ok(pos)) return null;
  const cerca = l => l.filter(z => ok(z)).map(z => [z, dist(pos, z)]).sort((a, b) => a[1] - b[1])[0];
  /* con una zona en marcha: sus spots (el inicial y los que has creado en ella) */
  const t = salida && tr.activo(salida);
  if (t) { const c = cerca(tr.spotsDe(salida, t, zonas)); if (c && c[1] <= 600) return c[0].id; }
  if (salida && (salida.zonaIds || []).length) { const c = cerca(zonas.filter(z => salida.zonaIds.includes(z.id))); if (c && c[1] <= 600) return c[0].id; }
  const c = cerca(zonas); return c && c[1] <= 150 ? c[0].id : null;
}

/* ---------- la zona real: la «cinta» que has pisado ----------
   Cada tramo del recorrido se ensancha 25 m a cada lado (más un octógono en cada punto): así una ida y vuelta es una franja, un cuadrado es un cuadrado
   y no un círculo. Todos los anillos giran igual, de modo que al pintarlos juntos (relleno «nonzero») se funden en una sola mancha. */
export const ANCHO = 25;
const MAX_PTS = 260;
function aXY(p, o) { return [(p[1] - o[1]) * Math.cos(rad(o[0])) * R * Math.PI / 180, (p[0] - o[0]) * R * Math.PI / 180]; }
function deXY(xy, o) { return [o[0] + xy[1] / (R * Math.PI / 180), o[1] + xy[0] / (R * Math.PI / 180 * Math.cos(rad(o[0])))]; }
const area2 = r => r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0);
const antihorario = r => area2(r) >= 0 ? r : r.slice().reverse();
export function cinta(puntos, ancho = ANCHO) {
  const p = puntos.filter(x => Array.isArray(x) ? Number.isFinite(x[0]) : ok(x)).map(x => Array.isArray(x) ? [x[0], x[1]] : [x.lat, x.lon]);
  if (!p.length) return [];
  const paso = Math.max(1, Math.ceil(p.length / MAX_PTS)), q = p.filter((_, i) => i % paso === 0 || i === p.length - 1), o = q[0], xy = q.map(x => aXY(x, o)), anillos = [];
  xy.forEach(c => anillos.push(antihorario(Array.from({ length: 8 }, (_, k) => [c[0] + ancho * Math.cos(k * Math.PI / 4), c[1] + ancho * Math.sin(k * Math.PI / 4)]))));
  for (let i = 1; i < xy.length; i++) {
    const a = xy[i - 1], b = xy[i], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); if (l < 0.5) continue;
    const nx = -dy / l * ancho, ny = dx / l * ancho;
    anillos.push(antihorario([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]));
  }
  return anillos.map(r => r.map(c => deXY(c, o)));
}
/* las zonas de una salida, listas para dibujar y resumir */
export function zonasDeSalida(s, hs, zonas) {
  const lista = tr.comoTramos(s), mios = hs.filter(h => h.salidaId === s.id), now = Date.now();
  return lista.map((t, i) => {
    const legado = !!t.legado, hh = legado ? mios : mios.filter(h => h.tramoId === t.id || (!h.tramoId && tr.deTs({ tramos: [t] }, h.ts)));
    const pts = legado ? (s.track || []) : tr.puntos(t, s.track), sp = legado ? zonas.filter(z => (s.zonaIds || []).includes(z.id)) : tr.spotsDe(s, t, zonas);
    const base = [...pts.map(q => [q[0], q[1]]), ...hh.filter(ok).map(h => [h.lat, h.lon]), ...sp.filter(ok).map(z => [z.lat, z.lon])];
    const inicial = zonas.find(z => z.id === t.zonaId) || sp[0] || null;
    const c = circulo(base.map(q => ({ lat: q[0], lon: q[1] })));
    return { id: t.id, i, tramo: t, legado, nombre: inicial ? inicial.nombre : 'Zona ' + (i + 1), spotId: inicial ? inicial.id : null,
      anillos: pts.length >= 2 ? cinta(base) : [], circulo: c, hallazgos: hh.length, especies: new Set(hh.map(h => h.especieId || h.especieTxt).filter(Boolean)).size,
      m: pts.length >= 2 ? Math.round(metrosPts(pts)) : 0, seg: legado ? Math.max(0, Math.round(((s.fin || now) - (s.creada || now)) / 1000)) : tr.dur(t, now), en: !legado && t.fin == null, hhs: hh };
  });
}
const metrosPts = pts => { let m = 0; for (let i = 1; i < pts.length; i++) if (pts[i][3] !== 1) m += dist({ lat: pts[i - 1][0], lon: pts[i - 1][1] }, { lat: pts[i][0], lon: pts[i][1] }); return m; };
export const COLORES = ['#4cc3d9', '#e0a458', '#b07cf0', '#6fd08c', '#f07c9a'];
export const color = i => COLORES[i % COLORES.length];
