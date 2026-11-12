import * as db from './db.js';
import * as geo from './geo.js';
import * as syn from './sync.js';
import * as cat from './catalog.js';
import { createMap, pin, spotPin, dragPin, IDENT } from './map.js';
import { I } from './iconos.js';
import { $, $$, esc, norm, hoy, hhmm, fecha, toast, reducirFoto } from './util.js';
import { guiaHTML } from './guia.js';
import * as lib from './libro.js';
import * as tmp from './temporada.js';
import * as fi from './ficha.js';
import * as trk from './track.js';
import * as ia from './ia.js';
import * as au from './audio.js';

const APP_V = 'micologia-v16';   // = V de sw.js
const S = { view: 'mapa', arg: '', map: null, pins: null, me: null, acc: null, tmp: null, mini: null, centered: false, filtro: { salida: '', especie: '' }, clase: '', q: '', syncErr: false, mes: new Date().getMonth() + 1 };
const VIEWS = ['mapa', 'salidas', 'salida', 'setas', 'mes', 'ajustes'];
const TITULOS = { mapa: 'Mapa', salidas: 'Salidas', salida: 'Salida', setas: 'Setas', mes: 'Este mes', ajustes: 'Ajustes' };
const ICON_SYNC = '<svg viewBox="0 0 24 24"><path d="M7 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 9.5a4.2 4.2 0 0 1 .5 8.5"/><path d="M12 12v8m0-8l-3 3m3-3l3 3"/></svg>';
const ESTADOS = [['joven', 'Joven'], ['madura', 'Madura'], ['pasada', 'Pasada']];

/* ---------- utilidades de interfaz ---------- */
function openSheet(html, { dim = true } = {}) {
  const s = $('#sheet'); s.className = 'sheet' + (dim ? ' dim' : '');
  s.innerHTML = '<div class="sh"><div class="grab"></div>' + html + '</div>'; s.hidden = false;
  s.onclick = dim ? e => { if (e.target === s) closeSheet(); } : null;
  hydrate(s); gestosHoja(s.firstChild); return s.firstChild;
}
/* Cerrar una hoja: tocar la barrita de arriba o arrastrarla hacia abajo. No en las que tienen un punto que mover (marcar, editar spot). */
function gestosHoja(sh) {
  const g = $('.grab', sh); let y0 = null, dy = 0;
  g.onclick = () => { if (!S.tmp) closeSheet(); };
  sh.addEventListener('touchstart', e => { if (S.tmp || (sh.scrollTop > 0 && !e.target.closest('.grab'))) return; y0 = e.touches[0].clientY; dy = 0; sh.style.transition = 'none'; }, { passive: true });
  sh.addEventListener('touchmove', e => { if (y0 == null) return; dy = e.touches[0].clientY - y0; sh.style.transform = dy > 0 ? 'translateY(' + dy + 'px)' : ''; }, { passive: true });
  sh.addEventListener('touchend', () => { if (y0 == null) return; y0 = null; sh.style.transition = 'transform .2s'; if (dy > 90) closeSheet(); else sh.style.transform = ''; });
}
function closeSheet() {
  const s = $('#sheet'); s.hidden = true; s.innerHTML = ''; s.onclick = null;
  if (S.rec) { S.rec.cancel(); S.rec = null; clearInterval(S.recT); }
  if (S.tmp) { S.tmp.remove(); S.tmp = null; }
  marcarSel(null);
  if (S.spTrk) { S.spTrk.remove(); S.spTrk = null; }
}
/* deja un punto del mapa en el hueco visible entre los filtros de arriba y la hoja de abajo */
function encuadrar(lat, lon, sh) {
  setTimeout(() => {
    const m = S.map, r = m.getContainer().getBoundingClientRect(), p = m.latLngToContainerPoint([lat, lon]);
    const top = 120, bot = (sh && sh.isConnected ? sh.getBoundingClientRect().top : r.bottom) - r.top, y = Math.max(top + 30, (top + bot) / 2);
    m.panBy([p.x - r.width / 2, p.y - y], { animate: false });
  }, 60);
}
/* spot seleccionado en el mapa (se agranda mientras su ficha está abierta) */
function marcarSel(id) {
  S.selId = id;
  Object.entries(S.spotM || {}).forEach(([k, m]) => { const el = m.getElement(); if (el) el.classList.toggle('sel', k === id); });
}
async function hydrate(root) { for (const im of $$('img[data-blob], audio[data-blob]', root)) { const u = await db.blobURL(im.dataset.blob); if (u) im.src = u; } }
const tag = fi.tag;
const identTag = i => '<span class="tag" style="--c:' + (IDENT[i] || IDENT.sin_identificar).color + ';color:#0a0f0e">' + (IDENT[i] || IDENT.sin_identificar).label + '</span>';
const nombreHall = h => { const e = cat.byId(h.especieId); return e ? cat.nombre(e) : (h.especieTxt || 'Sin identificar'); };
/* galeria: elige de la galería (varias a la vez) en vez de abrir la cámara */
async function pickFoto(onId, { galeria = false } = {}) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'file-foto';
  if (galeria) inp.multiple = true; else inp.setAttribute('capture', 'environment');
  inp.style.display = 'none'; document.body.appendChild(inp);
  inp.onchange = async () => {
    const fs = [...inp.files]; inp.remove(); let mal = 0;
    for (const f of fs) { try { const id = await db.putBlob(await reducirFoto(f)); await onId(id); } catch (e) { mal++; } }
    if (mal) toast(mal === 1 ? 'No se pudo guardar una foto' : 'No se pudieron guardar ' + mal + ' fotos');
  };
  inp.click();
}
/* Línea del recorrido: borde oscuro + trazo claro, legible sobre satélite */
function trazo(pts) {
  const g = L.layerGroup();
  trk.lineas(pts).forEach(l => {
    if (l.length < 2) return; const ll = l.map(p => [p[0], p[1]]);
    L.polyline(ll, { color: '#0b1210', weight: 7, opacity: .55, interactive: false }).addTo(g);
    L.polyline(ll, { color: '#ffd23f', weight: 3.5, opacity: .95, interactive: false, className: 'trk-line' }).addTo(g);
  });
  return g;
}

/* ---------- notas de voz: grabar, escuchar y transcribir (Gemini) ---------- */
const vozLista = st => st.audios.map(id => '<div class="au"><audio controls preload="none" data-blob="' + id + '"></audio><div class="row"><button class="btn" data-at="' + id + '">' + (st.pend.has(id) ? 'Transcribiendo…' : st.trans[id] ? 'Transcribir otra vez' : 'Transcribir') + '</button><button class="btn d" data-ad="' + id + '">Quitar</button></div>' +
  '<textarea data-tt="' + id + '" placeholder="Aquí aparece lo que dices (puedes corregirlo)">' + esc(st.trans[id] || '') + '</textarea></div>').join('');
const vozHTML = st => '<label class="l">Nota de voz</label><div class="row"><button class="btn big" id="au-rec"' + (au.soportado() ? '' : ' disabled') + '>🎙 Grabar nota de voz</button></div><div id="au-list">' + vozLista(st) + '</div>' +
  (au.soportado() ? '' : '<p class="note">Este navegador no puede grabar audio.</p>');
function vozWire(sh, st) {
  const pintar = () => { $('#au-list', sh).innerHTML = vozLista(st); hydrate($('#au-list', sh)); };
  const transcribir = async id => {
    const r = db.B.get(id); if (!r || !r.blob || st.pend.has(id)) return;
    if (!navigator.onLine) return toast('Sin conexión: el audio queda guardado y lo transcribes luego');
    st.pend.add(id); pintar();
    try { const t = await ia.transcribir(r.blob); st.trans[id] = t; if (st.onTrans) st.onTrans(id, t); }
    catch (e) { toast(ia.mensajeError(e) + ' El audio queda guardado.', 3800); }
    st.pend.delete(id); if (sh.isConnected) pintar();
  };
  pintar();
  sh.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.tt; if (k) st.trans[k] = e.target.value; });
  sh.addEventListener('click', async ev => {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.at) transcribir(t.dataset.at);
    else if (t.dataset.ad) { st.audios = st.audios.filter(x => x !== t.dataset.ad); delete st.trans[t.dataset.ad]; pintar(); }
    else if (t.id === 'au-rec') {
      if (!S.rec) {
        try { S.rec = await au.grabar(); } catch (e) { return toast(e && e.name === 'NotAllowedError' ? 'Permiso de micrófono denegado' : 'No puedo usar el micrófono', 3600); }
        t.dataset.h0 = t.innerHTML; t.classList.add('grab'); const tick = () => { t.textContent = '⏹ Parar · ' + au.mmss(S.rec ? S.rec.seg() : 0); }; tick(); S.recT = setInterval(tick, 500);
      } else {
        const r = S.rec; S.rec = null; clearInterval(S.recT); t.classList.remove('grab'); if (t.dataset.h0) t.innerHTML = t.dataset.h0; else t.textContent = '🎙 Grabar nota de voz';
        const blob = await r.stop(); if (!blob.size) return toast('No se ha grabado nada');
        const id = await db.putBlob(blob); st.audios.push(id); pintar(); transcribir(id);
      }
    }
  });
}
const nuevoVoz = h => ({ audios: [...((h && h.audios) || [])], trans: { ...((h && h.transcripciones) || {}) }, pend: new Set() });
const distM = (a, b) => { const R = 6371000, r = x => x * Math.PI / 180, dl = r(b.lat - a.lat), dn = r(b.lon - a.lon), q = Math.sin(dl / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(q)); };
const kmFmt = m => m < 950 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km';

/* ---------- selector de especie (catálogo o texto libre) ---------- */
function pickerHTML(st, { rejilla = false } = {}) {
  const e = cat.byId(st.id);
  return (rejilla ? '<button id="sp-no" hidden></button>' : '<label class="l">Especie</label><div class="chips"><button class="opt ' + (!st.id && !st.txt ? 'on' : '') + '" id="sp-no">No sé</button></div>') +
    '<input type="search" id="sp-q" placeholder="' + (rejilla ? 'O busca otra / escribe lo que sea…' : 'Buscar en el catálogo o escribir…') + '" autocomplete="off" style="margin-top:8px" value="' + esc(e ? cat.nombre(e) : st.txt) + '"><div id="sp-sugs" class="sugs" hidden></div>' +
    '<div id="sp-sel" style="margin-top:6px">' + (e ? tag(cat.vista(e)) : '') + '</div>';
}
function pickerWire(root, st) {
  const q = $('#sp-q', root), sg = $('#sp-sugs', root), sel = $('#sp-sel', root), no = $('#sp-no', root);
  const mark = () => no.classList.toggle('on', !st.id && !st.txt);
  q.oninput = () => {
    st.id = null; st.txt = q.value.trim(); sel.innerHTML = ''; mark();
    const r = st.txt ? cat.buscar(st.txt).slice(0, 5) : [];
    sg.hidden = !r.length; sg.innerHTML = r.map(e => '<button data-id="' + e.id + '"><span class="dot" style="--c:' + cat.CLASES[cat.vista(e)].color + '"></span><span>' + esc(cat.nombre(e)) + '</span></button>').join('');
  };
  sg.onclick = ev => { const b = ev.target.closest('button'); if (!b) return; const e = cat.byId(b.dataset.id); st.id = e.id; st.txt = ''; q.value = cat.nombre(e); sel.innerHTML = tag(cat.vista(e)); sg.hidden = true; mark(); };
  no.onclick = () => { st.id = null; st.txt = ''; q.value = ''; sel.innerHTML = ''; sg.hidden = true; mark(); };
}

