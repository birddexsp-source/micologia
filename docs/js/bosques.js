/* Analizador de bosques: qué árbol hay en cada rodal según el Inventario Forestal de la CAPV 2024
   (© Gobierno Vasco / Eusko Jaurlaritza, CC BY 4.0; lo prepara tools/bosques/procesar.py en data/bosques.json).
   No se adivina nada desde la foto aérea: cada mancha es un rodal del inventario oficial con su especie dominante.
   El «interés» (0–100) es una guía para elegir dónde buscar: tipo de bosque (autóctono > frondosas plantadas > pinar
   > otras coníferas > otros árboles > eucalipto), lo maduro que está (fustal > latizal > monte bravo > repoblado > talado)
   y la mezcla de especies. No dice que haya setas: dice dónde merece más la pena mirar. */
let D = null, P = null;

/* polígonos codificados: [clase, interés, estado, [sp, ocupación, …], [lat0, lon0, dlat, dlon, …]] en grados × 1e5 */
function decodificar(j) {
  j.rod = j.r.map((r, i) => {
    const d = r[4], pts = [[d[0], d[1]]];
    for (let k = 2; k < d.length; k += 2) { const u = pts[pts.length - 1]; pts.push([u[0] + d[k], u[1] + d[k + 1]]); }
    let a = 90e5, b = -90e5, c = 180e5, e = -180e5;
    for (const [y, x] of pts) { if (y < a) a = y; if (y > b) b = y; if (x < c) c = x; if (x > e) e = x; }
    const sp = []; for (let k = 0; k < r[3].length; k += 2) sp.push({ n: j.especies[r[3][k]], o: r[3][k + 1] });
    return { i, c: j.clases[r[0]], s: r[1], e: r[2], sp, pts: pts.map(([y, x]) => [y / 1e5, x / 1e5]), bb: [a / 1e5, b / 1e5, c / 1e5, e / 1e5] };
  });
  j.calientes.forEach(z => { z.especies = z.sp.map(k => j.especies[k]); });
  delete j.r; return j;
}
export const cargar = () => P || (P = fetch('data/bosques.json').then(r => r.ok ? r.json() : null).then(j => (D = j && decodificar(j))).catch(() => (P = null, null)));
export const listo = () => !!D;
export const datos = () => D;

const dentro = (lat, lon, pts) => {
  let x = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [yi, xi] = pts[i], [yj, xj] = pts[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) x = !x;
  }
  return x;
};
/* rodal que hay en un punto (null fuera de bosque o fuera de la zona cubierta) */
export function en(lat, lon) {
  if (!D) return null;
  return enRapido(lat, lon);
}
/* el rodal más cercano a menos de `m` metros (para spots que caen justo en el borde, en una pista o un claro) */
export function cerca(lat, lon, m = 40) {
  const r = en(lat, lon); if (r || !D) return r;
  const dy = m / 111320, dx = m / (111320 * Math.cos(lat * Math.PI / 180));
  for (const [a, b] of [[dy, 0], [-dy, 0], [0, dx], [0, -dx], [dy * .7, dx * .7], [-dy * .7, -dx * .7], [dy * .7, -dx * .7], [-dy * .7, dx * .7]]) { const q = en(lat + a, lon + b); if (q) return q; }
  return null;
}
/* superficie aproximada (ha) de un rodal */
export function ha(r) {
  const k = 111320, cx = Math.cos(r.pts[0][0] * Math.PI / 180); let s = 0;
  for (let i = 0, j = r.pts.length - 1; i < r.pts.length; j = i++) s += (r.pts[j][1] * cx * k) * (r.pts[i][0] * k) - (r.pts[i][1] * cx * k) * (r.pts[j][0] * k);
  return Math.abs(s / 2) / 1e4;
}
/* qué hay en un recuadro del mapa: hectáreas por tipo de bosque */
export function reparto(bounds) {
  if (!D) return [];
  const [s, n, w, e] = bounds, t = {};
  if ((n - s) * (e - w) > 0.5) return [];   /* mapa muy alejado: no tiene sentido */
  for (const r of enRecuadro(s, n, w, e)) t[r.c.k] = (t[r.c.k] || 0) + ha(r);
  return D.clases.map(c => ({ ...c, ha: t[c.k] || 0 })).filter(c => c.ha > 0);
}
export const estado = r => (D && D.estados[String(r.e)]) || '';
export const nivel = s => s >= 80 ? 'Muy bueno' : s >= 60 ? 'Bueno' : s >= 40 ? 'Regular' : s >= 15 ? 'Poco' : 'Nada';
/* hábitats de la app (los de las fichas) que corresponden a un rodal */
export const habitats = r => [...new Set(r.sp.flatMap(x => (D && D.habitats[x.n]) || []))];
export const ESTADOS_TXT = { Repoblado: 'recién plantado', 'Monte bravo': 'joven y cerrado', Latizal: 'joven, troncos finos', Fustal: 'maduro, árboles grandes', Talado: 'cortado' };

