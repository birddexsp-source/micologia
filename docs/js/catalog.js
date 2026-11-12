/* Catálogo de especies (solo lectura, docs/data/especies.json). */
import { norm } from './util.js';
export const CLASES = {
  mortal: { label: 'Mortal', color: '#a11d2a', orden: 0 },
  toxica: { label: 'Tóxica', color: '#e5484d', orden: 1 },
  no_comestible: { label: 'No comestible', color: '#f08a3c', orden: 2 },
  comestible_condicional: { label: 'Comestible con condiciones', color: '#e5b13a', orden: 3 },
  comestible_buena: { label: 'Comestible buena', color: '#46b36b', orden: 4 },
  cond_fuentes: { label: 'Comestible con condiciones', color: '#e5b13a', orden: 3.5 },
  ok_fuentes: { label: 'Comestible', color: '#46b36b', orden: 4.5 },
  sin_datos: { label: 'Sin datos', color: '#7b8683', orden: 5 }
};
/* Lo que se muestra: si las fuentes dicen que es comestible, se marca así (sigue en borrador, sin revisión experta) */
export const vista = e => e.comestibilidad ? (e.comestibilidad.nivel === 'si' ? 'ok_fuentes' : 'cond_fuentes') : e.clase;
export const NIVELES = { borrador: 'Borrador · sin contrastar', contrastada: 'Contrastada (≥2 fuentes)', revisada: 'Revisada por experto' };
let data = null;
export async function load() { if (!data) { const r = await fetch('data/especies.json'); data = await r.json(); } return data; }
export const todas = () => data ? data.especies : [];
export const aviso = () => data ? data.aviso : '';
export const byId = id => todas().find(e => e.id === id) || null;
export const nombre = e => e ? (e.nombresComunes && e.nombresComunes.es && e.nombresComunes.es[0] ? e.nombresComunes.es[0] + ' · ' : '') + e.nombreCientifico : '';
export function buscar(q, { clase = '', grupo = '' } = {}) {
  const n = norm(q).trim();
  return todas().filter(e => (!clase || vista(e) === clase) && (!grupo || e.grupo === grupo) &&
    (!n || norm([e.nombreCientifico, ...(e.sinonimos || []), ...Object.values(e.nombresComunes || {}).flat()].join(' ')).includes(n)))
    .sort((a, b) => CLASES[vista(a)].orden - CLASES[vista(b)].orden || a.nombreCientifico.localeCompare(b.nombreCientifico));
}