/* ---------- mapa ---------- */
function initMap() {
  S.map = createMap('map'); S.trkL = L.layerGroup().addTo(S.map); S.spotsL = L.layerGroup().addTo(S.map); S.pins = L.layerGroup().addTo(S.map);
  S.me = L.marker([0, 0], { icon: L.divIcon({ className: 'me', html: '<i></i>', iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false, opacity: 0, zIndexOffset: 900 }).addTo(S.map);
  S.acc = L.circle([0, 0], { radius: 0, color: '#4c9bff', weight: 1, fillOpacity: .1, interactive: false }).addTo(S.map);
  $('#locate').innerHTML = I.locate; $('#layerbtn').innerHTML = I.layers; $('#spotbtn').innerHTML = I.flag; $('#filterbtn').innerHTML = I.filter; $('#fab .fi').innerHTML = I.plus;
  geo.onFix((f, err) => {
    const g = $('#gps');
    if (f) {
      g.textContent = '±' + f.acc + ' m'; g.className = 'gps ' + (f.acc <= 20 ? 'ok' : 'mid');
      S.me.setLatLng([f.lat, f.lon]).setOpacity(1); S.acc.setLatLng([f.lat, f.lon]).setRadius(f.acc);
      if (!S.centered && S.view === 'mapa') { S.centered = true; S.map.setView([f.lat, f.lon], 16); }
    } else if (err) { g.textContent = geo.msgError(err); g.className = 'gps bad'; }
  });
  $('#locate').onclick = () => { const f = geo.fix(); if (f) S.map.setView([f.lat, f.lon], Math.max(S.map.getZoom(), 16)); else toast('Aún sin GPS'); };
  $('#layerbtn').onclick = abrirCapas;
  $('#filterbtn').onclick = abrirFiltro;
  $('#fab').onclick = () => marcar();
  $('#spotbtn').onclick = () => editarSpot();
  /* tocar el mapa fuera de un marcador cierra el resumen abierto */
  S.map.on('click', () => { const s = $('#sheet'); if (!S.tmp && !s.hidden && !s.classList.contains('dim')) closeSheet(); });
  $('#mchips').onclick = e => { const b = e.target.closest('[data-capa]'); if (!b) return; S.capa = b.dataset.capa; $$('#mchips button').forEach(x => x.classList.toggle('on', x === b)); refreshPins(); };
  trk.onAdd(() => { if (S.trkId && trk.activo() === S.trkId) pintarTrack(trk.puntos()); });
  geo.start();
  /* sin GPS todavía (en casa, en interior): enseña tus spots en vez de un mapa de Bizkaia vacío */
  setTimeout(async () => { if (S.centered || geo.fix()) return; const zs = (await db.list('zonas')).filter(z => z.lat != null); if (zs.length && !S.centered) S.map.fitBounds(zs.map(z => [z.lat, z.lon]), { padding: [70, 70], maxZoom: 16, animate: false }); }, 1800);
}
function abrirCapas() {
  const b = S.map.getBase();
  const sh = openSheet('<h2>Tipo de mapa</h2><div class="capas">' + [['sat', 'Satélite', 'Foto aérea del IGN: se ven los bosques y los claros'], ['calle', 'Mapa', 'Pistas, caminos y pueblos (OpenStreetMap)']].map(([k, t, d]) =>
    '<button class="capa ' + k + (b === k ? ' on' : '') + '" data-base="' + k + '"><span class="pv"></span><b>' + t + '</b><small>' + d + '</small></button>').join('') + '</div>');
  sh.onclick = e => { const x = e.target.closest('[data-base]'); if (!x) return; S.map.setBase(x.dataset.base); closeSheet(); };
}
const corto = e => { const n = e.nombresComunes && e.nombresComunes.es && e.nombresComunes.es[0]; return n ? n[0].toUpperCase() + n.slice(1) : e.nombreCientifico.split(' (')[0]; };
const nombreCorto = h => { const e = cat.byId(h.especieId); return e ? corto(e) : (h.especieTxt || 'Sin identificar'); };
const colorEsp = e => e ? cat.CLASES[cat.vista(e)].color : '#9aa5a1';
/* marcador de hallazgo: foto propia si hay; si no, la de referencia de la especie */
function pinH(h, o = {}) {
  const e = cat.byId(h.especieId), f = e && e.fotos && e.fotos[0];
  const m = pin(h, { color: colorEsp(e), foto: f ? fi.fotoURL(f, 250) : '', ok: h.identificacion === 'confirmada', enz: !!h.zonaId, ...o });
  if (h.fotos && h.fotos[0]) m.on('add', async () => { const u = await db.blobURL(h.fotos[0]), i = m.getElement() && m.getElement().querySelector('i'); if (!u || !i) return; const im = i.querySelector('img'); if (im) im.src = u; else i.insertAdjacentHTML('beforeend', '<img src="' + u + '" alt="">'); });
  return m;
}
async function refreshPins() {
  if (!S.map) return; S.pins.clearLayers(); S.spotsL.clearLayers(); S.spotM = {};
  const [hs, act, zs] = [await db.list('hallazgos'), await activa(), await db.list('zonas')], f = S.filtro, capa = S.capa || 'todo';
  if (capa === 'todo' || capa === 'hallazgos')
    hs.filter(h => (!f.salida || (f.salida === 'activa' ? act && h.salidaId === act.id : h.salidaId === f.salida)) && (!f.especie || h.especieId === f.especie))
      .forEach(h => pinH(h).on('click', () => verHallazgo(h.id)).addTo(S.pins));
  if (capa !== 'hallazgos')
    zs.filter(z => z.lat != null && z.lon != null && (capa !== 'porir' || z.estado === 'por_visitar')).forEach(z => {
      const n = new Set(hs.filter(h => h.zonaId === z.id).map(h => h.especieId || norm(h.especieTxt))).size;
      S.spotM[z.id] = spotPin(z, { n }).on('click', () => verSpot(z.id)).addTo(S.spotsL);
    });
  if (S.selId) marcarSel(S.selId);
  $('#filterbtn').classList.toggle('on', !!(f.salida || f.especie));
  /* recorrido: el de la salida filtrada o, si no hay filtro, el de la salida en curso */
  S.trkId = f.salida && f.salida !== 'activa' ? f.salida : act && act.id;
  const sd = S.trkId ? await db.get('salidas', S.trkId) : null;
  pintarTrack(S.trkId && trk.activo() === S.trkId ? trk.puntos() : (sd && sd.track) || []);
}
function pintarTrack(pts) { if (!S.map) return; S.trkL.clearLayers(); if (pts && pts.length > 1) trazo(pts).addTo(S.trkL); }
async function abrirFiltro() {
  const ss = (await db.list('salidas')).sort((a, b) => b.fecha.localeCompare(a.fecha)), hs = await db.list('hallazgos');
  const usadas = [...new Set(hs.map(h => h.especieId).filter(Boolean))];
  const f = S.filtro;
  const sh = openSheet('<h2>Filtrar hallazgos</h2><label class="l">Salida</label><select id="f-sal"><option value="">Todas</option><option value="activa"' + (f.salida === 'activa' ? ' selected' : '') + '>La salida en curso</option>' +
    ss.map(s => '<option value="' + s.id + '"' + (f.salida === s.id ? ' selected' : '') + '>' + esc(fecha(s.fecha) + (s.titulo ? ' · ' + s.titulo : '')) + '</option>').join('') +
    '</select><label class="l">Especie</label><select id="f-esp"><option value="">Todas</option>' + usadas.map(id => '<option value="' + id + '"' + (f.especie === id ? ' selected' : '') + '>' + esc(cat.nombre(cat.byId(id))) + '</option>').join('') +
    '</select><div class="row"><button class="btn" id="f-clr">Quitar filtros</button><button class="btn p" id="f-ok">Aplicar</button></div>');
  $('#f-ok', sh).onclick = () => { S.filtro = { salida: $('#f-sal', sh).value, especie: $('#f-esp', sh).value }; closeSheet(); refreshPins(); };
  $('#f-clr', sh).onclick = () => { S.filtro = { salida: '', especie: '' }; closeSheet(); refreshPins(); };
}

/* ---------- marcar un hallazgo (flujo de campo: Marcar aquí → Guardar) ---------- */
async function marcar(opts = {}) {
  const map = S.map; let pos;
  const f = opts.pos ? null : (geo.fix() || await geo.waitFix(2500));
  if (opts.pos) pos = { lat: opts.pos.lat, lon: opts.pos.lon, acc: null };   /* añadir una especie a un spot de una salida ya hecha: sin GPS, en el sitio del spot */
  else if (f) pos = { lat: f.lat, lon: f.lon, acc: f.acc };
  else { const c = map.getCenter(); pos = { lat: c.lat, lon: c.lng, acc: null, manual: true }; toast('Sin GPS: arrastra el punto a su sitio', 3800); }
  if (map.getZoom() < 16) map.setView([pos.lat, pos.lon], 17);
  closeSheet(); S.tmp = dragPin()(pos.lat, pos.lon).addTo(map);
  const m = { esp: { id: null, txt: '' }, fotos: [], zona: opts.zona || null, estado: '', nueva: false }, vz = nuevoVoz();
  const horaTxt = () => (opts.ts ? new Date(opts.ts).toLocaleDateString('es-ES') + ' ' : '') + hhmm(opts.ts || Date.now());
  const [zonas, act] = [await db.list('zonas'), await activa()];
  /* barrido: si ya estás a menos de 150 m de un spot, se elige solo */
  if (!m.zona) { const c = zonas.filter(z => z.lat != null).map(z => [z, distM(pos, z)]).sort((a, b) => a[1] - b[1])[0]; if (c && c[1] <= 150) m.zona = c[0].id; }
  /* rejilla de especies probables: las que ya salieron en este spot, las de hoy, las que más encuentras y las de temporada */
  const hs0 = await db.list('hallazgos'), mes = new Date(opts.ts || Date.now()).getMonth() + 1, sal = opts.salida || (act && act.id);
  const freq = l => { const c = {}; l.forEach(h => { if (h.especieId) c[h.especieId] = (c[h.especieId] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a]); };
  const sugs = () => { const c = new Map(), add = (id, why) => { if (id && !c.has(id) && cat.byId(id)) c.set(id, why); };
    if (m.zona) freq(hs0.filter(h => h.zonaId === m.zona)).forEach(id => add(id, 'aquí'));
    if (sal) freq(hs0.filter(h => h.salidaId === sal)).forEach(id => add(id, 'hoy'));
    freq(hs0).forEach(id => add(id, 'de las tuyas'));
    tmp.delMes(cat.todas(), mes).filter(r => r.nivel >= 2).forEach(r => add(r.e.id, 'temporada'));
    return [...c].slice(0, 7); };
  const gridHTML = () => '<button class="gt no' + (!m.esp.id && !m.esp.txt ? ' on' : '') + '" data-g=""><span class="pf"><span class="ph0">?</span></span><b>No sé</b><small>lo miro luego</small></button>' +
    sugs().map(([id, why]) => { const e = cat.byId(id); return '<button class="gt' + (m.esp.id === id ? ' on' : '') + '" data-g="' + id + '" style="--c:' + colorEsp(e) + '"><span class="pf">' + fotoEsp(e) + '</span><b>' + esc(corto(e)) + '</b><small>' + why + '</small></button>'; }).join('');
  const posTxt = () => pos.lat.toFixed(5) + ', ' + pos.lon.toFixed(5) + (pos.manual || pos.adj ? ' · ajustado a mano' : pos.acc != null ? ' · ±' + pos.acc + ' m' : '');
  const zonasOrd = () => zonas.slice().sort((a, b) => (act && act.zonaIds.includes(b.id)) - (act && act.zonaIds.includes(a.id)) || a.nombre.localeCompare(b.nombre));
  const zonaHTML = () => '<label class="l">Spot</label><div class="chips" id="mk-zonas">' +
    zonasOrd().map(z => '<button class="opt ' + (m.zona === z.id ? 'on' : '') + '" data-z="' + z.id + '">' + esc(z.nombre) + '</button>').join('') +
    '<button class="opt" id="mk-nz">+ Spot nuevo</button></div>' + (m.nueva ? '<div class="row" style="margin-top:8px"><input type="text" id="mk-znom" placeholder="Nombre del spot" style="flex:1"><button class="btn p" id="mk-zok" style="flex:none">Crear</button></div>' : '');
  const sh = openSheet('<h2>Nuevo hallazgo</h2><p class="sub" id="mk-pos">' + horaTxt() + ' · ' + posTxt() + '</p>' +
    '<div class="mtiles"><button class="mtile" id="mk-foto">' + I.foto + '<b>Foto</b></button><button class="mtile" id="au-rec"' + (au.soportado() ? '' : ' disabled') + '>' + I.mic + '<b>Nota de voz</b></button></div>' +
    '<div id="mk-th" class="thumbs"></div><div id="au-list"></div>' +
    '<label class="l">¿Qué es?</label><div class="gsp" id="mk-grid">' + gridHTML() + '</div>' + pickerHTML(m.esp, { rejilla: true }) +
    '<div id="mk-zona">' + zonaHTML() + '</div>' +
    '<label class="l">Cantidad</label><div class="cantq">' + ['1', '2–5', 'Muchas', '≈200 g'].map(x => '<button class="opt" data-cq="' + x + '">' + x + '</button>').join('') + '</div><input type="text" id="mk-cant" placeholder="o escríbela: 3 · ≈200 g" style="margin-top:8px">' +
    '<details class="det" id="mk-det"><summary>Estado y nota</summary><label class="l">Estado</label><div class="seg" id="mk-est">' + ESTADOS.map(e => '<button data-e="' + e[0] + '">' + e[1] + '</button>').join('') + '</div>' +
    '<label class="l">Nota</label><input type="text" id="mk-nota" placeholder="Nota corta (o díctala con la nota de voz)"></details>' +
    '<div class="row mk-bar"><button class="btn" id="mk-x">Cancelar</button><button class="btn p" id="mk-ok" style="flex:2">Guardar</button></div>', { dim: !!opts.pos });
  const regrid = () => { $('#mk-grid', sh).innerHTML = gridHTML(); };
  pickerWire(sh, m.esp); vozWire(sh, vz);
  vz.onTrans = (id, t) => { const n = $('#mk-nota', sh); if (n && !n.value.trim()) { n.value = t.slice(0, 300); $('#mk-det', sh).open = true; } };
  $('#sp-q', sh).addEventListener('input', regrid);
  encuadrar(pos.lat, pos.lon, sh);
  S.tmp.on('dragend', () => { const p = S.tmp.getLatLng(); pos.lat = p.lat; pos.lon = p.lng; pos.adj = true; $('#mk-pos', sh).textContent = horaTxt() + ' · ' + posTxt(); });
  const rezona = () => { $('#mk-zona', sh).innerHTML = zonaHTML(); regrid(); };
  sh.addEventListener('click', async ev => {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.g !== undefined) { const e = cat.byId(t.dataset.g); m.esp.id = e ? e.id : null; m.esp.txt = ''; $('#sp-q', sh).value = e ? cat.nombre(e) : ''; $('#sp-sel', sh).innerHTML = e ? tag(cat.vista(e)) : ''; $('#sp-sugs', sh).hidden = true; regrid(); }
    else if (t.closest('#sp-sugs')) regrid();
    else if (t.dataset.cq) { $('#mk-cant', sh).value = t.dataset.cq; $$('.cantq button', sh).forEach(b => b.classList.toggle('on', b === t)); }
    else if (t.dataset.z) { m.zona = m.zona === t.dataset.z ? null : t.dataset.z; rezona(); }
    else if (t.id === 'mk-nz') { m.nueva = true; rezona(); $('#mk-znom', sh).focus(); }
    else if (t.id === 'mk-zok') {
      const n = $('#mk-znom', sh).value.trim(); if (!n) return;
      const id = await db.add('zonas', { nombre: n, lat: pos.lat, lon: pos.lon, notas: '', estado: 'visitada', visitadaTs: Date.now() });
      zonas.push({ id, nombre: n, lat: pos.lat, lon: pos.lon }); m.zona = id; m.nueva = false; rezona();
    }
    else if (t.dataset.e) { m.estado = m.estado === t.dataset.e ? '' : t.dataset.e; $$('#mk-est button', sh).forEach(b => b.classList.toggle('on', b.dataset.e === m.estado)); }
    else if (t.id === 'mk-foto') pickFoto(id => { m.fotos.push(id); const im = document.createElement('img'); im.dataset.blob = id; $('#mk-th', sh).appendChild(im); hydrate($('#mk-th', sh)); });
    else if (t.id === 'mk-x') closeSheet();
    else if (t.id === 'mk-ok') {
      t.disabled = true;
      try {
        const a = await activa(), q = $('#sp-q', sh).value.trim();
        const sid = opts.salida || (a ? a.id : null), h = { salidaId: sid, zonaId: m.zona, lat: pos.lat, lon: pos.lon, precisionM: pos.acc, ts: opts.ts || Date.now(), especieId: m.esp.id, especieTxt: m.esp.id ? '' : q,
          cantidad: $('#mk-cant', sh).value.trim(), estadoSeta: m.estado, sustrato: '', notas: $('#mk-nota', sh).value.trim(), fotos: m.fotos,
          identificacion: m.esp.id ? 'provisional' : 'sin_identificar', confirmadoPor: '', recogida: false, ajustadoAMano: !!(pos.adj || pos.manual), audios: vz.audios, transcripciones: vz.trans };
        if (S.rec) { S.rec.cancel(); S.rec = null; clearInterval(S.recT); }
        await db.add('hallazgos', h);
        { const zz = m.zona && zonas.find(z => z.id === m.zona); if (zz && zz.estado === 'por_visitar') await db.patch('zonas', zz.id, { estado: 'visitada', visitadaTs: Date.now() }); }
        if (sid && m.zona) { const ss = await db.get('salidas', sid); if (ss && !(ss.zonaIds || []).includes(m.zona)) await db.patch('salidas', sid, { zonaIds: [...(ss.zonaIds || []), m.zona] }); }
        closeSheet(); toast(sid ? 'Hallazgo guardado en la salida' : 'Hallazgo guardado (sin salida en curso)'); syn.auto();
      } catch (e) { t.disabled = false; toast('No se pudo guardar: ' + (e.message || e)); }
    }
  });
}

/* ---------- spots (= zonas): sitios visitados y por visitar ---------- */
const SPOT_EST = [['visitada', 'Visitado'], ['por_visitar', 'Quiero ir']];
const spotColor = z => z.estado === 'por_visitar' ? '#4cc3d9' : '#46b36b';
const spotTag = z => '<span class="tag" style="--c:' + spotColor(z) + '">' + (z.estado === 'por_visitar' ? 'Quiero ir' : 'Visitado') + '</span>';
async function irAlMapa() { if (S.view !== 'mapa') { location.hash = '#mapa'; await new Promise(r => setTimeout(r, 250)); } }
const abrirSpot = id => id ? verSpot(id) : editarSpot();
async function editarSpot(id, o = {}) {
  await irAlMapa();
  closeSheet();
  let z = id ? await db.get('zonas', id) : null; const nuevo = !z;
  if (nuevo) { const f = geo.fix(), c = S.map.getCenter(); z = { nombre: o.salida ? 'Spot ' + ((await db.list('zonas')).length + 1) : '', estado: 'visitada', lat: f ? f.lat : c.lat, lon: f ? f.lon : c.lng, notas: '' }; }
  const pos = { lat: z.lat, lon: z.lon }, fotos = [...(z.fotos || [])], vz = nuevoVoz(z); let estado = z.estado || 'visitada';
  S.map.setView([pos.lat, pos.lon], Math.max(S.map.getZoom(), 16));
  S.tmp = dragPin()(pos.lat, pos.lon).addTo(S.map);
  const sh = openSheet('<h2>' + (nuevo ? 'Nuevo spot' : 'Editar spot') + '</h2><p class="sub" id="st-pos"></p>' +
    '<input type="text" id="st-nom" placeholder="Nombre del sitio (p. ej. Hayedo de Otzarreta)" value="' + esc(z.nombre) + '">' +
    '<label class="l">Estado</label><div class="seg" id="st-est">' + SPOT_EST.map(e => '<button data-s="' + e[0] + '" class="' + (estado === e[0] ? 'on' : '') + '">' + e[1] + '</button>').join('') + '</div>' +
    '<div class="row"><button class="btn" id="st-aqui">Usar mi posición</button>' + (nuevo ? '' : '<a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + z.lat + ',' + z.lon + '">Cómo llegar</a>') + '</div>' +
    '<label class="l">Nota</label><textarea id="st-nota" placeholder="Cómo se llega, qué árboles hay, qué esperas encontrar…">' + esc(z.notas) + '</textarea>' + vozHTML(vz) +
    '<label class="l">Fotos</label><div class="thumbs" id="st-th">' + fotos.map(f => '<img data-blob="' + f + '">').join('') + '</div><div class="row"><button class="btn" id="st-foto">Añadir foto</button></div>' +
    '<div class="row">' + (nuevo ? '' : '<button class="btn d" id="st-del">Borrar</button>') + '<button class="btn" id="st-x">Cancelar</button><button class="btn p" id="st-ok" style="flex:2">Guardar</button></div>', { dim: false });
  const posTxt = () => { $('#st-pos', sh).textContent = pos.lat.toFixed(5) + ', ' + pos.lon.toFixed(5) + (nuevo ? ' · arrastra el punto a su sitio' : ''); };
  posTxt(); vozWire(sh, vz); hydrate($('#st-th', sh));
  encuadrar(pos.lat, pos.lon, sh);
  if (S.tmp) S.tmp.on('dragend', () => { const p = S.tmp.getLatLng(); pos.lat = p.lat; pos.lon = p.lng; posTxt(); });
  sh.addEventListener('click', async ev => {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.s) { estado = t.dataset.s; $$('#st-est button', sh).forEach(b => b.classList.toggle('on', b.dataset.s === estado)); }
    else if (t.id === 'st-aqui') { const f = geo.fix(); if (!f) return toast('Aún sin GPS'); pos.lat = f.lat; pos.lon = f.lon; S.tmp.setLatLng([f.lat, f.lon]); S.map.setView([f.lat, f.lon], 17); posTxt(); }
    else if (t.id === 'st-foto') pickFoto(fid => { fotos.push(fid); const im = document.createElement('img'); im.dataset.blob = fid; $('#st-th', sh).appendChild(im); hydrate($('#st-th', sh)); }, { galeria: true });
    else if (t.id === 'st-x') { closeSheet(); if (!nuevo) verSpot(id); }
    else if (t.id === 'st-del') { if (t.dataset.sure) { await db.remove('zonas', id); closeSheet(); toast('Spot borrado'); syn.auto(); } else { t.dataset.sure = 1; t.textContent = 'Pulsa otra vez para borrar'; } }
    else if (t.id === 'st-ok') {
      const nombre = $('#st-nom', sh).value.trim(); if (!nombre) { toast('Ponle un nombre al spot'); $('#st-nom', sh).focus(); return; }
      t.disabled = true;
      try {
        if (S.rec) { S.rec.cancel(); S.rec = null; clearInterval(S.recT); }
        const d = { nombre, estado, lat: pos.lat, lon: pos.lon, notas: $('#st-nota', sh).value.trim(), fotos, audios: vz.audios, transcripciones: vz.trans };
        if (estado === 'visitada' && !z.visitadaTs) d.visitadaTs = Date.now();
        if (nuevo) { const nid = await db.add('zonas', { ...d, creada: Date.now() }); if (o.salida) { const ss = await db.get('salidas', o.salida); if (ss) await db.patch('salidas', o.salida, { zonaIds: [...(ss.zonaIds || []), nid] }); } }
        else await db.patch('zonas', id, d);
        closeSheet(); toast(nuevo ? (o.salida ? 'Spot añadido a la salida' : 'Spot guardado') : 'Guardado'); syn.auto();
        if (!nuevo) verSpot(id); else if (o.salida) location.hash = '#salida/' + o.salida;
      } catch (e) { t.disabled = false; toast('No se pudo guardar: ' + (e.message || e)); }
    }
  });
}

/* Ficha resumen de un spot: qué especies has encontrado, cuándo salen ahí y tus visitas. Sin preguntas: para editar, el lápiz. */
const MES_C = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'], MES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ymd = ts => { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const fechaCorta = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }); };
const fotoEsp = e => e && e.fotos && e.fotos[0] ? '<img class="ph" src="' + esc(fi.fotoURL(e.fotos[0], 250)) + '" alt="" loading="lazy" crossorigin="anonymous">' : '<span class="ph0">' + I.seta + '</span>';
function resumenSpot(hs) {
  const g = {}, porMes = Array(12).fill(0);
  hs.forEach(h => {
    const k = h.especieId || 'x:' + norm(h.especieTxt || '?'), d = new Date(h.ts);
    const r = g[k] || (g[k] = { e: cat.byId(h.especieId), nom: nombreCorto(h), n: 0, anos: new Set(), last: 0, h, foto: null });
    r.n++; r.anos.add(d.getFullYear()); if (h.ts > r.last) { r.last = h.ts; r.h = h; } if (!r.foto && h.fotos && h.fotos[0]) r.foto = h.fotos[0];
    porMes[d.getMonth()]++;
  });
  const esp = Object.values(g).sort((a, b) => b.n - a.n || b.last - a.last);
  return { esp, porMes, peligro: esp.filter(r => r.e && (r.e.clase === 'mortal' || r.e.clase === 'toxica')) };
}
const anosTxt = s => { const a = [...s].sort(); return a.length > 1 ? a[0] + '–' + String(a[a.length - 1]).slice(2) : String(a[0]); };
async function verSpot(id) {
  await irAlMapa();
  const z = await db.get('zonas', id); if (!z) return;
  closeSheet();
  const [hs0, ss0] = [await db.list('hallazgos'), await db.list('salidas')];
  const hs = hs0.filter(h => h.zonaId === id).sort((a, b) => b.ts - a.ts);
  const ss = ss0.filter(s => (s.zonaIds || []).includes(id) || hs.some(h => h.salidaId === s.id)).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  const dias = new Set([...ss.map(s => s.fecha), ...hs.filter(h => !h.salidaId).map(h => ymd(h.ts))]);
  const ult = [...dias].sort().pop(), yo = geo.fix(), por = z.estado === 'por_visitar';
  const lejos = !yo || distM(yo, z) > 300;   /* desde casa: el hallazgo va en el sitio del spot, no donde estás */
  const { esp, porMes, peligro } = resumenSpot(hs), mesAct = new Date().getMonth(), max = Math.max(1, ...porMes), mejor = porMes.indexOf(Math.max(...porMes));
  const meta = [spotTag(z), yo ? '<span>' + kmFmt(distM(yo, z)) + '</span>' : '', dias.size ? '<span>' + dias.size + (dias.size === 1 ? ' visita' : ' visitas') + '</span>' : '', ult ? '<span>últ. ' + esc(fechaCorta(ult).replace(' ' + new Date().getFullYear(), '')) + '</span>' : ''].filter(Boolean).join('');
  const card = r => '<button class="spc" ' + (r.e ? 'data-e="' + r.e.id + '"' : 'data-hv="' + r.h.id + '"') + ' style="--c:' + colorEsp(r.e) + '"><span class="pf">' + (r.foto ? '<img class="ph" data-blob="' + r.foto + '" alt="">' : fotoEsp(r.e)) + '<em>×' + r.n + '</em></span><b>' + esc(r.nom) + '</b><small>' + anosTxt(r.anos) + (r.e && r.e.clase === 'mortal' ? ' · mortal' : r.e && r.e.clase === 'toxica' ? ' · tóxica' : '') + '</small></button>';
  const delMes = esp.filter(r => hs.some(h => (h.especieId || 'x') === (r.e ? r.e.id : 'x') && new Date(h.ts).getMonth() === mesAct) && r.e);
  const sh = openSheet('<div class="sv-h"><div class="sv-t"><h2>' + esc(z.nombre || 'Spot') + '</h2><div class="meta">' + meta + '</div></div><button class="icb" id="st-edit" aria-label="Editar spot">' + I.edit + '</button><button class="icb" id="sv-x" aria-label="Cerrar">' + I.close + '</button></div>' +
    '<div class="acts"><button class="btn p" id="st-marcar">' + I.plus + (lejos ? 'Añadir especie' : 'Marcar aquí') + '</button><a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + z.lat + ',' + z.lon + '">' + I.route + 'Cómo llegar</a></div>' +
    (peligro.length ? '<div class="alerta">' + I.aviso + '<div>Aquí también has visto <b>' + esc(peligro.map(r => r.nom).join(', ')) + '</b>. Mira bien cada seta antes de cogerla.</div></div>' : '') +
    (esp.length ? '<div class="sec">Especies encontradas<small>' + esp.length + '</small></div><div class="spcs">' + esp.map(card).join('') + '</div>' +
      (delMes.length ? '<div class="tip">' + I.cal + '<div>En <b>' + MES_L[mesAct] + '</b> aquí te han salido: ' + esc(delMes.map(r => r.nom).join(', ')) + '.</div></div>' : '') +
      '<div class="sec">Cuándo has encontrado aquí</div><div class="mbar">' + porMes.map((n, i) => '<div class="' + (i === mesAct ? 'cur' : '') + '"><u style="height:' + (n ? Math.max(12, Math.round(n / max * 100)) : 4) + '%" class="' + (n ? 'h' : '') + '"></u><span>' + MES_C[i] + '</span></div>').join('') + '</div>' +
      '<p class="mut sm">Mejor mes hasta ahora: <b>' + MES_L[mejor] + '</b> (' + porMes[mejor] + (porMes[mejor] === 1 ? ' hallazgo' : ' hallazgos') + ').</p>'
      : '<div class="sv-empty">' + I.seta + '<div>' + (por ? '<b>Aún no has ido.</b> Cuando marques algo aquí pasará a «Visitado».' : '<b>Sin especies anotadas.</b> Pulsa «Marcar aquí» la próxima vez que vengas, o añádelas desde la salida.') + '</div></div>') +
    (ss.some(x => (x.track || []).length > 1) ? '<p class="mut sm">En el mapa, en amarillo: el recorrido de tus visitas.</p>' : '') + (ss.length ? '<div class="sec">Visitas<small>' + ss.length + '</small></div>' + ss.map(s => { const n = new Set(hs.filter(h => h.salidaId === s.id).map(h => h.especieId || h.especieTxt)).size; return '<a class="vrow" href="#salida/' + s.id + '"><span class="vd"><b>' + (s.fecha || '').slice(8, 10) + '</b>' + esc(new Date((s.fecha || '2000-01-01') + 'T12:00').toLocaleDateString('es-ES', { month: 'short' })) + '</span><span class="vt"><b>' + esc(s.titulo || fecha(s.fecha)) + '</b><small>' + (s.fecha || '').slice(0, 4) + ' · ' + (n ? n + (n === 1 ? ' especie' : ' especies') + ' aquí' : 'sin especies anotadas aquí') + '</small></span>' + I.chev + '</a>'; }).join('') : '') +
    (z.notas || Object.values(z.transcripciones || {}).some(Boolean) ? '<div class="sec">Notas</div><div class="nota">' + (z.notas ? '<p>' + esc(z.notas) + '</p>' : '') + Object.values(z.transcripciones || {}).filter(Boolean).map(t => '<p class="vz">«' + esc(t) + '»</p>').join('') + '</div>' : '') +
    ((z.fotos || []).length ? '<div class="sec">Fotos</div><div class="gal">' + z.fotos.map(f => '<img data-blob="' + f + '" alt="">').join('') + '</div>' : ''), { dim: false });
  marcarSel(id);
  /* recorridos de las salidas que pasaron por aquí (para saber cómo se llega) */
  if (S.spTrk) S.spTrk.remove(); S.spTrk = L.layerGroup().addTo(S.map); ss.filter(x => (x.track || []).length > 1).forEach(x => trazo(x.track).addTo(S.spTrk));
  S.map.setView([z.lat, z.lon], Math.max(S.map.getZoom(), 15), { animate: false });
  encuadrar(z.lat, z.lon, sh);
  sh.addEventListener('click', ev => {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.id === 'st-marcar') { closeSheet(); marcar(lejos ? { zona: id, pos: { lat: z.lat, lon: z.lon } } : { zona: id }); }
    else if (t.id === 'sv-x') closeSheet();
    else if (t.id === 'st-edit') editarSpot(id);
    else if (t.dataset.e) abrirFicha(t.dataset.e);
    else if (t.dataset.hv) verHallazgo(t.dataset.hv);
  });
}

/* Resumen de un hallazgo: foto, especie, cuándo y dónde. Para cambiar algo, «Editar». */
async function verHallazgo(id) {
  const h = await db.get('hallazgos', id); if (!h) return;
  const e = cat.byId(h.especieId), z = h.zonaId ? await db.get('zonas', h.zonaId) : null, idn = IDENT[h.identificacion] || IDENT.sin_identificar;
  const foto = h.fotos && h.fotos[0] ? '<span class="phw big"><img class="ph" data-blob="' + h.fotos[0] + '" alt="Foto del hallazgo"></span>' : e && e.fotos && e.fotos[0] ? fi.foto(e.fotos[0], 960, { cls: 'big' }) + '<span class="ref">Foto de referencia</span>' : '';
  const dato = (k, v) => v ? '<div><dt>' + k + '</dt><dd>' + esc(v) + '</dd></div>' : '';
  const sh = openSheet((foto ? '<div class="hv-foto">' + foto + '</div>' : '') +
    '<div class="sv-h"><div class="sv-t"><h2>' + esc(nombreCorto(h)) + '</h2>' + (e && corto(e) !== e.nombreCientifico.split(' (')[0] ? '<p class="cien"><i>' + esc(e.nombreCientifico.split(' (')[0]) + '</i></p>' : '') + '</div><button class="icb" id="hv-edit" aria-label="Editar hallazgo">' + I.edit + '</button><button class="icb" id="sv-x" aria-label="Cerrar">' + I.close + '</button></div>' +
    '<div class="meta" style="margin-top:8px">' + (e ? fi.tagEsp(e) : '') + '<span class="tag" style="--c:' + idn.color + ';color:#0a0f0e">' + idn.label + '</span></div>' +
    '<dl class="dat">' + dato('Cuándo', new Date(h.ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + hhmm(h.ts)) + dato('Spot', z && z.nombre) + dato('Cantidad', h.cantidad) + dato('Estado', (ESTADOS.find(x => x[0] === h.estadoSeta) || [])[1]) + dato('Sustrato', h.sustrato) + dato('Confirmó', h.identificacion === 'confirmada' && h.confirmadoPor) + '</dl>' +
    (h.notas || Object.values(h.transcripciones || {}).some(Boolean) ? '<div class="nota">' + (h.notas ? '<p>' + esc(h.notas) + '</p>' : '') + Object.values(h.transcripciones || {}).filter(t => t && t !== h.notas).map(t => '<p class="vz">«' + esc(t) + '»</p>').join('') + '</div>' : '') +
    avisoComer(e) +
    '<div class="acts">' + (e ? '<button class="btn" id="hv-ficha">' + I.libro + 'Ver ficha</button>' : '') + (z ? '<button class="btn" id="hv-spot">' + I.flag + esc(z.nombre) + '</button>' : '') + '</div>');
  sh.addEventListener('click', ev => {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.id === 'hv-edit') abrirHallazgo(id);
    else if (t.id === 'sv-x') closeSheet();
    else if (t.id === 'hv-ficha') abrirFicha(e.id);
    else if (t.id === 'hv-spot') verSpot(z.id);
    else if (t.id === 'hd-antes') abrirAntesDeComer();
  });
}

/* ---------- hallazgo: ver / editar ---------- */
async function abrirHallazgo(id) {
  const h = await db.get('hallazgos', id); if (!h) return;
  const st = { id: h.especieId, txt: h.especieTxt || '' }, e = cat.byId(h.especieId);
  let ident = h.identificacion, estado = h.estadoSeta, recogida = h.recogida, fotos = [...(h.fotos || [])]; const vz = nuevoVoz(h);
  const zona = h.zonaId ? await db.get('zonas', h.zonaId) : null;
  const sh = openSheet('<h2>' + esc(nombreHall(h)) + '</h2><p class="sub">' + hhmm(h.ts) + ' · ' + new Date(h.ts).toLocaleDateString('es-ES') + (h.precisionM != null ? ' · ±' + h.precisionM + ' m' : '') + (zona ? ' · ' + esc(zona.nombre) : '') + '</p>' +
    pickerHTML(st) + '<div id="hd-aviso">' + avisoComer(e) + '</div>' +
    '<label class="l">Identificación</label><div class="seg" id="hd-id">' + Object.entries(IDENT).map(([k, v]) => '<button data-i="' + k + '" class="' + (ident === k ? 'on' : '') + '">' + v.label.replace(' por experto', '') + '</button>').join('') + '</div>' +
    '<div id="hd-conf" ' + (ident === 'confirmada' ? '' : 'hidden') + '><label class="l">Confirmada por (persona o sociedad)</label><input type="text" id="hd-por" value="' + esc(h.confirmadoPor) + '" placeholder="p. ej. Aranzadi"></div>' +
    '<label class="l">Cantidad</label><input type="text" id="hd-cant" value="' + esc(h.cantidad) + '">' +
    '<label class="l">Estado</label><div class="seg" id="hd-est">' + ESTADOS.map(x => '<button data-e="' + x[0] + '" class="' + (estado === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>' +
    '<label class="l">Sustrato / árbol</label><input type="text" id="hd-sus" value="' + esc(h.sustrato) + '" placeholder="p. ej. haya, pino, pradera">' +
    '<label class="l">Nota</label><textarea id="hd-nota">' + esc(h.notas) + '</textarea>' + vozHTML(vz) +
    '<label class="l">Fotos</label><div class="thumbs" id="hd-th">' + fotos.map(f => '<img data-blob="' + f + '">').join('') + '</div><div class="row"><button class="btn" id="hd-foto">Añadir foto</button></div>' +
    '<div class="row"><label class="check" style="border:0;padding:0;flex:1"><input type="checkbox" id="hd-rec" ' + (recogida ? 'checked' : '') + '> La he recogido</label></div>' +
    '<div class="row"><button class="btn d" id="hd-del">Borrar</button><button class="btn" id="hd-mov">Mover punto</button><button class="btn p" id="hd-ok">Guardar</button></div>');
  pickerWire(sh, st); vozWire(sh, vz);
  $('#sp-sugs', sh).addEventListener('click', () => { $('#hd-aviso', sh).innerHTML = avisoComer(cat.byId(st.id)); });
  sh.addEventListener('click', async ev => {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.i) { ident = t.dataset.i; $$('#hd-id button', sh).forEach(b => b.classList.toggle('on', b.dataset.i === ident)); $('#hd-conf', sh).hidden = ident !== 'confirmada'; }
    else if (t.dataset.e) { estado = estado === t.dataset.e ? '' : t.dataset.e; $$('#hd-est button', sh).forEach(b => b.classList.toggle('on', b.dataset.e === estado)); }
    else if (t.id === 'hd-foto') pickFoto(fid => { fotos.push(fid); const im = document.createElement('img'); im.dataset.blob = fid; $('#hd-th', sh).appendChild(im); hydrate($('#hd-th', sh)); });
    else if (t.id === 'hd-antes') abrirAntesDeComer();
    else if (t.id === 'hd-del') { if (t.dataset.sure) { await db.remove('hallazgos', id); closeSheet(); toast('Hallazgo borrado'); } else { t.dataset.sure = 1; t.textContent = 'Pulsa otra vez para borrar'; } }
    else if (t.id === 'hd-mov') { closeSheet(); moverPunto(h); }
    else if (t.id === 'hd-ok') {
      const por = $('#hd-por', sh).value.trim();
      if (ident === 'confirmada' && !por) { toast('Indica quién lo ha confirmado'); return; }
      await db.patch('hallazgos', id, { especieId: st.id, especieTxt: st.id ? '' : ($('#sp-q', sh).value.trim()), identificacion: ident, confirmadoPor: ident === 'confirmada' ? por : '',
        cantidad: $('#hd-cant', sh).value.trim(), estadoSeta: estado, sustrato: $('#hd-sus', sh).value.trim(), notas: $('#hd-nota', sh).value.trim(), fotos, recogida: $('#hd-rec', sh).checked, audios: vz.audios, transcripciones: vz.trans });
      closeSheet(); toast('Guardado'); syn.auto();
    }
  });
}
const avisoComer = e => e && (e.candidataComestible || /^comestible/.test(e.clase)) ?
  '<div class="note" style="margin-top:8px">Aunque la seta sea una candidata a comestible, la app no certifica nada: antes de comer, confirmación presencial por una persona experta. <button class="btn" id="hd-antes" style="margin-top:8px">Antes de comer</button></div>' : '';
function moverPunto(h) {
  S.map.setView([h.lat, h.lon], Math.max(S.map.getZoom(), 17)); location.hash = '#mapa';
  setTimeout(() => {
    const pos = { lat: h.lat, lon: h.lon }; S.tmp = dragPin()(h.lat, h.lon).addTo(S.map);
    S.tmp.on('dragend', () => { const p = S.tmp.getLatLng(); pos.lat = p.lat; pos.lon = p.lng; });
    const sh = openSheet('<h2>Mover punto</h2><p class="sub">Arrastra el marcador naranja a su sitio.</p><div class="row"><button class="btn" id="mv-x">Cancelar</button><button class="btn p" id="mv-ok">Listo</button></div>', { dim: false });
    $('#mv-x', sh).onclick = closeSheet;
    $('#mv-ok', sh).onclick = async () => { await db.patch('hallazgos', h.id, { lat: pos.lat, lon: pos.lon, precisionM: null, ajustadoAMano: true }); closeSheet(); toast('Punto movido'); syn.auto(); };
  }, 120);
}

/* ---------- salidas y zonas ---------- */
async function activa() { return (await db.list('salidas')).find(s => s.estado === 'en_curso') || null; }
function mejorZonaId(hs) { const c = {}; hs.forEach(h => { if (h.zonaId) c[h.zonaId] = (c[h.zonaId] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || null; }
async function empezarSalida() {
  if (await activa()) { toast('Ya hay una salida en curso'); return; }
  const id = await db.add('salidas', { fecha: hoy(), titulo: '', notas: '', zonaIds: [], fotos: [], fotosCosecha: [], track: [], grabar: false, estado: 'en_curso', totalTxt: '', zonaMejorId: '', creada: Date.now(), fin: null });
  toast('Salida empezada'); location.hash = '#salida/' + id;
}
/* Duración de la salida: desde que se empieza hasta que se termina (o hasta ahora si sigue en curso) */
const durSeg = s => !s.creada ? 0 : Math.max(0, Math.round(((s.estado === 'en_curso' ? Date.now() : s.fin) || s.creada) - s.creada) / 1000);
const kmTxt = s => { const m = trk.metros(s.track); return m > 0 ? trk.fmtKm(m) : '—'; };
const durTxt = s => { const d = durSeg(s); return d >= 60 ? trk.fmtDur(d) : '—'; };
/* fila de caritas de especie (foto pequeña con el color de su clase) */
const mini = e => '<span class="mav" style="--c:' + colorEsp(e) + '">' + (e && e.fotos && e.fotos[0] ? '<img class="ph" src="' + esc(fi.fotoURL(e.fotos[0], 250)) + '" alt="" loading="lazy" crossorigin="anonymous">' : '') + '</span>';
const especiesDe = hs => [...new Map(hs.map(h => [h.especieId || 'x:' + norm(h.especieTxt), cat.byId(h.especieId)])).values()];
const avatares = (hs, max = 6) => { const es = especiesDe(hs); return es.length ? '<span class="mavs">' + es.slice(0, max).map(mini).join('') + (es.length > max ? '<span class="mav more">+' + (es.length - max) + '</span>' : '') + '</span>' : ''; };
const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);
const diaMes = iso => { const d = new Date((iso || '2000-01-01') + 'T12:00'); return '<span class="vd"><b>' + d.getDate() + '</b>' + esc(d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')) + '</span>'; };
async function renderSalidas() {
  const [ss, hs, act] = [(await db.list('salidas')).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.creada || 0) - (a.creada || 0)), await db.list('hallazgos'), await activa()];
  const zs = (await db.list('zonas')).filter(z => z.lat != null), yo = geo.fix();
  const deS = id => hs.filter(h => h.salidaId === id), deZ = id => hs.filter(h => h.zonaId === id);
  const nSpots = s => new Set([...(s.zonaIds || []), ...deS(s.id).map(h => h.zonaId).filter(Boolean)]).size;
  const ultZ = z => { const t = Math.max(0, ...deZ(z.id).map(h => h.ts), ...ss.filter(s => (s.zonaIds || []).includes(z.id)).map(s => new Date(s.fecha + 'T12:00').getTime())); return t ? 'últ. ' + new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''; };
  const filaZ = z => { const h = deZ(z.id), ne = especiesDe(h).length, por = z.estado === 'por_visitar';
    return '<button class="item spotc' + (por ? ' por' : '') + '" data-spot="' + z.id + '"><span class="sico">' + (por ? I.flag : I.seta) + '</span><div class="t"><b>' + esc(z.nombre) + '</b><small>' + [ne ? plural(ne, 'especie', 'especies') : (por ? 'sin visitar' : 'sin especies'), yo ? kmFmt(distM(yo, z)) : '', ultZ(z)].filter(Boolean).join(' · ') + '</small>' + avatares(h) + '</div>' + I.chev + '</button>'; };
  const grupo = (est, tit) => { const l = zs.filter(z => (z.estado || 'visitada') === est).sort((a, b) => yo ? distM(yo, a) - distM(yo, b) : a.nombre.localeCompare(b.nombre, 'es', { numeric: true })); return l.length ? '<div class="grp" style="--c:' + spotColor({ estado: est }) + '">' + tit + '<small>' + l.length + '</small></div>' + l.map(filaZ).join('') : ''; };
  const filaS = s => { const h = deS(s.id), n = nSpots(s);
    return '<a class="item sal" href="#salida/' + s.id + '">' + diaMes(s.fecha) + '<div class="t"><b>' + esc(s.titulo || fecha(s.fecha)) + '</b><small>' + [(s.fecha || '').slice(0, 4), n ? plural(n, 'spot', 'spots') : '', plural(h.length, 'hallazgo', 'hallazgos'), s.totalTxt ? esc(s.totalTxt) : '', s.estado === 'en_curso' ? 'en curso' : ''].filter(Boolean).join(' · ') + '</small>' + avatares(h) + '</div>' + I.chev + '</a>'; };
  $('#v-salidas').innerHTML = '<div class="pad">' + (act ? '<a class="item cur-sal" href="#salida/' + act.id + '"><span class="rdot"></span><div class="t"><b>Salida en curso</b><small>' + esc(fecha(act.fecha)) + ' · ' + plural(deS(act.id).length, 'hallazgo', 'hallazgos') + ' · ' + durTxt(act) + '</small></div><span class="tag" style="--c:#e0a458;color:#1a1206">Abrir</span></a>'
    : '<button class="start" id="s-new"><span class="ic">' + I.plus + '</span><span class="t"><b>Empezar salida</b><small>Graba el recorrido y lo que encuentres en cada spot</small></span></button>') +
    '<div class="sec">Salidas<small>' + (ss.length || '') + '</small></div>' + (ss.length ? ss.map(filaS).join('') : '<div class="empty">Aún no hay salidas.<br>Empieza una cuando salgas al monte.</div>') +
    '<div class="sec">Mis spots<small>' + (zs.length || '') + '</small></div>' + (zs.length ? grupo('por_visitar', 'Quiero ir') + grupo('visitada', 'Visitados') : '<div class="empty">Marca sitios que has visitado o que quieres visitar y aparecerán aquí y en el mapa.</div>') +
    '<div class="row"><button class="btn" id="s-spot">' + I.flag + ' Nuevo spot</button></div></div>';
  const b = $('#s-new'); if (b) b.onclick = empezarSalida;
  $('#s-spot').onclick = () => editarSpot();
  $('#v-salidas').onclick = e => { const b = e.target.closest('[data-spot]'); if (b) abrirSpot(b.dataset.spot); };
}
/* GPX de Wikiloc (u otra app): sustituye el recorrido de la salida. Cada <trkseg> es un tramo. */
function leerGPX(txt) {
  const d = new DOMParser().parseFromString(txt, 'application/xml'), pts = [];
  if (d.querySelector('parsererror')) throw new Error('No es un GPX válido');
  const segs = [...d.getElementsByTagName('trkseg')], grupos = segs.length ? segs : [d.documentElement];
  grupos.forEach(g => [...g.getElementsByTagName(segs.length ? 'trkpt' : 'rtept')].forEach((p, i) => {
    const la = +p.getAttribute('lat'), lo = +p.getAttribute('lon'), tm = p.getElementsByTagName('time')[0];
    if (!isFinite(la) || !isFinite(lo)) return;
    const q = [+la.toFixed(5), +lo.toFixed(5), tm ? Math.round(Date.parse(tm.textContent) / 1000) || 0 : 0]; if (i === 0 && pts.length) q.push(1); pts.push(q);
  }));
  if (pts.length < 2) throw new Error('El GPX no tiene recorrido');
  return pts;
}
function importarGPX(id) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.gpx,application/gpx+xml,application/xml,text/xml'; inp.id = 'file-gpx'; inp.style.display = 'none'; document.body.appendChild(inp);
  inp.onchange = async () => {
    const f = inp.files[0]; inp.remove(); if (!f) return;
    try { const pts = leerGPX(await f.text()); if (trk.activo() === id) await trk.stop(); await db.patch('salidas', id, { track: pts, grabar: false, gpx: f.name }); toast('Recorrido importado · ' + trk.fmtKm(trk.metros(pts))); syn.auto(); }
    catch (e) { toast(e.message || 'No se pudo leer el GPX', 3600); }
  };
  inp.click();
}
function bajarArchivo(nombre, texto, tipo) {
  const u = URL.createObjectURL(new Blob([texto], { type: tipo })), a = document.createElement('a');
  a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
}
const galHTML = (ids, k) => ids.map(f => '<img data-blob="' + f + '" data-k="' + k + '" alt="Foto">').join('');
/* Ver una foto grande; permite quitarla de la salida */
function verFoto(sid, k, fid) {
  const sh = openSheet('<img data-blob="' + fid + '" class="big-foto" alt="Foto"><div class="row"><button class="btn d" id="vf-del">Quitar de la salida</button><button class="btn p" id="vf-x">Cerrar</button></div>');
  $('#vf-x', sh).onclick = closeSheet;
  $('#vf-del', sh).onclick = async () => { const cur = await db.get('salidas', sid); if (cur) await db.patch('salidas', sid, { [k]: (cur[k] || []).filter(x => x !== fid) }); closeSheet(); toast('Foto quitada'); syn.auto(); };
}
async function addFoto(sid, k, fid) { const cur = await db.get('salidas', sid); await db.patch('salidas', sid, { [k]: [...((cur && cur[k]) || []), fid] }); syn.auto(); }
async function renderSalida(id) {
  const gen = S.gen = (S.gen || 0) + 1;   // si llegan varios pintados seguidos (una foto, un punto…), solo vale el último
  const s = await db.get('salidas', id), root = $('#v-salida');
  const [hs0, zonas] = [await db.list('hallazgos'), await db.list('zonas')];
  if (gen !== S.gen) return;
  if (S.mini) { S.mini.remove(); S.mini = null; }
  if (S.unlive) { S.unlive(); S.unlive = null; } clearInterval(S.tick);
  if (!s) { root.innerHTML = '<div class="pad"><a class="back" href="#salidas">‹ Salidas</a><div class="empty">Esta salida no existe.</div></div>'; return; }
  const hs = hs0.filter(h => h.salidaId === id).sort((a, b) => a.ts - b.ts);
  const zn = zid => (zonas.find(z => z.id === zid) || {}).nombre || '—';
  const porZona = {}; hs.forEach(h => { if (h.zonaId) porZona[h.zonaId] = (porZona[h.zonaId] || 0) + 1; });
  const zids = [...new Set([...(s.zonaIds || []), ...Object.keys(porZona)])].filter(zid => zonas.some(z => z.id === zid));
  const auto = mejorZonaId(hs), mejor = s.zonaMejorId || auto, pend = hs.filter(h => h.identificacion !== 'confirmada').length;
  const curso = s.estado === 'en_curso', graba = curso && s.grabar !== false, cos = s.fotosCosecha || [];
  const live = () => trk.activo() === id ? { ...s, track: trk.puntos() } : s;
  /* spots en el orden en que se recorrieron (por la hora del primer hallazgo) */
  const t0 = zid => Math.min(Infinity, ...hs.filter(h => h.zonaId === zid).map(h => h.ts));
  const orden = zids.slice().sort((a, b) => t0(a) - t0(b));
  const tramo = zid => { const ts = hs.filter(h => h.zonaId === zid).map(h => h.ts); if (!ts.length) return ''; const a = hhmm(Math.min(...ts)), b = hhmm(Math.max(...ts)); return a === b ? a : a + '–' + b; };
  const chips = zid => { const g = {}; hs.filter(h => h.zonaId === zid).forEach(h => { const k = h.especieId || 'x:' + norm(h.especieTxt); (g[k] = g[k] || { h, n: 0 }).n++; });
    const l = Object.values(g); return l.length ? '<div class="echs">' + l.map(r => { const e = cat.byId(r.h.especieId); return '<button class="ech" ' + (e ? 'data-e="' + e.id + '"' : 'data-h="' + r.h.id + '"') + '>' + mini(e) + '<span>' + esc(nombreCorto(r.h)) + (r.n > 1 ? ' <em>×' + r.n + '</em>' : '') + '</span></button>'; }).join('') + '</div>' : '<p class="mut sm" style="margin:4px 0 0">Sin especies anotadas</p>'; };
  const nEsp = especiesDe(hs).length;
  const tab = S.sdTab && S.sdTab.id === id ? S.sdTab.t : 'spots', tieneTrk = (live().track || []).length > 1;
  const TABS = [['spots', 'Spots', zids.length], ['hall', 'Hallazgos', hs.length], ['fotos', 'Fotos', cos.length + (s.fotos || []).length], ['mas', 'Más', '']];
  const panel = (k, html) => '<div class="tabp" data-p="' + k + '"' + (k === tab ? '' : ' hidden') + '>' + html + '</div>';
  const pSpots = (orden.length ? '<div class="tline">' + orden.map((zid, i) => { const z = zonas.find(x => x.id === zid), n = hs.filter(h => h.zonaId === zid).length;
      return '<div class="tl"><span class="tn">' + (i + 1) + '</span><div class="tc"><div class="th"><div><b>' + esc(z.nombre) + '</b><small>' + [tramo(zid), n ? plural(n, 'hallazgo', 'hallazgos') : ''].filter(Boolean).join(' · ') + '</small></div><button class="btn sm" data-sa="' + zid + '">＋ Especie</button></div>' + chips(zid) + '</div></div>'; }).join('') + '</div>'
      : '<div class="sv-empty">' + I.flag + '<div><b>Aún sin spots.</b> ' + (curso ? 'Cuando llegues a un sitio interesante pulsa «Spot aquí».' : 'Añade los sitios por los que pasaste.') + '</div></div>') + '<div class="row"><button class="btn" id="sd-addspot">＋ Añadir spot a la salida</button></div>';
  const pHall = hs.length ? hs.map(h => { const e = cat.byId(h.especieId); return '<button class="item" data-h="' + h.id + '">' + (e ? fi.avatar(e) : '<span class="dot" style="--c:' + (IDENT[h.identificacion] || IDENT.sin_identificar).color + '"></span>') + '<div class="t"><b>' + esc(nombreCorto(h)) + '</b><small>' + hhmm(h.ts) + (h.zonaId ? ' · ' + esc(zn(h.zonaId)) : '') + (h.cantidad ? ' · ' + esc(h.cantidad) : '') + ' · ' + (IDENT[h.identificacion] || IDENT.sin_identificar).label + '</small></div>' + I.chev + '</button>'; }).join('') + (mejor ? '<p class="mut sm">Donde más hubo: <b>' + esc(zn(mejor)) + '</b></p>' : '') : '<div class="empty">Sin hallazgos todavía.</div>';
  const pFotos = '<div class="cosecha"><b>Lo que me llevé</b><div class="gal" id="sd-cos">' + (cos.length ? galHTML(cos, 'fotosCosecha') : '') + '</div>' + (cos.length ? '' : '<p>Al llegar a casa, una foto de todo lo recogido.</p>') + '<div class="row"><button class="btn p" id="sd-cos-add">Añadir foto de lo recogido</button></div>' +
    '<label class="l">Total recogido</label><input type="text" id="sd-tot" value="' + esc(s.totalTxt) + '" placeholder="p. ej. ≈2 kg"></div>' +
    '<label class="l">Otras fotos de la salida</label><div class="gal" id="sd-gal">' + galHTML(s.fotos || [], 'fotos') + '</div><div class="row"><button class="btn" id="sd-foto">Añadir foto</button></div>';
  const pMas = '<label class="l" style="margin-top:4px">Dónde hubo más</label><select id="sd-mej"><option value="">' + (auto ? 'Automático: ' + esc(zn(auto)) : 'Automático') + '</option>' + zonas.filter(z => porZona[z.id] || z.id === s.zonaMejorId).map(z => '<option value="' + z.id + '"' + (s.zonaMejorId === z.id ? ' selected' : '') + '>' + esc(z.nombre) + ' (' + (porZona[z.id] || 0) + ')</option>').join('') + '</select>' +
    '<label class="l">Recorrido</label><div class="card trk-c"><div class="kv2"><div><b id="sd-km">' + kmTxt(live()) + '</b><span>distancia</span></div><div><b id="sd-dur">' + durTxt(s) + '</b><span>duración</span></div></div>' +
    '<p class="mut sm">' + (tieneTrk ? 'Se ve en el mapa de arriba y en los spots que visitaste.' : 'Opcional. Puedes importar el GPX de Wikiloc al volver.') + '</p>' +
    '<div class="row"><button class="btn" id="sd-gpxin">Importar GPX (Wikiloc)</button>' + (hs.length || tieneTrk ? '<button class="btn" id="sd-gpx">Exportar GPX</button>' : '') + '</div>' +
    (curso ? '<div class="rec ' + (graba ? 'on' : '') + '" style="margin-top:10px"><span class="rdot"></span><div class="t"><b>' + (graba ? 'Grabando el recorrido' : tieneTrk ? 'Recorrido en pausa' : 'Grabar con el GPS del móvil') + '</b><small>' + (graba ? 'Mantén la app abierta: si el móvil bloquea la pantalla puede dejar de grabar.' : 'Apagado: gasta batería y no hace falta si usas Wikiloc.') + '</small></div><button class="btn" id="sd-pau">' + (graba ? 'Pausar' : (tieneTrk ? 'Reanudar' : 'Grabar')) + '</button></div>' +
      (graba && trk.pantallaSoportada() ? '<div class="rec"><div class="t"><b>Pantalla encendida</b><small>Evita que se apague mientras andas. Gasta más batería.</small></div><button class="btn' + (trk.pantallaOn() ? ' p' : '') + '" id="sd-wake">' + (trk.pantallaOn() ? 'Activada' : 'Activar') + '</button></div>' : '') : '') + '</div>' +
    '<div class="row" style="margin-top:18px">' + (curso ? '' : '<button class="btn" id="sd-reab">Reabrir salida</button>') + '<button class="btn d" id="sd-del">Borrar salida</button></div>';
  root.innerHTML = '<div class="pad sal-pg"><a class="back" href="#salidas">‹ Salidas</a>' +
    '<div class="hero-m"><div class="smap big" id="smap"></div>' + (curso ? '<span class="live"><i></i>En curso · ' + durTxt(s).replace('—', 'recién empezada') + '</span>' : '') + '</div>' +
    '<div class="sd-hd"><div class="sd-tt"><input type="text" id="sd-tit" class="tit" value="' + esc(s.titulo) + '" placeholder="Ponle un título"><div class="sd-date">' + esc(fecha(s.fecha)) + (curso ? '' : ' · terminada') + '</div></div>' + (curso ? '<button class="btn p" id="sd-fin">Terminar</button>' : '') + '</div>' +
    (curso && !hs.length && !zids.length ? '<div class="pasos"><div><i>1</i><span><b>Llegas a un sitio bueno</b>«Spot aquí» y queda guardado</span></div><div><i>2</i><span><b>Ves una seta</b>«Especie aquí»: foto y nota de voz</span></div><div><i>3</i><span><b>En casa</b>foto de lo recogido y «Terminar»</span></div></div>' : '') +
    (!hs.length && !zids.length ? '' : '<div class="kpis"><div class="stats"><div><b>' + hs.length + '</b><span>hallazgos</span></div><div><b>' + zids.length + '</b><span>spots</span></div><div><b>' + nEsp + '</b><span>especies</span></div><div><b>' + pend + '</b><span>por identificar</span></div></div></div>') +
    (curso ? '<div class="quick"><button class="qb p" id="sd-mk">' + I.plus + '<span><b>Especie aquí</b><small>con tu GPS</small></span></button><button class="qb" id="sd-sp">' + I.flag + '<span><b>Spot aquí</b><small>nuevo sitio</small></span></button></div>' : '') +
    '<div class="tabs" role="tablist">' + TABS.map(([k, t, n]) => '<button data-tb="' + k + '" class="' + (k === tab ? 'on' : '') + '">' + t + (n ? '<em>' + n + '</em>' : '') + '</button>').join('') + '</div>' +
    panel('spots', pSpots) + panel('hall', pHall) + panel('fotos', pFotos) + panel('mas', pMas) + '</div>';
  hydrate(root);
  /* minimapa: recorrido + hallazgos */
  S.mini = createMap('smap', { zoom: 10 }); const ls = [], capa = L.layerGroup().addTo(S.mini);
  const pintar = () => { capa.clearLayers(); trazo(live().track).addTo(capa); };
  pintar(); trk.lineas(live().track).forEach(l => l.forEach(p => ls.push([p[0], p[1]])));
  hs.forEach(h => { pinH(h, { interactive: false }).addTo(S.mini); ls.push([h.lat, h.lon]); });
  orden.forEach((zid, i) => { const z = zonas.find(x => x.id === zid); if (!z || z.lat == null) return; L.marker([z.lat, z.lon], { interactive: false, zIndexOffset: 500, icon: L.divIcon({ className: 'tnm', html: '<b>' + (i + 1) + '</b>', iconSize: [24, 24], iconAnchor: [12, 12] }) }).addTo(S.mini); ls.push([z.lat, z.lon]); });
  if (!ls.length) { const f = geo.fix(); if (f) { S.mini.setView([f.lat, f.lon], 15); L.marker([f.lat, f.lon], { interactive: false, icon: L.divIcon({ className: 'me', html: '<i></i>', iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(S.mini); } }
  if (ls.length) S.mini.fitBounds(ls, { padding: [30, 30], maxZoom: 17, animate: false });
  if (trk.activo() === id) S.unlive = trk.onAdd(() => { if (S.view !== 'salida' || S.arg !== id || !S.mini) return; pintar(); const k = $('#sd-km'); if (k) k.textContent = kmTxt(live()); });
  if (curso) S.tick = setInterval(() => { const d = $('#sd-dur'); if (S.view === 'salida' && S.arg === id && d) d.textContent = durTxt(s); }, 30000);
  $('#sd-tit', root).onchange = e => db.patch('salidas', id, { titulo: e.target.value.trim() });
  $('#sd-tot', root).onchange = e => db.patch('salidas', id, { totalTxt: e.target.value.trim() });
  $('#sd-mej', root).onchange = e => db.patch('salidas', id, { zonaMejorId: e.target.value });
  root.onclick = async ev => {
    const im = ev.target.closest('img[data-blob]'); if (im && im.dataset.k) { verFoto(id, im.dataset.k, im.dataset.blob); return; }
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.tb) { S.sdTab = { id, t: t.dataset.tb }; $$('.tabs button', root).forEach(b => b.classList.toggle('on', b === t)); $$('.tabp', root).forEach(p => { p.hidden = p.dataset.p !== t.dataset.tb; }); }
    else if (t.dataset.h) verHallazgo(t.dataset.h);
    else if (t.dataset.e) abrirFicha(t.dataset.e);
    else if (t.id === 'sd-mk') marcar();
    else if (t.id === 'sd-sp') editarSpot(null, { salida: id });
    else if (t.id === 'sd-gpxin') importarGPX(id);
    else if (t.dataset.sa) { const z = zonas.find(x => x.id === t.dataset.sa); if (z) marcar({ zona: z.id, salida: id, pos: { lat: z.lat, lon: z.lon }, ts: curso ? Date.now() : (s.creada || Date.now()) }); }
    else if (t.id === 'sd-addspot') {
      const libres = zonas.filter(z => !zids.includes(z.id) && z.lat != null).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));
      const sh = openSheet('<h2>Añadir spot a la salida</h2>' + (libres.length ? libres.map(z => '<button class="item" data-za="' + z.id + '"><div class="t"><b>' + esc(z.nombre) + '</b></div>' + spotTag(z) + '</button>').join('') : '<div class="empty">No hay más spots. Crea uno con ⚑ en el mapa.</div>') + '<div class="row"><button class="btn p" id="za-x">Cerrar</button></div>');
      sh.addEventListener('click', async e2 => { const b = e2.target.closest('button'); if (!b) return; if (b.id === 'za-x') return closeSheet(); if (b.dataset.za) { const z = zonas.find(x => x.id === b.dataset.za); await db.patch('salidas', id, { zonaIds: [...(s.zonaIds || []), z.id] }); if (z.estado === 'por_visitar') await db.patch('zonas', z.id, { estado: 'visitada', visitadaTs: s.creada || Date.now() }); closeSheet(); syn.auto(); } });
    }
    else if (t.id === 'sd-foto') pickFoto(fid => addFoto(id, 'fotos', fid));
    else if (t.id === 'sd-cos-add') pickFoto(fid => addFoto(id, 'fotosCosecha', fid));
    else if (t.id === 'sd-pau') { if (graba) { await trk.stop(); await db.patch('salidas', id, { grabar: false }); toast('Recorrido en pausa'); } else { await trk.start(id, (s.track || []).length > 0); await db.patch('salidas', id, { grabar: true }); toast('Grabando el recorrido'); } }
    else if (t.id === 'sd-wake') { const on = !trk.pantallaOn(); await trk.pantalla(on); t.textContent = on ? 'Activada' : 'Activar'; t.classList.toggle('p', on); toast(on ? 'La pantalla no se apagará' : 'La pantalla puede apagarse'); }
    else if (t.id === 'sd-gpx') { const cur = await db.get('salidas', id); bajarArchivo('salida-' + s.fecha + '.gpx', trk.gpx({ ...cur, track: trk.activo() === id ? trk.puntos() : cur.track }, hs, nombreHall), 'application/gpx+xml'); toast('GPX guardado en descargas'); }
    else if (t.id === 'sd-fin') terminarSalida(s, hs, zonas, porZona, mejor);
    else if (t.id === 'sd-reab') { if (await activa()) toast('Ya hay otra salida en curso'); else { await db.patch('salidas', id, { estado: 'en_curso', fin: null, grabar: false }); toast('Salida reabierta'); } }
    else if (t.id === 'sd-del') { if (t.dataset.sure) { if (trk.activo() === id) await trk.stop(); for (const h of hs) await db.patch('hallazgos', h.id, { salidaId: null }); await db.remove('salidas', id); toast('Salida borrada (los hallazgos se conservan)'); location.hash = '#salidas'; } else { t.dataset.sure = 1; t.textContent = 'Otra vez para borrar'; } }
  };
}
function terminarSalida(s, hs, zonas, porZona, mejor) {
  const zn = zid => (zonas.find(z => z.id === zid) || {}).nombre || '—', cos = (s.fotosCosecha || []).slice();
  const km = trk.activo() === s.id ? trk.metros(trk.puntos()) : trk.metros(s.track);
  const sh = openSheet('<h2>Terminar salida</h2><p class="sub">' + esc(fecha(s.fecha)) + '</p><div class="stats"><div><b>' + hs.length + '</b><span>hallazgos</span></div><div><b>' + Object.keys(porZona).length + '</b><span>zonas</span></div><div><b>' + hs.filter(h => h.recogida).length + '</b><span>recogidos</span></div></div>' +
    (km > 0 || durSeg({ ...s, estado: 'en_curso' }) >= 60 ? '<div class="stats"><div><b>' + (km > 0 ? trk.fmtKm(km) : '—') + '</b><span>recorrido</span></div><div><b>' + durTxt({ ...s, estado: 'en_curso' }) + '</b><span>duración</span></div></div>' : '') +
    (Object.keys(porZona).length ? '<div class="note">' + Object.keys(porZona).map(z => esc(zn(z)) + ': ' + porZona[z]).join(' · ') + (mejor ? '<br><b>Dónde más:</b> ' + esc(zn(mejor)) : '') + '</div>' : '') +
    '<div class="cosecha"><b>Fotos de lo que te llevas</b><p>Saca una foto a todo lo que recoges: queda de registro de por dónde has andado y qué has cogido.</p><div class="gal" id="tf-gal">' + galHTML(cos, 'x') + '</div><div class="row"><button class="btn p" id="tf-cam">Hacer foto</button><button class="btn" id="tf-gal-b">Desde la galería</button></div></div>' +
    '<label class="l">Total recogido</label><input type="text" id="tf-tot" value="' + esc(s.totalTxt) + '" placeholder="p. ej. ≈2 kg"><label class="l">Nota</label><textarea id="tf-nota">' + esc(s.notas) + '</textarea>' +
    '<div class="row"><button class="btn" id="tf-x">Seguir</button><button class="btn p" id="tf-ok" style="flex:2">Terminar</button></div>');
  const nueva = async fid => { cos.push(fid); await db.patch('salidas', s.id, { fotosCosecha: cos.slice() }); const im = document.createElement('img'); im.dataset.blob = fid; im.dataset.k = 'x'; $('#tf-gal', sh).appendChild(im); hydrate($('#tf-gal', sh)); syn.auto(); };
  $('#tf-cam', sh).onclick = () => pickFoto(nueva);
  $('#tf-gal-b', sh).onclick = () => pickFoto(nueva, { galeria: true });
  $('#tf-x', sh).onclick = closeSheet;
  $('#tf-ok', sh).onclick = async () => { await trk.stop(); await db.patch('salidas', s.id, { estado: 'terminada', fin: Date.now(), totalTxt: $('#tf-tot', sh).value.trim(), notas: $('#tf-nota', sh).value.trim(), zonaMejorId: s.zonaMejorId || mejor || '' }); closeSheet(); toast('Salida terminada'); syn.auto(1500); };
}
async function chipSalida() {
  const a = await activa(), c = $('#chip');
  if (!a) { c.hidden = true; return; }
  const n = (await db.list('hallazgos')).filter(h => h.salidaId === a.id).length;
  c.hidden = false; c.textContent = 'En curso · ' + n; c.onclick = () => { location.hash = '#salida/' + a.id; };
}

/* ---------- catálogo ---------- */
const ICO_SETA = '<svg viewBox="0 0 48 48"><path fill="#e0a458" d="M24 6C13 6 5 13.500 5 23c0 1 .8 1.700 1.700 1.700h34.600c.9 0 1.700-.7 1.700-1.700C43 13.500 35 6 24 6z"/><circle cx="16" cy="17" r="2.600" fill="#f4d9a8"/><circle cx="28" cy="13.500" r="2.200" fill="#f4d9a8"/><circle cx="33" cy="20" r="2" fill="#f4d9a8"/><path fill="#efe3cf" d="M18 25.500h12v9c0 4-2 7-6 7s-6-3-6-7z"/></svg>';
/* ---------- aprender poco a poco: una lección al día sacada de lo que encuentras y de la temporada ---------- */
async function encontradas() {
  const hs = (await db.list('hallazgos')).filter(h => h.especieId && cat.byId(h.especieId)).sort((a, b) => b.ts - a.ts), c = new Map();
  hs.forEach(h => { const r = c.get(h.especieId) || { n: 0, last: h.ts }; r.n++; c.set(h.especieId, r); });
  return c;   // id → { n, last } (ordenado: la más reciente primero)
}
function lecciones(enc) {
  const L = [], mes = new Date().getMonth() + 1, mias = [...enc.keys()].map(cat.byId);
  const temp = tmp.delMes(cat.todas(), mes).filter(r => r.nivel >= 2).map(r => r.e);
  mias.forEach(e => (e.confusiones || []).filter(c => c.gravedad === 'alta' && c.comoDistinguir).slice(0, 2).forEach(c => L.push({ tipo: 'Ojo con la confusión', e, e2: c.id ? cat.byId(c.id) : null, t: 'Encontraste ' + corto(e) + ': no la confundas con ' + (c.id && cat.byId(c.id) ? corto(cat.byId(c.id)) : c.nombre), x: c.comoDistinguir })));
  temp.filter(e => !enc.has(e.id) && e.clave).forEach(e => L.push({ tipo: (e.clase === 'mortal' || e.clase === 'toxica') ? 'Peligrosa que sale ahora' : 'Sale este mes', e, t: corto(e), x: e.clave }));
  mias.forEach(e => (e.queMirar || []).slice(0, 3).forEach(q => L.push({ tipo: 'Fíjate en', e, t: corto(e) + ': ' + q.titulo.toLowerCase(), x: q.texto })));
  [...mias, ...temp].forEach(e => (e.curiosidades || []).slice(0, 1).forEach(c => L.push({ tipo: '¿Sabías que…?', e, t: corto(e), x: c })));
  const vistos = new Set(); return L.filter(l => { const k = l.t + l.x; if (vistos.has(k)) return false; vistos.add(k); return true; });
}
const fotoGrande = e => e && e.fotos && e.fotos[0] ? '<img class="ph" src="' + esc(fi.fotoURL(e.fotos[0], 250)) + '" alt="" loading="lazy" crossorigin="anonymous">' : '';
function leccionHTML(L) {
  if (!L.length) return '';
  const dia = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 864e5), i = ((dia + (S.lecOff || 0)) % L.length + L.length) % L.length, l = L[i];
  return '<div class="lec"><div class="lec-h"><small>Hoy aprendes · ' + esc(l.tipo) + '</small><span>' + (i + 1) + '/' + L.length + '</span></div>' +
    (l.e2 ? '<div class="lec-vs"><button data-e="' + l.e.id + '" style="--c:' + colorEsp(l.e) + '"><span class="pf">' + fotoGrande(l.e) + '</span><b>' + esc(corto(l.e)) + '</b></button><i>vs</i><button data-e="' + l.e2.id + '" style="--c:' + colorEsp(l.e2) + '"><span class="pf">' + fotoGrande(l.e2) + '</span><b>' + esc(corto(l.e2)) + '</b></button></div>'
      : '<button class="lec-f" data-e="' + l.e.id + '" style="--c:' + colorEsp(l.e) + '">' + fotoGrande(l.e) + '</button>') +
    '<b class="lec-t">' + esc(l.t) + '</b><p>' + esc(l.x) + '</p><div class="lec-b"><button class="btn" data-e="' + l.e.id + '">' + I.libro + 'Ver ficha</button><button class="btn" id="lec-next">Otra ' + I.chev + '</button></div></div>';
}
async function pintarAprender() {
  const root = $('#v-setas'), enc = await encontradas(); S.enc = enc;
  const L = lecciones(enc), tot = cat.todas().length;
  $('#lec-w', root).innerHTML = leccionHTML(L);
  $('#col-w', root).innerHTML = '<div class="col"><div class="col-h"><b>Tu colección</b><span><em>' + enc.size + '</em> de ' + tot + ' especies</span></div><div class="col-bar"><u style="width:' + Math.max(2, Math.round(enc.size / tot * 100)) + '%"></u></div>' +
    (enc.size ? '<div class="col-row">' + [...enc.keys()].slice(0, 12).map(id => { const e = cat.byId(id); return '<button class="cmini" data-e="' + id + '">' + mini(e) + '</button>'; }).join('') + '</div>' : '<p class="mut sm">Cada especie que marques en el monte se añade aquí.</p>') + '</div>';
  if (S.view === 'setas') listaSetas();
}
function renderSetas() {
  const root = $('#v-setas');
  if (!$('#q', root)) {
    root.innerHTML = '<div class="pad"><div id="lec-w"></div><div id="col-w"></div>' +
      '<div class="learn2"><button class="lc" id="gu-open" style="--c:#e0a458">' + ICO_SETA + '<b>Partes de una seta</b><small>Esquema con nombres</small></button><button class="lc" id="li-open" style="--c:#7ccf8e"><span class="ic">' + lib.CAPS[0].ico + '</span><b>El libro</b><small>Para empezar</small></button><button class="lc" id="ia-open" style="--c:#b48cff"><span class="ic">✨</span><b>Reconocer con IA</b><small>Con 1–3 fotos</small></button></div>' +
      '<div class="sbar"><input type="search" id="q" placeholder="Buscar seta por nombre (es, eu, latín)…" autocomplete="off"><div class="chips" id="cl"></div></div>' +
      '<div class="warn sm2">' + esc(cat.aviso()) + '</div><div id="slist"></div>' +
      '<p class="note" style="margin-top:14px">Catálogo en borrador: ' + cat.todas().length + ' fichas sin revisar por una persona experta. Las comestibles llevan «según fuentes» porque lo dicen Wikipedia y guías divulgativas, no una persona experta: siguen pendientes de revisión. Fotos de Wikimedia Commons con su autoría y licencia en cada ficha.</p></div>';
    $('#q', root).oninput = e => { S.q = e.target.value; listaSetas(); };
    root.onclick = e => {
      if (e.target.closest('#gu-open')) return abrirGuia('');
      if (e.target.closest('#li-open')) return abrirLibro('');
      if (e.target.closest('#ia-open')) return abrirIA();
      if (e.target.closest('#lec-next')) { S.lecOff = (S.lecOff || 0) + 1; return pintarAprender(); }
      const c = e.target.closest('#cl button'); if (c) { if (c.dataset.mias !== undefined) S.mias = !S.mias; else { S.clase = c.dataset.c; if (!S.clase) S.mias = false; } return listaSetas(); }
      const b = e.target.closest('[data-e]'); if (b) abrirFicha(b.dataset.e);
    };
  }
  listaSetas(); pintarAprender();
}
const itemEsp = (e, extra = '') => { const m = S.enc && S.enc.get(e.id), cien = e.nombreCientifico.split(' (')[0], c = corto(e);
  return '<button class="item sp' + (m ? ' mia' : '') + '" data-e="' + e.id + '" style="--c:' + cat.CLASES[cat.vista(e)].color + '">' + fi.avatar(e) + (m ? '<span class="mia-b">✓' + (m.n > 1 ? ' ×' + m.n : '') + '</span>' : '') + '<div class="t"><b>' + esc(c) + '</b><small><i>' + esc(cien) + '</i>' + (c === cien ? ' · ' + esc(fi.nombres(e) || e.grupo) : '') + '</small>' + extra + '</div>' + fi.tagEsp(e) + '</button>'; };
function listaSetas() {
  const root = $('#v-setas');
  $('#cl', root).innerHTML = '<button class="opt ' + (!S.clase && !S.mias ? 'on' : '') + '" data-c="">Todas</button>' + (S.enc && S.enc.size ? '<button class="opt ' + (S.mias ? 'on' : '') + '" data-mias="">✓ Las mías</button>' : '') + Object.entries(cat.CLASES).filter(([k]) => cat.todas().some(e => cat.vista(e) === k)).map(([k, v]) => '<button class="opt ' + (S.clase === k ? 'on' : '') + '" data-c="' + k + '">' + v.label + '</button>').join('');
  const r = cat.buscar(S.q, { clase: S.clase }).filter(e => !S.mias || (S.enc && S.enc.has(e.id))); let h = '', cur = '';
  r.forEach(e => { const v = cat.vista(e); if (v !== cur) { cur = v; const n = r.filter(x => cat.vista(x) === cur).length; h += '<div class="grp" style="--c:' + cat.CLASES[cur].color + '">' + (cur === 'sin_datos' ? 'Sin datos' : cur === 'ok_fuentes' ? 'Comestibles · según fuentes' : cur === 'cond_fuentes' ? 'Con condiciones · según fuentes' : cat.CLASES[cur].label) + '<small>' + n + '</small></div>'; } h += itemEsp(e); });
  $('#slist', root).innerHTML = r.length ? h : '<div class="empty">Nada con ese nombre.</div>';
}
function abrirFicha(id) {
  const e = cat.byId(id); if (!e) return;
  const sh = openSheet(fi.fichaHTML(e, S.mes)), hero = $('#hero', sh), dots = $$('#dots i', sh);
  if (hero && dots.length) hero.onscroll = () => { const i = Math.round(hero.scrollLeft / Math.max(1, hero.clientWidth)); dots.forEach((d, k) => d.classList.toggle('on', k === i)); };
  sh.addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; if (b.dataset.e) abrirFicha(b.dataset.e); else if (b.dataset.g !== undefined) abrirGuia(b.dataset.g, id); else if (b.dataset.l !== undefined) abrirLibro(b.dataset.l, id); else if (b.id === 'fi-antes') abrirAntesDeComer(); });
}
function abrirGuia(sel, volverA) {
  const sh = openSheet(guiaHTML(sel) .replace('<button class="btn p" id="gu-x">Cerrar</button>', (volverA ? '<button class="btn" id="gu-b">‹ Volver a la ficha</button>' : '') + '<button class="btn p" id="gu-x">Cerrar</button>'));
  const on = $('.lg.on', sh); if (on) on.scrollIntoView({ block: 'center' });
  sh.addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; if (b.id === 'gu-x') closeSheet(); else if (b.id === 'gu-b') abrirFicha(volverA); });
}

