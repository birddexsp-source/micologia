/* Mapa sin conexión: descarga las teselas de satélite (PNOA, IGN, CC BY 4.0) de las zonas elegidas y las guarda en una caché
   propia que el service worker consulta primero y que NUNCA se recorta sola.
   El callejero de OpenStreetMap NO se descarga en bloque (lo prohíbe su política de uso): solo se guardan las teselas que llegas a ver. */
import { PNOA } from './map.js';

export const CACHE = 'mapa-offline-v1';
const KEY = 'mi.offmap', ZMIN = 9, MAX_TESELAS = 14000, KB_TESELA = 22;   // KB_TESELA: media orientativa de una tesela PNOA (jpeg 256 px)
export const ZMAX = { normal: 17, alto: 18 };

export const urlTesela = (z, x, y) => PNOA.replace('{z}', z).replace('{x}', x).replace('{y}', y);
const tx = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z);
const ty = (lat, z) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z); };
const clampLat = l => Math.max(-85, Math.min(85, l));

/* caja [sur, oeste, norte, este] a `km` kilómetros alrededor de un punto */
export function cajaAlrededor(lat, lon, km) {
  const dLat = km / 111.32, dLon = km / (111.32 * Math.cos(lat * Math.PI / 180));
  return [clampLat(lat - dLat), lon - dLon, clampLat(lat + dLat), lon + dLon];
}
/* teselas [z,x,y] de varias cajas, sin repetir (los spots cercanos se solapan) */
export function teselas(cajas, zmax = ZMAX.normal) {
  const vistas = new Set(), out = [];
  for (const [s, w, n, e] of cajas) {
    for (let z = ZMIN; z <= zmax; z++) {
      const x0 = tx(w, z), x1 = tx(e, z), y0 = ty(n, z), y1 = ty(s, z);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const k = z + '/' + x + '/' + y; if (!vistas.has(k)) { vistas.add(k); out.push([z, x, y]); } }
    }
  }
  return out;
}
export const estimarMB = n => Math.round(n * KB_TESELA / 1024);
export const demasiadas = n => n > MAX_TESELAS;
export { MAX_TESELAS };

/* ---------- zonas predefinidas (Bermeo y la costa de Urdaibai) ---------- */
/* Coordenadas aproximadas (Wikipedia, verplayas.com, mapas): sobra margen, no hace falta precisión de metros. */
export const PRESETS = [
  { clave: 'costa', nombre: 'Costa: Armintza → Laida y Laga', desc: 'Toda la franja de costa, 1,5 km a cada lado', km: 1.5,
    ruta: [[43.4114, -2.9022], [43.4306, -2.8061], [43.4528, -2.7544], [43.4200, -2.7264], [43.4075, -2.6985], [43.4003, -2.6850], [43.4093, -2.6574]] },
  { clave: 'bermeo', nombre: 'Bermeo', desc: 'El pueblo y sus alrededores (3 km)', km: 3, centro: [43.4200, -2.7264] },
  { clave: 'bakio', nombre: 'Bakio', desc: 'Pueblo y playa (3 km)', km: 3, centro: [43.4306, -2.8061] },
  { clave: 'mundaka', nombre: 'Mundaka', desc: 'Pueblo y ría (3 km)', km: 3, centro: [43.4075, -2.6985] }
];
/* cuadrados de lado 2·km repartidos a lo largo de una ruta (su unión forma la franja) */
export function cajasRuta(ruta, km) {
  const out = [], paso = km;   // km de separación entre centros
  for (let i = 0; i < ruta.length - 1; i++) {
    const [a, b] = [ruta[i], ruta[i + 1]], dy = (b[0] - a[0]) * 111.32, dx = (b[1] - a[1]) * 111.32 * Math.cos(a[0] * Math.PI / 180), n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / paso));
    for (let k = 0; k <= n; k++) out.push(cajaAlrededor(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, km));
  }
  return out;
}
export const cajasPreset = p => p.ruta ? cajasRuta(p.ruta, p.km) : [cajaAlrededor(p.centro[0], p.centro[1], p.km)];

/* ---------- lo que hay guardado ---------- */
const leer = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
const guardar = l => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) { } };
export const zonas = () => leer();
export async function estado() {
  try { const c = await caches.open(CACHE), n = (await c.keys()).length; return { n, zonas: leer(), ok: true }; }
  catch (e) { return { n: 0, zonas: [], ok: false }; }
}
export async function borrarTodo() { try { await caches.delete(CACHE); } catch (e) { } guardar([]); }
/* ¿está esta zona (clave) guardada completa con al menos este detalle? */
export const guardada = (clave, zmax = ZMAX.normal) => leer().some(z => z.clave === clave && z.completa && z.zmax >= zmax);
const dentro = (c, lat, lon) => lat >= c[0] && lon >= c[1] && lat <= c[2] && lon <= c[3];
/* ¿está esta posición cubierta por alguna zona descargada completa? */
export const cubierta = (lat, lon) => leer().some(z => z.completa && (z.cajas || [z.caja]).some(c => dentro(c, lat, lon)));

/* ---------- descarga ---------- */
/* grupos: [{clave, nombre, cajas}]. prog({hechas, total, bytes, fallos}); `ctl.cancel = true` la detiene.
   Las teselas ya guardadas no se vuelven a bajar. Un grupo solo cuenta como «guardado» si no hubo fallos ni se paró. */
export async function descargar({ grupos, zmax = ZMAX.normal }, prog = () => { }, ctl = {}) {
  const lista = teselas(grupos.flatMap(g => g.cajas), zmax);
  if (demasiadas(lista.length)) throw new Error('demasiadas');
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }   // pide que el navegador no lo borre solo
  const c = await caches.open(CACHE); let i = 0, hechas = 0, bytes = 0, fallos = 0, nuevas = 0;
  const trabajo = async () => {
    while (i < lista.length && !ctl.cancel) {
      const [z, x, y] = lista[i++], u = urlTesela(z, x, y);
      try {
        if (!(await c.match(u))) {
          let r = null;
          for (let n = 0; n < 2 && !r; n++) { try { const q = await fetch(u, { mode: 'cors' }); if (q.ok) r = q; } catch (e) { } }
          if (r) { const b = await r.clone().blob(); bytes += b.size; await c.put(u, r); nuevas++; } else fallos++;
        }
      } catch (e) { fallos++; }
      hechas++; if (hechas % 10 === 0 || hechas === lista.length) prog({ hechas, total: lista.length, bytes, fallos });
    }
  };
  await Promise.all(Array.from({ length: 6 }, trabajo));
  const completa = !ctl.cancel && fallos === 0;
  if (completa) {
    const claves = new Set(grupos.map(g => g.clave));
    const l = leer().filter(z => !claves.has(z.clave));
    grupos.forEach(g => l.push({ id: Date.now() + '-' + g.clave, clave: g.clave, nombre: g.nombre, cajas: g.cajas, zmax, fecha: Date.now(), completa: true }));
    guardar(l);
  }
  prog({ hechas, total: lista.length, bytes, fallos });
  return { total: lista.length, hechas, nuevas, fallos, bytes, cancelada: !!ctl.cancel };
}
