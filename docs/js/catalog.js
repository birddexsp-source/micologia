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

/* Colecciones, como los capítulos de un libro: familias cercanas juntas. Un id en «ids» manda sobre la familia. */
export const COLECCIONES = [
  { id: 'amanitas', titulo: 'Amanitas', color: '#e5484d', fam: ['Amanitaceae'], intro: 'Láminas blancas y, casi siempre, anillo en el pie y volva (una bolsa) en la base. Aquí están las setas más peligrosas: desentierra siempre la base.' },
  { id: 'lepiotas', titulo: 'Parasoles, lepiotas y champiñones', color: '#c9a27a', fam: ['Agaricaceae'], intro: 'Parasoles, lepiotas, champiñones y barbudas. Ojo con las lepiotas pequeñas: hay mortales que parecen parasoles en miniatura.' },
  { id: 'claras', titulo: 'Láminas claras: tricolomas, clitocibes…', color: '#d8d2c4', fam: ['Tricholomataceae', 'Clitocybaceae', 'Lyophyllaceae', 'Hygrophoraceae', 'Hydnangiaceae', 'Marasmiaceae', 'Mycenaceae', 'Entolomataceae'], intro: 'Setas de láminas con esporada blanca o clara (Entoloma, rosada). Muchas se parecen entre sí: el olor y el hábitat ayudan mucho.' },
  { id: 'oscuras', titulo: 'Láminas oscuras: cortinarios, coprinos…', color: '#a0703c', fam: ['Cortinariaceae', 'Inocybaceae', 'Hymenogastraceae', 'Strophariaceae', 'Psathyrellaceae', 'Paxillaceae'], intro: 'Esporas pardas, ocres o negras. Aquí están las que dañan el riñón (cortinarios) y las que se deshacen en tinta (coprinos).' },
  { id: 'rusulas', titulo: 'Rúsulas y lactarios', color: '#b48cff', fam: ['Russulaceae'], intro: 'Carne que se rompe como tiza, sin fibras. Los lactarios sueltan leche (látex) al cortarlos: fíjate en su color.' },
  { id: 'boletos', titulo: 'Boletos', color: '#e0a458', fam: ['Boletaceae', 'Suillaceae'], intro: 'Debajo del sombrero, tubos que acaban en poros, como una esponja. Mira el color de los poros, si la carne azulea y el dibujo del pie (red o puntos).' },
  { id: 'rebozuelos', titulo: 'Rebozuelos, trompetas y lengua de gato', color: '#f0b429', fam: ['Cantharellaceae', 'Hydnaceae'], ids: ['hygrophoropsis-aurantiaca'], intro: 'Sin láminas verdaderas: pliegues bajos y gruesos (rebozuelos, trompetas) o pinchos (lengua de gato). Aquí también el falso rebozuelo, que sí tiene láminas.' },
  { id: 'madera', titulo: 'Setas de árbol y poliporos', color: '#7ccf8e', fam: ['Physalacriaceae', 'Pleurotaceae', 'Polyporaceae', 'Laetiporaceae', 'Fistulinaceae', 'Auriculariaceae', 'Sparassidaceae', 'Omphalotaceae'], intro: 'Salen sobre troncos, tocones o raíces: setas de ostra, armilarias, yesqueros y orejas.' },
  { id: 'bolas', titulo: 'Bejines y bolas', color: '#cfd9d5', fam: ['Sclerodermataceae'], ids: ['lycoperdon-perlatum'], intro: 'Una bola sin láminas que por dentro acaba en polvo de esporas. Córtala de arriba abajo: si dentro se ve la silueta de una seta, es un huevo de Amanita.' },
  { id: 'faloides', titulo: 'Falos y jaulas', color: '#ff7a59', fam: ['Phallaceae'], intro: 'Salen de un «huevo» y huelen a carroña para atraer a las moscas, que esparcen sus esporas.' },
  { id: 'ascos', titulo: 'Colmenillas, bonetes y copas', color: '#9fd3ff', fam: ['Morchellaceae', 'Discinaceae', 'Helvellaceae', 'Pyronemataceae'], intro: 'Ascomicetos: sin láminas ni poros. Colmenillas con alveolos, bonetes en forma de silla y copas. Las Gyromitra son mortales.' }
];
const OTRAS = { id: 'otras', titulo: 'Otras', color: '#7b8683', fam: [], intro: '' };
export const coleccion = e => COLECCIONES.find(c => (c.ids || []).includes(e.id)) || COLECCIONES.find(c => c.fam.includes(e.familia)) || OTRAS;