function abrirLibro(cap, volverA) {
  const volver = '<button class="btn" id="li-b">‹ Volver a la ficha</button>$&';
  const sh = openSheet((cap ? lib.capHTML(cap) : lib.indiceHTML()).replace('<button class="btn p" id="gu-x">Cerrar</button>', volverA ? volver : '$&'));
  sh.addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; if (b.id === 'gu-x') closeSheet(); else if (b.id === 'li-b') abrirFicha(volverA); else if (b.dataset.l !== undefined) abrirLibro(b.dataset.l, volverA); });
}

/* ---------- reconocer con IA ---------- */
const IA_SLOTS = [['Sombrero (desde arriba)', 'Por encima'], ['Láminas o poros (por debajo)', 'Por debajo'], ['Base del pie (con la volva si hay)', 'Base del pie']];
function abrirIA() {
  const fotos = [null, null, null], urls = [];
  const sh = openSheet('');
  const pintar = (res, err, cargando) => {
    const hay = fotos.some(Boolean), key = ia.getKey();
    let h = '<h2>Reconocer con IA</h2>';
    if (!key) {
      h += '<p class="sub" style="font-family:inherit">Necesito una clave gratuita de Gemini. Se queda solo en este móvil.</p><ol class="note" style="margin:8px 0 0 18px;padding:0"><li>Entra en <b>aistudio.google.com/apikey</b></li><li>«Crear clave de API» (gratis, sin tarjeta)</li><li>Cópiala y pégala aquí</li></ol>' +
        '<input type="password" id="ia-k" placeholder="AIza…" autocomplete="off" autocapitalize="off" style="margin-top:10px"><div class="row"><button class="btn p" id="ia-ks">Guardar clave</button><button class="btn" id="gu-x">Cerrar</button></div>' + (err ? '<div class="warn" style="margin-top:10px">' + esc(err) + '</div>' : '');
      sh.innerHTML = h; return;
    }
    h += '<p class="sub" style="font-family:inherit">Cuantas más vistas, mejor: arriba, por debajo y la base del pie.</p><div class="ia-slots">' +
      IA_SLOTS.map((s, i) => '<label class="ia-slot' + (fotos[i] ? ' ok' : '') + '" data-i="' + i + '">' + (fotos[i] ? '<img src="' + urls[i] + '" alt="">' : '<span>＋</span>') + '<small>' + s[1] + '</small><input type="file" accept="image/*" data-i="' + i + '" hidden></label>').join('') + '</div>';
    if (cargando) h += '<div class="note" style="margin-top:12px">Mirando las fotos…</div>';
    if (err) h += '<div class="warn" style="margin-top:12px">' + esc(err) + '</div>';
    if (res) h += resultadoIA(res);
    h += '<div class="row"><button class="btn p" id="ia-go"' + (hay && !cargando ? '' : ' disabled') + '>Reconocer</button><button class="btn" id="gu-x">Cerrar</button></div>' +
      '<p class="note" style="margin-top:12px">Es una pista, no una identificación. Nunca se come una seta por lo que diga una IA ni esta app. Las fotos se envían a Google (Gemini) solo al pulsar «Reconocer». <a href="#" id="ia-kc" style="color:var(--acc)">Cambiar clave</a></p>';
    sh.innerHTML = h;
  };
  sh.onchange = e => {
    const f = e.target.files && e.target.files[0], i = +e.target.dataset.i; if (!f || isNaN(i)) return;
    fotos[i] = f; if (urls[i]) URL.revokeObjectURL(urls[i]); urls[i] = URL.createObjectURL(f); pintar();
  };
  sh.onclick = async e => {
    const b = e.target.closest('button'), a = e.target.closest('#ia-kc');
    if (a) { e.preventDefault(); ia.setKey(''); return pintar(); }
    if (b.id === 'gu-x') { urls.forEach(u => u && URL.revokeObjectURL(u)); return closeSheet(); }
    if (b.dataset.e) return abrirFicha(b.dataset.e);
    if (b.id === 'ia-ks') { const k = $('#ia-k', sh).value; if (!ia.claveValida(k)) return pintar(null, 'Esa clave no tiene la forma correcta (la de Google AI Studio, empieza por AIza… o AQ.…).'); ia.setKey(k); return pintar(); }
    if (b.id === 'ia-go') {
      if (!navigator.onLine) return pintar(null, ia.mensajeError(new Error('red')));
      pintar(null, '', true);
      try { pintar(await ia.reconocer(fotos.filter(Boolean))); }
      catch (err) { if (err.message === 'clave') ia.setKey(''); pintar(null, ia.mensajeError(err)); }
    }
  };
  pintar();
}
function resultadoIA(r) {
  const alta = c => c >= 75 ? 'confianza alta' : c >= 40 ? 'confianza media' : 'confianza baja';
  if (!r.esSeta) return '<div class="ia-res"><b>No parece una seta.</b><p class="note">Prueba con una foto más cercana.</p></div>';
  const peligro = r.candidatas.some(c => { const e = cat.byId(c.id); return e && (e.clase === 'mortal' || e.clase === 'toxica'); });
  let h = '<div class="ia-res">';
  if (!r.candidatas.length || r.candidatas.every(c => c.confianza < 25)) h += '<b>Con estas fotos no puedo decidirlo.</b>';
  else h += '<b>Se parece a:</b>';
  h += r.candidatas.map(c => {
    const e = cat.byId(c.id);
    if (e) return itemEsp(e, '<small class="ia-c">' + alta(c.confianza) + (c.rasgos ? ' · ' + esc(c.rasgos) : '') + '</small>');
    return '<div class="item sp ia-fuera" style="--c:#7b8683"><div class="t"><b><i>' + esc(c.nombreCientifico) + '</i></b><small>' + esc(c.nombreComun) + ' · no está en tu colección</small><small class="ia-c">' + alta(c.confianza) + (c.rasgos ? ' · ' + esc(c.rasgos) : '') + '</small></div></div>';
  }).join('');
  if (peligro) h += '<div class="warn" style="margin-top:8px">Entre las candidatas hay una tóxica o mortal: con más motivo, no se come.</div>';
  if (r.faltaVer) h += '<p class="note" style="margin-top:8px"><b>Para afinar:</b> ' + esc(r.faltaVer) + '</p>';
  if (r.calidad === 'mala') h += '<p class="note">Las fotos no se ven bien: la respuesta es poco fiable.</p>';
  return h + '</div>';
}

