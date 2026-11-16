/* Zona de una salida: el «círculo» que cubre los spots y los hallazgos de esa salida (por dónde te has movido buscando).
   Centro = centro del rectángulo que los envuelve; radio = distancia al punto más lejano + un margen (mínimo 40 m). */
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
  if (salida && (salida.zonaIds || []).length) { const c = cerca(zonas.filter(z => salida.zonaIds.includes(z.id))); if (c && c[1] <= 600) return c[0].id; }
  const c = cerca(zonas); return c && c[1] <= 150 ? c[0].id : null;
}