/* índice espacial: rodales por casillas de 0,02° para buscar rápido */
const CAS = 0.02, ck = (y, x) => Math.floor(y / CAS) + ':' + Math.floor(x / CAS);
let IDX = null;
function indice() {
  if (IDX) return IDX; IDX = new Map();
  for (const r of D.rod) for (let y = Math.floor(r.bb[0] / CAS); y <= Math.floor(r.bb[1] / CAS); y++) for (let x = Math.floor(r.bb[2] / CAS); x <= Math.floor(r.bb[3] / CAS); x++) { const k = y + ':' + x; (IDX.get(k) || IDX.set(k, []).get(k)).push(r); }
  return IDX;
}
function enRecuadro(s, n, w, e) {
  const I = indice(), vistos = new Set();
  for (let y = Math.floor(s / CAS); y <= Math.floor(n / CAS); y++) for (let x = Math.floor(w / CAS); x <= Math.floor(e / CAS); x++)
    for (const r of I.get(y + ':' + x) || []) if (r.bb[1] >= s && r.bb[0] <= n && r.bb[3] >= w && r.bb[2] <= e) vistos.add(r);
  return vistos;
}
export function enRapido(lat, lon) { for (const r of enRecuadro(lat, lat, lon, lon)) if (dentro(lat, lon, r.pts)) return r; return null; }

/* capa para Leaflet: teselas de canvas dibujadas a partir de los rodales (rápido con miles de rodales y sin tirones al mover) */
export function capa(L) {
  const hex = (c, a) => { const n = parseInt(c.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; };
  const G = L.GridLayer.extend({
    createTile(co) {
      const t = document.createElement('canvas'), sz = this.getTileSize(), r2 = window.devicePixelRatio > 1 ? 2 : 1;
      t.width = sz.x * r2; t.height = sz.y * r2; const g = t.getContext('2d'); g.scale(r2, r2);
      const m = this._map, nw = co.scaleBy(sz), z = co.z;
      const a = m.unproject(nw, z), b = m.unproject(nw.add(sz), z);
      const lista = enRecuadro(b.lat, a.lat, a.lng, b.lng);
      g.lineJoin = 'round'; g.lineWidth = z >= 15 ? 1 : .6;
      for (const r of lista) {
        g.beginPath();
        r.pts.forEach(([y, x], i) => { const p = m.project([y, x], z).subtract(nw); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); });
        g.closePath(); g.fillStyle = hex(r.c.c, r.c.k === 'euca' ? .42 : .22 + r.s / 400); g.fill(); g.strokeStyle = hex(r.c.c, .9); g.stroke();
      }
      return t;
    }
  });
  return new G({ pane: 'overlayPane', minZoom: 10, maxZoom: 20, updateWhenIdle: true, keepBuffer: 2 });
}