/* ---------- este mes ---------- */
function renderMes() {
  const root = $('#v-mes'), m = S.mes, todas = cat.todas(), lista = tmp.delMes(todas, m);
  const pel = lista.filter(r => r.e.clase === 'mortal' || r.e.clase === 'toxica'), resto = lista.filter(r => !pel.includes(r)), sinDatos = todas.filter(e => !tmp.datos(e).hay).length;
  const fila = r => itemEsp(r.e, '<div class="mb">' + tmp.datos(r.e).niv.map((x, i) => '<i class="l' + x.nivel + (i + 1 === m ? ' cur' : '') + '"></i>').join('') + '</div>');
  const sec = (t, n, c) => { const rs = resto.filter(r => r.nivel === n); return rs.length ? '<div class="grp" style="--c:' + c + '">' + t + '<small>' + rs.length + '</small></div>' + '<div class="cg">' + rs.map(fila).join('') + '</div>' : ''; };
  root.innerHTML = '<div class="pad"><div class="mesnav"><button id="m-prev" aria-label="Mes anterior">‹</button><h2>' + tmp.mesNombre(m) + '</h2><button id="m-next" aria-label="Mes siguiente">›</button></div>' +
    '<div class="mes-sum"><div><b>' + lista.length + '</b><span>en temporada</span></div><div><b>' + resto.filter(r => r.nivel === 3).length + '</b><span>en plena temporada</span></div><div class="pel"><b>' + pel.length + '</b><span>peligrosas</span></div></div>' +
    '<div id="mes-mias"></div>' +
    '<p class="note">Qué se ve en la costa cantábrica en este mes, según observaciones verificadas y fuentes citadas en cada ficha. Indica <b>cuándo aparece</b> cada especie, no si se puede comer.</p>' +
    (pel.length ? '<div class="dang" style="margin-top:12px"><h3>Peligrosas que salen ahora</h3><p>Estas pueden confundirse con comestibles. Mira bien la ficha.</p>' + '<div class="cg">' + pel.map(fila).join('') + '</div></div>' : '') +
    sec('En plena temporada', 3, '#e0a458') + sec('Buena época', 2, '#a98433') + sec('Posible', 1, '#7b8683') +
    (!lista.length ? '<div class="empty">Ninguna especie del catálogo tiene datos para este mes.</div>' : '') +
    '<p class="note" style="margin-top:14px">' + sinDatos + ' de ' + todas.length + ' fichas no tienen datos de temporada suficientes y no aparecen aquí. «Posible» = pocos registros. Las barras de cada ficha muestran el año entero.</p></div>';
  db.list('hallazgos').then(hs => { const el = $('#mes-mias', root); if (!el || S.mes !== m) return; const l = hs.filter(h => h.especieId && new Date(h.ts).getMonth() + 1 === m), es = especiesDe(l).filter(Boolean);
    el.innerHTML = es.length ? '<div class="mes-mias"><b>Tú en ' + esc(tmp.MESES[m - 1]) + '</b><span>' + plural(es.length, 'especie', 'especies') + ' que has encontrado en este mes</span><div class="col-row">' + es.slice(0, 10).map(e => '<button class="cmini" data-e="' + e.id + '">' + mini(e) + '</button>').join('') + '</div></div>' : ''; });
  $('#m-prev', root).onclick = () => { S.mes = S.mes === 1 ? 12 : S.mes - 1; renderMes(); };
  $('#m-next', root).onclick = () => { S.mes = S.mes === 12 ? 1 : S.mes + 1; renderMes(); };
  root.onclick = e => { const b = e.target.closest('[data-e]'); if (b) abrirFicha(b.dataset.e); };
}
const COMPROBAR = [
  'He identificado la seta por todos los caracteres (sombrero, himenio, pie, anillo, volva, carne, olor, hábitat), no solo por uno ni por una foto.',
  'Llevé el ejemplar entero, con la base del pie, y la he mirado.',
  'Una persona experta o una sociedad micológica (p. ej. Aranzadi) ha confirmado la identificación, con la seta delante.',
  'El ejemplar no es muy joven, ni está pasado o deteriorado; no lo recogí tras lluvias fuertes o heladas ni cerca de carreteras, vertederos o zonas contaminadas.',
  'La voy a cocinar bien (nunca cruda) y sin alcohol.',
  'Probaré una cantidad pequeña y guardaré un ejemplar crudo por si hay síntomas.'];
