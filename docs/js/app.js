import * as db from './db.js';
import * as geo from './geo.js';
import * as syn from './sync.js';
import * as cat from './catalog.js';
import { createMap, pin, dragPin, IDENT } from './map.js';
import { $, $$, esc, norm, hoy, hhmm, fecha, toast, reducirFoto } from './util.js';
import { guiaHTML } from './guia.js';
import * as lib from './libro.js';
import * as tmp from './temporada.js';
import * as fi from './ficha.js';
import * as trk from './track.js';
import * as ia from './ia.js';

const APP_V = 'micologia-v6';   // = V de sw.js
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
  hydrate(s); return s.firstChild;
}
function closeSheet() {
  const s = $('#sheet'); s.hidden = true; s.innerHTML = ''; s.onclick = null;
  if (S.tmp) { S.tmp.remove(); S.tmp = null; }
}
async function hydrate(root) { for (const im of $$('img[data-blob]', root)) { const u = await db.blobURL(im.dataset.blob); if (u) im.src = u; } }
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

/* ---------- selector de especie (catálogo o texto libre) ---------- */
function pickerHTML(st) {
  const e = cat.byId(st.id);
  return '<label class="l">Especie</label><div class="chips"><button class="opt ' + (!st.id && !st.txt ? 'on' : '') + '" id="sp-no">No sé</button></div>' +
    '<input type="search" id="sp-q" placeholder="Buscar en el catálogo o escribir…" autocomplete="off" style="margin-top:8px" value="' + esc(e ? cat.nombre(e) : st.txt) + '"><div id="sp-sugs" class="sugs" hidden></div>' +
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
  S.map = createMap('map'); S.trkL = L.layerGroup().addTo(S.map); S.pins = L.layerGroup().addTo(S.map);
  S.me = L.marker([0, 0], { icon: L.divIcon({ className: 'me', html: '<i></i>', iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false, opacity: 0 }).addTo(S.map);
  S.acc = L.circle([0, 0], { radius: 0, color: '#4c9bff', weight: 1, fillOpacity: .12, interactive: false }).addTo(S.map);
  geo.onFix((f, err) => {
    const g = $('#gps');
    if (f) {
      g.textContent = '±' + f.acc + ' m'; g.className = 'gps ' + (f.acc <= 20 ? 'ok' : '');
      S.me.setLatLng([f.lat, f.lon]).setOpacity(1); S.acc.setLatLng([f.lat, f.lon]).setRadius(f.acc);
      if (!S.centered && S.view === 'mapa') { S.centered = true; S.map.setView([f.lat, f.lon], 17); }
    } else if (err) { g.textContent = geo.msgError(err); g.className = 'gps bad'; }
  });
  $('#locate').onclick = () => { const f = geo.fix(); if (f) S.map.setView([f.lat, f.lon], Math.max(S.map.getZoom(), 17)); else toast('Aún sin GPS'); };
  $('#layerbtn').onclick = () => { const b = S.map.setBase(S.map.getBase() === 'sat' ? 'calle' : 'sat'); toast(b === 'sat' ? 'Satélite' : 'Callejero'); };
  $('#filterbtn').onclick = abrirFiltro;
  $('#fab').onclick = marcar;
  trk.onAdd(() => { if (S.trkId && trk.activo() === S.trkId) pintarTrack(trk.puntos()); });
  geo.start();
}
async function refreshPins() {
  if (!S.map) return; S.pins.clearLayers();
  const [hs, act] = [await db.list('hallazgos'), await activa()], f = S.filtro;
  hs.filter(h => (!f.salida || (f.salida === 'activa' ? act && h.salidaId === act.id : h.salidaId === f.salida)) && (!f.especie || h.especieId === f.especie))
    .forEach(h => pin(h).on('click', () => abrirHallazgo(h.id)).addTo(S.pins));
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
async function marcar() {
  const map = S.map; let pos;
  const f = geo.fix() || await geo.waitFix(2500);
  if (f) pos = { lat: f.lat, lon: f.lon, acc: f.acc };
  else { const c = map.getCenter(); pos = { lat: c.lat, lon: c.lng, acc: null, manual: true }; toast('Sin GPS: arrastra el punto a su sitio', 3800); }
  if (map.getZoom() < 16) map.setView([pos.lat, pos.lon], 17);
  closeSheet(); S.tmp = dragPin()(pos.lat, pos.lon).addTo(map);
  const m = { esp: { id: null, txt: '' }, fotos: [], zona: null, estado: '', nueva: false };
  const [zonas, act] = [await db.list('zonas'), await activa()];
  const posTxt = () => pos.lat.toFixed(5) + ', ' + pos.lon.toFixed(5) + (pos.manual || pos.adj ? ' · ajustado a mano' : pos.acc != null ? ' · ±' + pos.acc + ' m' : '');
  const zonasOrd = () => zonas.slice().sort((a, b) => (act && act.zonaIds.includes(b.id)) - (act && act.zonaIds.includes(a.id)) || a.nombre.localeCompare(b.nombre));
  const zonaHTML = () => '<label class="l">Zona</label><div class="chips" id="mk-zonas">' +
    zonasOrd().map(z => '<button class="opt ' + (m.zona === z.id ? 'on' : '') + '" data-z="' + z.id + '">' + esc(z.nombre) + '</button>').join('') +
    '<button class="opt" id="mk-nz">+ Zona</button></div>' + (m.nueva ? '<div class="row" style="margin-top:8px"><input type="text" id="mk-znom" placeholder="Nombre de la zona" style="flex:1"><button class="btn p" id="mk-zok" style="flex:none">Crear</button></div>' : '');
  const sh = openSheet('<h2>Nuevo hallazgo</h2><p class="sub" id="mk-pos">' + posTxt() + '</p>' + pickerHTML(m.esp) +
    '<div id="mk-zona">' + zonaHTML() + '</div><label class="l">Foto</label><div class="thumbs"><button class="btn" id="mk-foto">Hacer foto</button><span id="mk-th" class="thumbs" style="margin:0"></span></div>' +
    '<label class="l">Cantidad</label><input type="text" id="mk-cant" placeholder="p. ej. 3 · ≈200 g">' +
    '<label class="l">Estado</label><div class="seg" id="mk-est">' + ESTADOS.map(e => '<button data-e="' + e[0] + '">' + e[1] + '</button>').join('') + '</div>' +
    '<label class="l">Nota</label><input type="text" id="mk-nota" placeholder="Nota corta"><div class="row"><button class="btn" id="mk-x">Cancelar</button><button class="btn p" id="mk-ok" style="flex:2">Guardar</button></div>', { dim: false });
  pickerWire(sh, m.esp);
  setTimeout(() => map.panBy([0, Math.round(sh.offsetHeight / 2)], { animate: false }), 60);
  S.tmp.on('dragend', () => { const p = S.tmp.getLatLng(); pos.lat = p.lat; pos.lon = p.lng; pos.adj = true; $('#mk-pos', sh).textContent = posTxt(); });
  const rezona = () => { $('#mk-zona', sh).innerHTML = zonaHTML(); };
  sh.addEventListener('click', async ev => {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.z) { m.zona = m.zona === t.dataset.z ? null : t.dataset.z; rezona(); }
    else if (t.id === 'mk-nz') { m.nueva = true; rezona(); $('#mk-znom', sh).focus(); }
    else if (t.id === 'mk-zok') {
      const n = $('#mk-znom', sh).value.trim(); if (!n) return;
      const id = await db.add('zonas', { nombre: n, lat: pos.lat, lon: pos.lon, notas: '' });
      zonas.push({ id, nombre: n, lat: pos.lat, lon: pos.lon }); m.zona = id; m.nueva = false; rezona();
    }
    else if (t.dataset.e) { m.estado = m.estado === t.dataset.e ? '' : t.dataset.e; $$('#mk-est button', sh).forEach(b => b.classList.toggle('on', b.dataset.e === m.estado)); }
    else if (t.id === 'mk-foto') pickFoto(id => { m.fotos.push(id); const im = document.createElement('img'); im.dataset.blob = id; $('#mk-th', sh).appendChild(im); hydrate($('#mk-th', sh)); });
    else if (t.id === 'mk-x') closeSheet();
    else if (t.id === 'mk-ok') {
      t.disabled = true;
      try {
        const a = await activa(), q = $('#sp-q', sh).value.trim();
        const h = { salidaId: a ? a.id : null, zonaId: m.zona, lat: pos.lat, lon: pos.lon, precisionM: pos.acc, ts: Date.now(), especieId: m.esp.id, especieTxt: m.esp.id ? '' : q,
          cantidad: $('#mk-cant', sh).value.trim(), estadoSeta: m.estado, sustrato: '', notas: $('#mk-nota', sh).value.trim(), fotos: m.fotos,
          identificacion: m.esp.id ? 'provisional' : 'sin_identificar', confirmadoPor: '', recogida: false, ajustadoAMano: !!(pos.adj || pos.manual) };
        await db.add('hallazgos', h);
        if (a && m.zona && !a.zonaIds.includes(m.zona)) await db.patch('salidas', a.id, { zonaIds: [...a.zonaIds, m.zona] });
        closeSheet(); toast(a ? 'Hallazgo guardado en la salida' : 'Hallazgo guardado (sin salida en curso)'); syn.auto();
      } catch (e) { t.disabled = false; toast('No se pudo guardar: ' + (e.message || e)); }
    }
  });
}

/* ---------- hallazgo: ver / editar ---------- */
async function abrirHallazgo(id) {
  const h = await db.get('hallazgos', id); if (!h) return;
  const st = { id: h.especieId, txt: h.especieTxt || '' }, e = cat.byId(h.especieId);
  let ident = h.identificacion, estado = h.estadoSeta, recogida = h.recogida, fotos = [...(h.fotos || [])];
  const zona = h.zonaId ? await db.get('zonas', h.zonaId) : null;
  const sh = openSheet('<h2>' + esc(nombreHall(h)) + '</h2><p class="sub">' + hhmm(h.ts) + ' · ' + new Date(h.ts).toLocaleDateString('es-ES') + (h.precisionM != null ? ' · ±' + h.precisionM + ' m' : '') + (zona ? ' · ' + esc(zona.nombre) : '') + '</p>' +
    pickerHTML(st) + '<div id="hd-aviso">' + avisoComer(e) + '</div>' +
    '<label class="l">Identificación</label><div class="seg" id="hd-id">' + Object.entries(IDENT).map(([k, v]) => '<button data-i="' + k + '" class="' + (ident === k ? 'on' : '') + '">' + v.label.replace(' por experto', '') + '</button>').join('') + '</div>' +
    '<div id="hd-conf" ' + (ident === 'confirmada' ? '' : 'hidden') + '><label class="l">Confirmada por (persona o sociedad)</label><input type="text" id="hd-por" value="' + esc(h.confirmadoPor) + '" placeholder="p. ej. Aranzadi"></div>' +
    '<label class="l">Cantidad</label><input type="text" id="hd-cant" value="' + esc(h.cantidad) + '">' +
    '<label class="l">Estado</label><div class="seg" id="hd-est">' + ESTADOS.map(x => '<button data-e="' + x[0] + '" class="' + (estado === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>' +
    '<label class="l">Sustrato / árbol</label><input type="text" id="hd-sus" value="' + esc(h.sustrato) + '" placeholder="p. ej. haya, pino, pradera">' +
    '<label class="l">Nota</label><textarea id="hd-nota">' + esc(h.notas) + '</textarea>' +
    '<label class="l">Fotos</label><div class="thumbs" id="hd-th">' + fotos.map(f => '<img data-blob="' + f + '">').join('') + '</div><div class="row"><button class="btn" id="hd-foto">Añadir foto</button></div>' +
    '<div class="row"><label class="check" style="border:0;padding:0;flex:1"><input type="checkbox" id="hd-rec" ' + (recogida ? 'checked' : '') + '> La he recogido</label></div>' +
    '<div class="row"><button class="btn d" id="hd-del">Borrar</button><button class="btn" id="hd-mov">Mover punto</button><button class="btn p" id="hd-ok">Guardar</button></div>');
  pickerWire(sh, st);
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
        cantidad: $('#hd-cant', sh).value.trim(), estadoSeta: estado, sustrato: $('#hd-sus', sh).value.trim(), notas: $('#hd-nota', sh).value.trim(), fotos, recogida: $('#hd-rec', sh).checked });
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
  const id = await db.add('salidas', { fecha: hoy(), titulo: '', notas: '', zonaIds: [], fotos: [], fotosCosecha: [], track: [], grabar: true, estado: 'en_curso', totalTxt: '', zonaMejorId: '', creada: Date.now(), fin: null });
  await trk.start(id); toast('Salida empezada · grabando el recorrido'); location.hash = '#salida/' + id;
}
/* Duración de la salida: desde que se empieza hasta que se termina (o hasta ahora si sigue en curso) */
const durSeg = s => !s.creada ? 0 : Math.max(0, Math.round(((s.estado === 'en_curso' ? Date.now() : s.fin) || s.creada) - s.creada) / 1000);
const kmTxt = s => { const m = trk.metros(s.track); return m > 0 ? trk.fmtKm(m) : '—'; };
const durTxt = s => { const d = durSeg(s); return d >= 60 ? trk.fmtDur(d) : '—'; };
async function renderSalidas() {
  const [ss, hs, act] = [(await db.list('salidas')).sort((a, b) => (b.creada || 0) - (a.creada || 0)), await db.list('hallazgos'), await activa()];
  const n = id => hs.filter(h => h.salidaId === id).length;
  $('#v-salidas').innerHTML = '<div class="pad">' + (act ? '<a class="item" href="#salida/' + act.id + '" style="border-color:#5a4220;background:#1d160b"><div class="t"><b>Salida en curso</b><small>' + esc(fecha(act.fecha)) + ' · ' + n(act.id) + ' hallazgos</small></div><span class="tag" style="--c:#e0a458;color:#1a1206">Abrir</span></a>'
    : '<button class="btn p big" id="s-new">Empezar salida</button>') +
    '<div class="sec">Salidas</div>' + (ss.length ? ss.map(s => '<a class="item" href="#salida/' + s.id + '" style="text-decoration:none"><div class="t"><b>' + esc(fecha(s.fecha)) + (s.titulo ? ' · ' + esc(s.titulo) : '') + '</b><small>' + n(s.id) + ' hallazgos' + (s.totalTxt ? ' · ' + esc(s.totalTxt) : '') + (s.estado === 'en_curso' ? ' · en curso' : '') + '</small></div>›</a>').join('') : '<div class="empty">Aún no hay salidas.<br>Empieza una cuando salgas al monte.</div>') + '</div>';
  const b = $('#s-new'); if (b) b.onclick = empezarSalida;
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
  const auto = mejorZonaId(hs), mejor = s.zonaMejorId || auto, pend = hs.filter(h => h.identificacion !== 'confirmada').length;
  const curso = s.estado === 'en_curso', graba = curso && s.grabar !== false, cos = s.fotosCosecha || [];
  const live = () => trk.activo() === id ? { ...s, track: trk.puntos() } : s;
  root.innerHTML = '<div class="pad"><a class="back" href="#salidas">‹ Salidas</a>' +
    '<input type="text" id="sd-tit" value="' + esc(s.titulo) + '" placeholder="' + esc(fecha(s.fecha)) + ' · título (opcional)"><div style="margin:6px 2px 0;color:var(--mut);font-size:13px">' + esc(fecha(s.fecha)) + (curso ? ' · <b style="color:var(--acc)">en curso</b>' : ' · terminada') + '</div>' +
    '<div class="stats"><div><b>' + hs.length + '</b><span>hallazgos</span></div><div><b>' + Object.keys(porZona).length + '</b><span>zonas</span></div><div><b>' + pend + '</b><span>por identificar</span></div></div>' +
    '<div class="stats" id="sd-st2"><div><b id="sd-km">' + kmTxt(live()) + '</b><span>recorrido</span></div><div><b id="sd-dur">' + durTxt(s) + '</b><span>duración</span></div><div><b>' + cos.length + '</b><span>fotos recogidas</span></div></div>' +
    '<div class="smap" id="smap"></div>' +
    (curso ? '<div class="rec ' + (graba ? 'on' : '') + '"><span class="rdot"></span><div class="t"><b>' + (graba ? 'Grabando el recorrido' : 'Recorrido en pausa') + '</b><small>Mantén la app abierta: si el móvil bloquea la pantalla puede dejar de grabar.</small></div><button class="btn" id="sd-pau">' + (graba ? 'Pausar' : 'Reanudar') + '</button></div>' +
      (trk.pantallaSoportada() ? '<div class="rec"><div class="t"><b>Pantalla encendida</b><small>Evita que se apague mientras andas. Gasta más batería.</small></div><button class="btn' + (trk.pantallaOn() ? ' p' : '') + '" id="sd-wake">' + (trk.pantallaOn() ? 'Activada' : 'Activar') + '</button></div>' : '') : '') +
    '<label class="l">Total recogido</label><input type="text" id="sd-tot" value="' + esc(s.totalTxt) + '" placeholder="p. ej. ≈2 kg">' +
    '<label class="l">Dónde hubo más</label><select id="sd-mej"><option value="">' + (auto ? 'Automático: ' + esc(zn(auto)) : 'Automático') + '</option>' + zonas.filter(z => porZona[z.id] || z.id === s.zonaMejorId).map(z => '<option value="' + z.id + '"' + (s.zonaMejorId === z.id ? ' selected' : '') + '>' + esc(z.nombre) + ' (' + (porZona[z.id] || 0) + ')</option>').join('') + '</select>' +
    '<div class="sec">Lo que me llevé</div><div class="gal" id="sd-cos">' + (cos.length ? galHTML(cos, 'fotosCosecha') : '<div class="empty" style="padding:6px 0;text-align:left">Saca una foto a todo lo que recojas: queda como registro de la salida.</div>') + '</div><div class="row"><button class="btn" id="sd-cos-add">Añadir foto de lo recogido</button></div>' +
    '<div class="sec">Fotos de la salida</div><div class="gal" id="sd-gal">' + galHTML(s.fotos || [], 'fotos') + '</div><div class="row"><button class="btn" id="sd-foto">Añadir foto</button></div>' +
    '<div class="sec">Hallazgos' + (mejor ? ' · mejor zona: ' + esc(zn(mejor)) : '') + '</div>' +
    (hs.length ? hs.map(h => { const e = cat.byId(h.especieId); return '<button class="item" data-h="' + h.id + '">' + (e ? fi.avatar(e) : '<span class="dot" style="--c:' + (IDENT[h.identificacion] || IDENT.sin_identificar).color + '"></span>') + '<div class="t"><b>' + esc(nombreHall(h)) + '</b><small>' + hhmm(h.ts) + (h.zonaId ? ' · ' + esc(zn(h.zonaId)) : '') + (h.cantidad ? ' · ' + esc(h.cantidad) : '') + ' · ' + (IDENT[h.identificacion] || IDENT.sin_identificar).label + '</small></div>›</button>'; }).join('') : '<div class="empty">Sin hallazgos todavía.</div>') +
    (hs.length || (s.track || []).length ? '<div class="row"><button class="btn" id="sd-gpx">Exportar recorrido (GPX)</button></div>' : '') +
    '<div class="row">' + (curso ? '<button class="btn p big" id="sd-fin">Terminar salida</button>' : '<button class="btn" id="sd-reab">Reabrir salida</button>') + '<button class="btn d" id="sd-del">Borrar salida</button></div></div>';
  hydrate(root);
  /* minimapa: recorrido + hallazgos */
  S.mini = createMap('smap', { zoom: 10 }); const ls = [], capa = L.layerGroup().addTo(S.mini);
  const pintar = () => { capa.clearLayers(); trazo(live().track).addTo(capa); };
  pintar(); trk.lineas(live().track).forEach(l => l.forEach(p => ls.push([p[0], p[1]])));
  hs.forEach(h => { pin(h, { interactive: false }).addTo(S.mini); ls.push([h.lat, h.lon]); });
  if (ls.length) S.mini.fitBounds(ls, { padding: [30, 30], maxZoom: 17, animate: false });
  if (trk.activo() === id) S.unlive = trk.onAdd(() => { if (S.view !== 'salida' || S.arg !== id || !S.mini) return; pintar(); const k = $('#sd-km'); if (k) k.textContent = kmTxt(live()); });
  if (curso) S.tick = setInterval(() => { const d = $('#sd-dur'); if (S.view === 'salida' && S.arg === id && d) d.textContent = durTxt(s); }, 30000);
  $('#sd-tit', root).onchange = e => db.patch('salidas', id, { titulo: e.target.value.trim() });
  $('#sd-tot', root).onchange = e => db.patch('salidas', id, { totalTxt: e.target.value.trim() });
  $('#sd-mej', root).onchange = e => db.patch('salidas', id, { zonaMejorId: e.target.value });
  root.onclick = async ev => {
    const im = ev.target.closest('img[data-blob]'); if (im && im.dataset.k) { verFoto(id, im.dataset.k, im.dataset.blob); return; }
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.h) abrirHallazgo(t.dataset.h);
    else if (t.id === 'sd-foto') pickFoto(fid => addFoto(id, 'fotos', fid));
    else if (t.id === 'sd-cos-add') pickFoto(fid => addFoto(id, 'fotosCosecha', fid));
    else if (t.id === 'sd-pau') { if (graba) { await trk.stop(); await db.patch('salidas', id, { grabar: false }); toast('Recorrido en pausa'); } else { await trk.start(id, true); await db.patch('salidas', id, { grabar: true }); toast('Grabando otra vez'); } }
    else if (t.id === 'sd-wake') { const on = !trk.pantallaOn(); await trk.pantalla(on); t.textContent = on ? 'Activada' : 'Activar'; t.classList.toggle('p', on); toast(on ? 'La pantalla no se apagará' : 'La pantalla puede apagarse'); }
    else if (t.id === 'sd-gpx') { const cur = await db.get('salidas', id); bajarArchivo('salida-' + s.fecha + '.gpx', trk.gpx({ ...cur, track: trk.activo() === id ? trk.puntos() : cur.track }, hs, nombreHall), 'application/gpx+xml'); toast('GPX guardado en descargas'); }
    else if (t.id === 'sd-fin') terminarSalida(s, hs, zonas, porZona, mejor);
    else if (t.id === 'sd-reab') { if (await activa()) toast('Ya hay otra salida en curso'); else { await trk.start(id, true); await db.patch('salidas', id, { estado: 'en_curso', fin: null, grabar: true }); toast('Salida reabierta'); } }
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
function renderSetas() {
  const root = $('#v-setas');
  if (!$('#q', root)) {
    root.innerHTML = '<div class="pad"><div class="learn"><button class="guide-card" id="gu-open">' + ICO_SETA + '<div><b>Partes de una seta</b><small>Esquema con nombres y colores</small></div></button><button class="guide-card book" id="li-open"><span class="ic">' + lib.CAPS[0].ico + '</span><div><b>El libro para empezar</b><small>Equipo, cortar o arrancar, mitos, intoxicación</small></div></button><button class="guide-card ia" id="ia-open"><span class="ic">✨</span><div><b>Reconocer con IA</b><small>Haz 1-3 fotos y te digo a qué se parece de tu colección</small></div></button></div>' +
      '<div class="warn" style="margin-top:10px">' + esc(cat.aviso()) + '</div><input type="search" id="q" placeholder="Buscar seta…" autocomplete="off" style="margin-top:12px"><div class="chips" id="cl" style="margin:10px 0 0"></div><div id="slist"></div>' +
      '<p class="note" style="margin-top:14px">Catálogo en borrador: ' + cat.todas().length + ' fichas sin revisar por una persona experta. Las comestibles llevan «según fuentes» porque lo dicen Wikipedia y guías divulgativas, no una persona experta: siguen pendientes de revisión. Fotos de Wikimedia Commons con su autoría y licencia en cada ficha.</p></div>';
    $('#q', root).oninput = e => { S.q = e.target.value; listaSetas(); };
    root.onclick = e => {
      if (e.target.closest('#gu-open')) return abrirGuia('');
      if (e.target.closest('#li-open')) return abrirLibro('');
      if (e.target.closest('#ia-open')) return abrirIA();
      const c = e.target.closest('#cl button'); if (c) { S.clase = c.dataset.c; return listaSetas(); }
      const b = e.target.closest('[data-e]'); if (b) abrirFicha(b.dataset.e);
    };
  }
  listaSetas();
}
const itemEsp = (e, extra = '') => '<button class="item sp" data-e="' + e.id + '" style="--c:' + cat.CLASES[cat.vista(e)].color + '">' + fi.avatar(e) + '<div class="t"><b><i>' + esc(e.nombreCientifico.split(' (')[0]) + '</i></b><small>' + esc(fi.nombres(e) || e.grupo) + '</small>' + extra + '</div>' + fi.tagEsp(e) + '</button>';
function listaSetas() {
  const root = $('#v-setas');
  $('#cl', root).innerHTML = '<button class="opt ' + (!S.clase ? 'on' : '') + '" data-c="">Todas</button>' + Object.entries(cat.CLASES).filter(([k]) => cat.todas().some(e => cat.vista(e) === k)).map(([k, v]) => '<button class="opt ' + (S.clase === k ? 'on' : '') + '" data-c="' + k + '">' + v.label + '</button>').join('');
  const r = cat.buscar(S.q, { clase: S.clase }); let h = '', cur = '';
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
  const sec = (t, n, c) => { const rs = resto.filter(r => r.nivel === n); return rs.length ? '<div class="grp" style="--c:' + c + '">' + t + '<small>' + rs.length + '</small></div>' + rs.map(fila).join('') : ''; };
  root.innerHTML = '<div class="pad"><div class="mesnav"><button id="m-prev" aria-label="Mes anterior">‹</button><h2>' + tmp.mesNombre(m) + '</h2><button id="m-next" aria-label="Mes siguiente">›</button></div>' +
    '<p class="note">Qué se ve en la costa cantábrica en este mes, según observaciones verificadas y fuentes citadas en cada ficha. Indica <b>cuándo aparece</b> cada especie, no si se puede comer.</p>' +
    (pel.length ? '<div class="dang" style="margin-top:12px"><h3>Peligrosas que salen ahora</h3><p>Estas pueden confundirse con comestibles. Mira bien la ficha.</p>' + pel.map(fila).join('') + '</div>' : '') +
    sec('En plena temporada', 3, '#e0a458') + sec('Buena época', 2, '#a98433') + sec('Posible', 1, '#7b8683') +
    (!lista.length ? '<div class="empty">Ninguna especie del catálogo tiene datos para este mes.</div>' : '') +
    '<p class="note" style="margin-top:14px">' + sinDatos + ' de ' + todas.length + ' fichas no tienen datos de temporada suficientes y no aparecen aquí. «Posible» = pocos registros. Las barras de cada ficha muestran el año entero.</p></div>';
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
  S.view = view; S.arg = arg || '';
  VIEWS.forEach(x => { $('#v-' + x).hidden = x !== view; });
  $$('.nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === (view === 'salida' ? 'salidas' : view)));
  $('#ttl').textContent = TITULOS[view];
  if (S.tmp && view !== 'mapa') closeSheet();
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
  window.__MI = { db, geo, syn, cat, trk, S, abrirHallazgo, abrirFicha, abrirLibro, abrirIA, ia };
  document.body.dataset.ready = '1';
}
boot().catch(e => { console.error(e); document.body.insertAdjacentHTML('beforeend', '<div class="warn" style="position:fixed;top:60px;left:12px;right:12px;z-index:9999">No se pudo arrancar la app: ' + esc(e.message || e) + '</div>'); });
