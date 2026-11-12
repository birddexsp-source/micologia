/* Sincronización con el repo privado de datos (API git de GitHub, un JSON por documento).
   En el repo:  data/<coleccion>/<id>.json = {u, del, d}   (gana el más reciente)   ·   blobs/<id> = fotos.
   El token lo escribe Jon en Ajustes y vive solo en el navegador. Nunca se escribe en logs ni en mensajes. */
import { M, B, put, notify, init, now, dirtyCount } from './db.js';

const CFGK = 'mi.cfg';
export const cfg = () => { try { return JSON.parse(localStorage.getItem(CFGK) || '{}'); } catch (e) { return {}; } };
export const setCfg = o => localStorage.setItem(CFGK, JSON.stringify(o));
const meta = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem('mi.m.' + k) || 'null'); localStorage.setItem('mi.m.' + k, JSON.stringify(v)); } catch (e) { return null; } };
export const lastSync = () => meta('last');
let SYNCING = false;
export const syncing = () => SYNCING;

const b64enc = s => { const u = new TextEncoder().encode(s); let r = ''; for (let i = 0; i < u.length; i += 0x8000) r += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(r); };
const b64dec = b => { const s = atob(b.replace(/\n/g, '')), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
const blobB64 = bl => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = ko; r.readAsDataURL(bl); });
const tipo = u => (u[0] === 0xFF && u[1] === 0xD8) ? 'image/jpeg' : (u[0] === 0x89 && u[1] === 0x50) ? 'image/png' : (u[0] === 0x52 && u[1] === 0x49) ? 'image/webp' : 'application/octet-stream';

function gh(c) {
  const base = 'https://api.github.com/repos/' + c.repo;
  return async (path, o = {}) => {
    const r = await fetch(base + path, {
      method: o.method || 'GET',
      headers: { Authorization: 'Bearer ' + c.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      body: o.body ? JSON.stringify(o.body) : undefined
    });
    if (r.ok) return r.status === 204 ? null : r.json();
    const t = await r.text(); const e = new Error('GitHub ' + r.status + ': ' + (t || '').slice(0, 160)); e.status = r.status; throw e;
  };
}
async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

async function una(c, prog) {
  const br = c.branch || 'main', call = gh(c), rs = meta('rs') || {}, rep = { up: 0, down: 0 };
  prog('Conectando…');
  const ref = await call('/git/ref/heads/' + br), head = ref.object.sha;
  const cm = await call('/git/commits/' + head);
  const tr = await call('/git/trees/' + cm.tree.sha + '?recursive=1');
  if (tr.truncated) throw new Error('El repositorio de datos es demasiado grande para sincronizar');
  const remote = {}; tr.tree.forEach(t => { if (t.type === 'blob') remote[t.path] = t.sha; });
  /* bajar */
  const dl = Object.keys(remote).filter(p => (p.startsWith('data/') && p.endsWith('.json') && rs[p] !== remote[p]) || (p.startsWith('blobs/') && !B.has(p.slice(6))));
  let k = 0;
  await pool(dl, 6, async p => {
    const b = await call('/git/blobs/' + remote[p]); prog('Descargando ' + (++k) + '/' + dl.length);
    const bytes = b64dec(b.content);
    if (p.startsWith('blobs/')) {
      const id = p.slice(6), rec = { id, blob: new Blob([bytes], { type: tipo(bytes) }), type: tipo(bytes), dirty: false };
      B.set(id, rec); await put('blobs', rec); rs[p] = remote[p]; rep.down++; return;
    }
    const j = JSON.parse(new TextDecoder().decode(bytes)), parts = p.slice(5, -5).split('/'), col = parts[0], id = parts.slice(1).join('/');
    const loc = M.get(col + '/' + id); rs[p] = remote[p];
    if (loc && loc.dirty && loc.u > j.u) return;            // gana lo local: se sube
    const rec = { p: col + '/' + id, c: col, i: id, d: j.del ? null : j.d, u: j.u, del: !!j.del, dirty: false };
    M.set(rec.p, rec); await put('docs', rec); rep.down++;
  });
  /* subir */
  const ups = []; M.forEach(r => { if (r.dirty) ups.push({ kind: 'doc', r, u: r.u }); }); B.forEach(r => { if (r.dirty) ups.push({ kind: 'blob', r }); });
  if (ups.length) {
    let done = 0; prog('Subiendo 0/' + ups.length); const entries = [];
    await pool(ups, 5, async x => {
      const content = x.kind === 'doc' ? b64enc(JSON.stringify({ u: x.r.u, del: !!x.r.del, d: x.r.d })) : await blobB64(x.r.blob);
      const b = await call('/git/blobs', { method: 'POST', body: { content, encoding: 'base64' } });
      x.path = x.kind === 'doc' ? 'data/' + x.r.p + '.json' : 'blobs/' + x.r.id; x.sha = b.sha;
      entries.push({ path: x.path, mode: '100644', type: 'blob', sha: b.sha }); prog('Subiendo ' + (++done) + '/' + ups.length);
    });
    const t = await call('/git/trees', { method: 'POST', body: { base_tree: cm.tree.sha, tree: entries } });
    const nc = await call('/git/commits', { method: 'POST', body: { message: 'Sync micologia ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' (' + ups.length + ')', tree: t.sha, parents: [head] } });
    await call('/git/refs/heads/' + br, { method: 'PATCH', body: { sha: nc.sha } });
    for (const x of ups) {
      rs[x.path] = x.sha;
      if (x.kind === 'doc') { const cur = M.get(x.r.p); if (cur && cur.u === x.u) { cur.dirty = false; await put('docs', cur); } }
      else { x.r.dirty = false; await put('blobs', x.r); }
    }
    rep.up = ups.length;
  }
  meta('rs', rs); return rep;
}

export async function sync(prog = () => { }) {
  if (SYNCING) throw new Error('Ya está sincronizando');
  const c = cfg(); await init();
  if (!c.repo || !c.token) throw new Error('Falta configurar el repositorio y el token (Ajustes)');
  if (!navigator.onLine) throw new Error('Sin conexión');
  SYNCING = true; notify();
  try {
    for (let n = 0; ; n++) {
      try { const r = await una(c, prog); meta('last', now()); return r; }
      catch (e) { if (n < 1 && (e.status === 409 || e.status === 422)) continue; throw e; }
    }
  } finally { SYNCING = false; notify(); }
}
export function mensajeError(e) {
  if (e.status === 401) return 'El token no vale o ha caducado. Genera otro en GitHub.';
  if (e.status === 404) return 'No encuentro el repositorio (o el token no tiene acceso). Revisa el nombre y los permisos.';
  if (e.status === 403) return 'GitHub rechaza el token (permisos o límite). Necesita «Contents: lectura y escritura» en el repo de datos.';
  return e.message || String(e);
}
/* sincronización automática discreta: tras cambios, al volver la red y al abrir la app */
let AT = null, BACK = 0;
export function auto(ms = 25000) {
  clearTimeout(AT);
  AT = setTimeout(async () => {
    const c = cfg(); if (!c.repo || !c.token || !navigator.onLine || SYNCING || dirtyCount() === 0 && now() - (lastSync() || 0) < 120000) return;
    if (now() < BACK) return auto(BACK - now() + 500);
    if (document.querySelector('#sheet:not([hidden])')) return auto(8000);
    try { await sync(); } catch (e) { BACK = now() + 120000; console.warn('auto-sync:', mensajeError(e)); }
  }, ms);
}
addEventListener('online', () => auto(1500));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') auto(1500); });
