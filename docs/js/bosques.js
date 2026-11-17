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
  /* bordes buenos: líneas entre pinar o frondosa (madura, no eucalipto) y prado/matorral/cortafuegos */
  j.bord = (j.bordes || []).map(([k, d]) => { const pts = [[d[0], d[1]]]; for (let i = 2; i < d.length; i += 2) { const u = pts[pts.length - 1]; pts.push([u[0] + d[i], u[1] + d[i + 1]]); }
    const P = pts.map(([y, x]) => [y / 1e5, x / 1e5]); let a = 90, b = -90, c = 180, e = -180; for (const [y, x] of P) { a = Math.min(a, y); b = Math.max(b, y); c = Math.min(c, x); e = Math.max(e, x); } return { k: k ? 'frondosa' : 'pinar', pts: P, bb: [a, b, c, e] }; });
  delete j.r; delete j.bordes; return j;
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
  return D.clases.filter(c => !ABIERTO.has(c.k)).map(c => ({ ...c, ha: t[c.k] || 0 })).filter(c => c.ha > 0);
}
export const estado = r => (D && D.estados[String(r.e)]) || '';
export const nivel = s => s >= 80 ? 'Muy bueno' : s >= 60 ? 'Bueno' : s >= 40 ? 'Regular' : s >= 15 ? 'Poco' : 'Nada';
/* hábitats de la app (los de las fichas) que corresponden a un rodal */
export const ABIERTO = new Set(['mato', 'abie', 'line']);
export const habitats = r => r.c.k === 'abie' ? ['prado'] : r.c.k === 'mato' ? ['claro', 'brezal'] : [...new Set(r.sp.flatMap(x => (D && D.habitats[x.n]) || []))];

/* ---------- qué rodea a un punto: base de «Lo que dicen tus setas» ---------- */
const GR = { auto: 'frondosa', fron: 'frondosa', pino: 'pinar', coni: 'coniferas', otra: 'otros', euca: 'eucalipto', mato: 'abierto', abie: 'abierto', line: 'abierto' };
/* grupo del punto y grupos distintos a menos de `m` metros (8 direcciones + a mitad de camino) */
export function contexto(lat, lon, m = 15) {
  if (!D) return null;
  const r = en(lat, lon), g = r ? GR[r.c.k] : 'fuera', vec = new Set();
  const dy = m / 111320, dx = m / (111320 * Math.cos(lat * Math.PI / 180));
  for (const f of [1, .5]) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [.7, .7], [-.7, -.7], [.7, -.7], [-.7, .7]]) {
    const q = en(lat + a * dy * f, lon + b * dx * f), k = q ? GR[q.c.k] : 'fuera';
    if (k !== g) vec.add(k);
  }
  return { r, g, vec, borde: [...vec].some(k => k === 'abierto' || k === 'fuera') || (g === 'abierto' && [...vec].some(k => k === 'pinar' || k === 'frondosa')) };
}
/* el «sitio» de un hallazgo en palabras (8 casos que se pueden comparar) */
export const SITIOS = [
  { k: 'ab-pin', n: 'Matorral, prado o cortafuegos pegado a pinar' },
  { k: 'ab-fro', n: 'Matorral o prado pegado a bosque autóctono' },
  { k: 'pin-b', n: 'Pinar, en el borde' },
  { k: 'pin-i', n: 'Pinar, por dentro' },
  { k: 'fro-b', n: 'Bosque autóctono o frondosas, en el borde' },
  { k: 'fro-i', n: 'Bosque autóctono o frondosas, por dentro' },
  { k: 'euc', n: 'Eucalipto' },
  { k: 'otro', n: 'Otros (prado abierto, otras coníferas, pueblo…)' },
];
export function sitio(c) {
  if (!c) return 'otro';
  if (c.g === 'abierto' || c.g === 'fuera') return c.vec.has('pinar') ? 'ab-pin' : c.vec.has('frondosa') ? 'ab-fro' : 'otro';
  if (c.g === 'pinar') return c.borde ? 'pin-b' : 'pin-i';
  if (c.g === 'frondosa') return c.borde ? 'fro-b' : 'fro-i';
  return c.g === 'eucalipto' ? 'euc' : 'otro';
}
/* estadística: hallazgos frente a lo andado (puntos de los recorridos): ¿dónde rinde más el tiempo? */
export function estadistica(hs, track) {
  const cuenta = l => { const t = {}; l.forEach(k => { t[k] = (t[k] || 0) + 1; }); return t; };
  const sh = hs.map(h => ({ h, k: sitio(contexto(h.lat, h.lon)) })), st = track.map(p => sitio(contexto(p[0], p[1])));
  const ch = cuenta(sh.map(x => x.k)), ct = cuenta(st), nh = sh.length || 1, nt = st.length;
  return { sh, nh: sh.length, nt, sitios: SITIOS.map(s => ({ ...s, h: ch[s.k] || 0, ph: (ch[s.k] || 0) / nh, pt: nt ? (ct[s.k] || 0) / nt : null })).map(s => ({ ...s, x: s.pt ? s.ph / s.pt : null })),
    bordeH: sh.filter(x => x.k !== 'pin-i' && x.k !== 'fro-i' && x.k !== 'otro' && x.k !== 'euc').length / nh,
    bordeT: nt ? st.filter(k => k !== 'pin-i' && k !== 'fro-i' && k !== 'otro' && k !== 'euc').length / nt : null };
}
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
        if (ABIERTO.has(r.c.k)) continue;
        g.beginPath();
        r.pts.forEach(([y, x], i) => { const p = m.project([y, x], z).subtract(nw); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); });
        g.closePath(); g.fillStyle = hex(r.c.c, r.c.k === 'euca' ? .42 : .22 + r.s / 400); g.fill(); g.strokeStyle = hex(r.c.c, .9); g.stroke();
      }
      /* bordes buenos encima: amarillo = pinar con prado/matorral, verde claro = bosque autóctono con prado/matorral */
      if (z >= 13) {
        g.lineWidth = z >= 16 ? 3.2 : z >= 15 ? 2.6 : 1.8; g.lineCap = 'round';
        for (const l of D.bord) {
          if (l.bb[1] < b.lat || l.bb[0] > a.lat || l.bb[3] < a.lng || l.bb[2] > b.lng) continue;
          g.beginPath(); l.pts.forEach(([y, x], i) => { const p = m.project([y, x], z).subtract(nw); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); });
          g.strokeStyle = l.k === 'pinar' ? '#ffd43b' : '#8ce99a'; g.stroke();
        }
      }
      return t;
    }
  });
  return new G({ pane: 'overlayPane', minZoom: 10, maxZoom: 20, updateWhenIdle: true, keepBuffer: 2 });
}