function abrirAntesDeComer() {
  openSheet('<h2>Antes de comer</h2><p class="sub" style="font-family:inherit">Si falta cualquiera de estos puntos: no se come.</p>' + COMPROBAR.map(t => '<label class="check"><input type="checkbox"><span>' + esc(t) + '</span></label>').join('') +
    '<p class="warn" style="margin-top:12px">La app nunca certifica que una seta sea comestible. En caso de duda, no se come.</p><div class="row"><button class="btn p" onclick="document.querySelector(\'#sheet\').hidden=true">Cerrar</button></div>');
}

/* ---------- ajustes ---------- */
async function renderAjustes() {
  const root = $('#v-ajustes'), c = syn.cfg(), zonas = (await db.list('zonas')).sort((a, b) => a.nombre.localeCompare(b.nombre));
  if (root.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  const last = syn.lastSync();
  root.innerHTML = '<div class="pad"><div class="card"><h3>Sincronización</h3><p class="sub" style="font-family:inherit;color:var(--mut);margin:4px 0 0">Los datos viven en este móvil y se suben a tu repositorio privado de GitHub.</p>' +
    '<label class="l">Repositorio de datos</label><input type="text" id="a-repo" placeholder="usuario/micologia-datos" autocapitalize="off" autocomplete="off" value="' + esc(c.repo || '') + '">' +
    '<label class="l">Token de GitHub</label><input type="password" id="a-tok" placeholder="' + (c.token ? '•••••• guardado (déjalo vacío para conservarlo)' : 'github_pat_…') + '" autocomplete="off">' +
    '<div class="row"><button class="btn p" id="a-sync">Guardar y sincronizar</button></div><div class="note" id="a-st" style="margin-top:10px">' + (last ? 'Última sincronización: ' + new Date(last).toLocaleString('es-ES') : 'Aún no has sincronizado.') + (db.dirtyCount() ? '<br>Pendiente de subir: ' + db.dirtyCount() : '') + '</div></div>' +
    '<div class="card"><h3>Reconocer con IA</h3><p class="sub" style="font-family:inherit;color:var(--mut);margin:4px 0 0">Clave gratuita de Gemini (aistudio.google.com/apikey). Se guarda solo en este móvil.</p><input type="password" id="a-gk" placeholder="' + (ia.getKey() ? '•••••• guardada' : 'AIza…') + '" autocomplete="off" autocapitalize="off" style="margin-top:8px"><div class="row"><button class="btn p" id="a-gks">Guardar</button>' + (ia.getKey() ? '<button class="btn d" id="a-gkd">Borrar</button>' : '') + '</div><div class="note" id="a-gst" style="margin-top:8px"></div></div>' +
    '<div class="card"><h3>Datos</h3><div class="row"><button class="btn" id="a-exp">Exportar copia (JSON)</button></div></div>' +
    '<div class="card"><h3>Fotos sin conexión</h3><p class="sub" style="font-family:inherit;color:var(--mut);margin:4px 0 0">Guarda las fotos de las fichas en este móvil para verlas en el monte sin cobertura (unos ' + Math.round(cat.todas().reduce((n, e) => n + (e.fotos || []).length, 0) * 0.2 / 5) * 5 + ' MB, estimado).</p><div class="row"><button class="btn" id="a-fotos">Descargar fotos</button></div><div class="note" id="a-fst" style="margin-top:10px">Comprobando…</div></div>' +
    '<div class="card"><h3>Zonas</h3>' + (zonas.length ? zonas.map(z => '<div class="row" style="margin-top:8px"><input type="text" data-z="' + z.id + '" value="' + esc(z.nombre) + '" style="flex:1"><button class="btn d" data-zd="' + z.id + '" style="flex:none">Borrar</button></div>').join('') : '<p style="color:var(--mut);margin:8px 0 0">Las zonas se crean al marcar un hallazgo.</p>') + '</div>' +
    '<div class="card"><h3>Acerca de</h3><p style="margin:6px 0;color:var(--mut);font-size:13.5px">Versión ' + APP_V + '<br>Las coordenadas de tus sitios solo viven en este móvil y en tu repositorio privado. La app nunca certifica que una seta sea comestible.<br>Mapa: imágenes PNOA/Sentinel © IGN España (CC BY 4.0 scne.es) · callejero © OpenStreetMap.</p></div></div>';
  $('#a-sync', root).onclick = async () => {
    const repo = $('#a-repo', root).value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, ''), tok = $('#a-tok', root).value.trim() || c.token, st = $('#a-st', root);
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !tok) { st.textContent = 'Pon el repositorio como usuario/nombre y pega el token.'; return; }
    syn.setCfg({ ...c, repo, token: tok }); await correrSync(m => { st.textContent = m; });
  };
  $('#a-gks', root).onclick = () => { const k = $('#a-gk', root).value, st = $('#a-gst', root); if (!ia.claveValida(k)) { st.textContent = 'La clave de AI Studio empieza por AIza… o AQ. y es larga.'; return; } ia.setKey(k); toast('Clave guardada'); renderAjustes(); };
  const gd = $('#a-gkd', root); if (gd) gd.onclick = () => { ia.setKey(''); toast('Clave borrada'); renderAjustes(); };
  $('#a-exp', root).onclick = async () => { const a = document.createElement('a'); a.href = URL.createObjectURL(await db.exportAll()); a.download = 'micologia-copia-' + hoy() + '.json'; document.body.appendChild(a); a.click(); a.remove(); };
  root.onchange = e => { const z = e.target.dataset.z; if (z && e.target.value.trim()) db.patch('zonas', z, { nombre: e.target.value.trim() }); };
  fotosEstado($('#a-fst', root));
  $('#a-fotos', root).onclick = async ev => { const st = $('#a-fst', root); ev.target.disabled = true; const r = await descargarFotos(m => { st.textContent = m; }); ev.target.disabled = false; st.textContent = r.fail ? 'Listo con ' + r.fail + ' fallos de ' + r.total + '. Vuelve a pulsar para reintentar.' : 'Listo: ' + r.ok + ' fotos guardadas.'; };
  root.onclick = async e => { const b = e.target.closest('[data-zd]'); if (!b) return; if (b.dataset.sure) { await db.remove('zonas', b.dataset.zd); toast('Zona borrada'); } else { b.dataset.sure = 1; b.textContent = '¿Seguro?'; } };
}
function urlsFotos() { const u = []; cat.todas().forEach(e => (e.fotos || []).forEach(f => { u.push(fi.fotoURL(f, 250)); u.push(fi.fotoURL(f, 960)); })); return u; }
async function fotosEstado(el) {
  try { const c = await caches.open('fotos-v1'), n = (await c.keys()).length, t = urlsFotos().length; el.textContent = n >= t ? 'Todas las fotos están guardadas (' + n + ').' : n + ' de ' + t + ' fotos guardadas.'; }
  catch (e) { el.textContent = 'Este navegador no permite guardar fotos sin conexión.'; }
}
async function descargarFotos(setStat) {
  const urls = urlsFotos(), q = [...urls]; let ok = 0, fail = 0;
  const w = async () => { while (q.length) { const u = q.shift(); try { const r = await fetch(u, { mode: 'cors' }); if (r.ok) { await r.blob(); ok++; } else fail++; } catch (e) { fail++; } setStat('Descargando fotos… ' + (ok + fail) + '/' + urls.length); } };
  await Promise.all([w(), w(), w()]); return { ok, fail, total: urls.length };
}
async function correrSync(setStat = () => { }) {
  S.syncErr = false;
  try {
    const r = await syn.sync(t => setStat(t)); const m = (r.up || r.down) ? 'Sincronizado · subido ' + r.up + ' · bajado ' + r.down : 'Todo al día';
    setStat(m); toast(m); return r;
  } catch (e) { S.syncErr = true; const m = syn.mensajeError(e); setStat(m); toast(m, 4200); badge(); }
}
function badge() {
  const b = $('#syncbtn'), n = db.dirtyCount();
  b.innerHTML = ICON_SYNC + (n ? '<span class="nb">' + n + '</span>' : '');
  b.className = 'syncbtn' + (syn.syncing() ? ' run' : '') + (navigator.onLine ? '' : ' off') + (S.syncErr ? ' err' : '');
}

