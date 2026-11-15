/* Nombre del sitio donde estás, sin conexión: «Demiku, Bermeo», «Peña de Oro, Bermeo»…
   Datos: Nomenclátor Geográfico Básico de España (IGN, CC-BY 4.0), el mismo callejero que usa AveDex, recortado a Bizkaia
   (docs/data/topo.json, lo genera tests/tools/toponimos.py). Se elige el topónimo con más puntuación:
     puntuación = peso_del_tipo × (1 − distancia / radio_del_tipo)   (descartando los que quedan fuera de su radio)
   y se le añade el municipio más cercano. Nunca llama a internet. */
let D = null, P = null;
export const cargar = () => P || (P = fetch('data/topo.json').then(r => r.ok ? r.json() : null).then(j => (D = j)).catch(() => (P = null, null)));
export const listo = () => !!D;

const R = 6371000, rad = x => x * Math.PI / 180;
export function distM(la1, lo1, la2, lo2) { const a = Math.sin(rad(la2 - la1) / 2) ** 2 + Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(rad(lo2 - lo1) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(a)); }
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/* { etiqueta, sitio, tipo, distanciaM, municipio } · null si no hay datos o el punto cae fuera de la zona cubierta */
export function nombrar(lat, lon, d = D) {
  if (!d || lat == null || lon == null) return null;
  const [s, w, n, e] = d.zona; if (lat < s || lat > n || lon < w || lon > e) return null;
  let mun = null, md = Infinity;
  for (const [nom, la, lo] of d.m) { const x = distM(lat, lon, la, lo); if (x < md) { md = x; mun = nom; } }
  let mejor = null, ms = -Infinity;
  for (const [nom, ti, la, lo] of d.n) {
    if (Math.abs(la - lat) > 0.08 || Math.abs(lo - lon) > 0.11) continue;          // el radio mayor es 8 km
    const p = d.pesos[ti]; if (!p) continue;
    const x = distM(lat, lon, la, lo); if (x > p[1]) continue;
    const sc = p[0] * (1 - x / p[1]); if (sc > ms) { ms = sc; mejor = { sitio: nom, tipo: d.tipos[ti], distanciaM: Math.round(x) }; }
  }
  if (!mejor) return mun ? { etiqueta: 'Cerca de ' + mun, sitio: null, tipo: null, distanciaM: null, municipio: mun } : null;
  const mismo = mun && norm(mun) === norm(mejor.sitio);
  return { ...mejor, etiqueta: mun && !mismo ? mejor.sitio + ', ' + mun : mejor.sitio, municipio: mun };
}
/* Nombre para un spot nuevo, sin repetir uno que ya exista («Demiku, Bermeo 2») */
export function nombreSpot(lat, lon, existentes = []) {
  const r = nombrar(lat, lon); if (!r) return '';
  const usados = new Set(existentes.map(x => norm(x)));
  let nom = r.etiqueta, k = 2; while (usados.has(norm(nom))) nom = r.etiqueta + ' ' + k++;
  return nom;
}
export const FUENTE = 'Topónimos: Nomenclátor Geográfico Básico de España © IGN (CC BY 4.0)';
