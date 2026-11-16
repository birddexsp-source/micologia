/* Una salida es el día entero; dentro tiene varias ZONAS (tramos): cada una empieza al llegar a un sitio (donde aparcas) y se cierra al
   volver al coche o cambiar de zona. Entre zona y zona no se cuenta tiempo ni se graba el recorrido.
   Cada tramo: { id, zonaId (spot inicial), ini, fin|null }. Los puntos del recorrido (salida.track) se reparten por su hora. */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const lista = s => (s && s.tramos) || [];
export const tiene = s => lista(s).length > 0;
export const activo = s => lista(s).find(t => t.fin == null) || null;
export const dur = (t, now = Date.now()) => Math.max(0, Math.round(((t.fin == null ? now : t.fin) - t.ini) / 1000));
export const durTotal = (s, now = Date.now()) => lista(s).reduce((a, t) => a + dur(t, now), 0);
export const abrir = (s, zonaId, now = Date.now()) => [...cerrar(s, now), { id: uid(), zonaId, ini: now, fin: null }];
export const cerrar = (s, now = Date.now()) => lista(s).map(t => t.fin == null ? { ...t, fin: now } : t);
const dentro = (t, ms, m = 0) => ms >= t.ini - m && (t.fin == null || ms <= t.fin + m);
/* puntos del recorrido de una zona: los registrados mientras estuvo abierta */
export const puntos = (t, track) => (track || []).filter(p => dentro(t, p[2] * 1000, 5000));
/* a qué zona pertenece un instante (un minuto de margen); null = entre zonas */
export const deTs = (s, ms) => lista(s).find(t => dentro(t, ms, 60000)) || null;
/* spots de una zona: el inicial y los que creaste durante ella */
export const spotsDe = (s, t, zonas) => zonas.filter(z => z.id === t.zonaId || ((s.zonaIds || []).includes(z.id) && z.creada >= t.ini - 1000 && (t.fin == null || z.creada <= t.fin + 1000)));
/* salida antigua (sin zonas) → una sola zona con todo el recorrido: así todo el código trata igual */
export const comoTramos = s => tiene(s) ? lista(s) : (s && s.creada ? [{ id: 'unica', zonaId: (s.zonaIds || [])[0] || null, ini: s.creada, fin: s.fin || null, legado: true }] : []);