/* ---------- navegación ---------- */
function route() {
  const [v, arg] = (location.hash || '#mapa').slice(1).split('/'), view = VIEWS.includes(v) ? v : 'mapa';
  if (S.mini && view !== 'salida') { S.mini.remove(); S.mini = null; }
  if (view !== S.view || (arg || '') !== S.arg) closeSheet();
  S.view = view; S.arg = arg || ''; document.body.dataset.view = view;
  VIEWS.forEach(x => { $('#v-' + x).hidden = x !== view; });
  $$('.nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === (view === 'salida' ? 'salidas' : view)));
  $('#ttl').textContent = TITULOS[view];
  if (view === 'mapa') { setTimeout(() => S.map.invalidateSize(), 40); refreshPins(); }
  renderView();
}
async function renderView() {
  const a = document.activeElement;
  if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.closest('.view') && S.view !== 'ajustes') return;
  if (S.view === 'salidas') await renderSalidas(); else if (S.view === 'salida') await renderSalida(S.arg); else if (S.view === 'setas') renderSetas(); else if (S.view === 'mes') renderMes(); else if (S.view === 'ajustes') await renderAjustes();
}
async function boot() {
  await db.init(); await cat.load();
  initMap(); badge(); route(); chipSalida();
  /* si había una salida en curso (la app se cerró o se recargó), sigue grabando el recorrido */
  { const a = await activa(); if (a && a.grabar !== false) await trk.start(a.id); }
  addEventListener('hashchange', route);
  document.addEventListener('error', e => { if (e.target.tagName === 'IMG' && e.target.classList.contains('ph')) e.target.classList.add('x'); }, true);
  db.onChange(() => { badge(); refreshPins(); chipSalida(); if (S.view !== 'setas' && S.view !== 'mes' && !trk.guardando()) renderView(); });
  addEventListener('online', badge); addEventListener('offline', badge);
  $('#syncbtn').onclick = () => { const c = syn.cfg(); if (!c.repo || !c.token) { location.hash = '#ajustes'; toast('Configura el repositorio y el token'); } else correrSync(); };
  if (syn.cfg().repo) syn.auto(2500);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => { });
  window.__MI = { db, geo, syn, cat, trk, S, abrirHallazgo, abrirFicha, abrirLibro, abrirIA, ia, abrirSpot, verSpot, editarSpot, verHallazgo, leerGPX };
  document.body.dataset.ready = '1';
}
boot().catch(e => { console.error(e); document.body.insertAdjacentHTML('beforeend', '<div class="warn" style="position:fixed;top:60px;left:12px;right:12px;z-index:9999">No se pudo arrancar la app: ' + esc(e.message || e) + '</div>'); });
