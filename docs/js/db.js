/* Almacén local tipo Firestore sobre IndexedDB. Todo se guarda primero aquí; sync.js lo sube al repo privado.
   Registro: { p:'coleccion/id', c, i, d (documento), u (ms de la última escritura), del (borrado lógico), dirty }. */
const DBN = 'micologia';
export const M = new Map();   // 'col/id' -> registro
export const B = new Map();   // id -> { id, blob, type, dirty }
const subs = new Set();
let idb = null, ready = null;
export const now = () => Date.now();
export const rid = () => { const a = new Uint8Array(10); crypto.getRandomValues(a); return [...a].map(x => x.toString(16).padStart(2, '0')).join(''); };

function open() {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(DBN, 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('docs', { keyPath: 'p' }); d.createObjectStore('blobs', { keyPath: 'id' }); };
    r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
  });
}
const all = store => new Promise((ok, ko) => { const q = idb.transaction(store).objectStore(store).getAll(); q.onsuccess = () => ok(q.result); q.onerror = () => ko(q.error); });
export const put = (store, v) => new Promise((ok, ko) => {
  const t = idb.transaction(store, 'readwrite'); t.objectStore(store).put(v);
  t.oncomplete = () => ok(); t.onerror = t.onabort = () => ko(t.error || new Error('No se pudo guardar en el móvil'));
});
export function init() {
  return ready || (ready = open().then(d => { idb = d; return Promise.all([all('docs'), all('blobs')]); })
    .then(([ds, bs]) => { ds.forEach(x => M.set(x.p, x)); bs.forEach(x => B.set(x.id, x)); }));
}
export const onChange = f => { subs.add(f); return () => subs.delete(f); };
export const notify = () => subs.forEach(f => { try { f(); } catch (e) { console.error(e); } });
export const dirtyCount = () => { let n = 0; M.forEach(r => { if (r.dirty) n++; }); B.forEach(r => { if (r.dirty) n++; }); return n; };

const clone = x => x == null ? x : JSON.parse(JSON.stringify(x));
const view = r => ({ id: r.i, ...r.d });
export async function list(c) { await init(); const o = []; M.forEach(r => { if (r.c === c && !r.del && r.d) o.push(view(r)); }); return o; }
export async function get(c, i) { await init(); const r = M.get(c + '/' + i); return r && !r.del && r.d ? view(r) : null; }
async function write(c, i, d) {
  await init();
  const p = c + '/' + i, ex = M.get(p);
  if (d) delete d.id;
  const rec = { p, c, i, d, u: Math.max(now(), (ex ? ex.u : 0) + 1), del: d == null, dirty: true };
  M.set(p, rec); await put('docs', rec); notify(); return d ? view(rec) : null;
}
export const set = (c, i, d) => write(c, i, clone(d));
export async function patch(c, i, part) { const cur = await get(c, i); if (!cur) throw new Error('No existe ' + c + '/' + i); return write(c, i, { ...clone(cur), ...clone(part) }); }
export const remove = (c, i) => write(c, i, null);
export async function add(c, d) { const i = rid(); await write(c, i, clone(d)); return i; }

/* Fotos: blobs aparte (en el repo van a blobs/<id>) */
export async function putBlob(blob) { await init(); const id = rid(); const rec = { id, blob, type: blob.type || 'image/jpeg', dirty: true }; B.set(id, rec); await put('blobs', rec); notify(); return id; }
const URLS = {};
export async function blobURL(id) { await init(); if (URLS[id]) return URLS[id]; const r = B.get(id); return r && r.blob ? (URLS[id] = URL.createObjectURL(r.blob)) : null; }
export async function exportAll() {
  await init(); const docs = [], blobs = [];
  M.forEach(r => docs.push({ c: r.c, i: r.i, d: r.d, u: r.u, del: r.del }));
  for (const r of B.values()) blobs.push({ id: r.id, type: r.type, b: await new Promise(ok => { const f = new FileReader(); f.onload = () => ok(String(f.result).split(',')[1]); f.readAsDataURL(r.blob); }) });
  return new Blob([JSON.stringify({ v: 1, fecha: new Date().toISOString(), docs, blobs })], { type: 'application/json' });
}
