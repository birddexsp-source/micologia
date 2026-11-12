import * as db from './db.js';
import * as geo from './geo.js';
import * as syn from './sync.js';
import * as cat from './catalog.js';
import { createMap, pin, dragPin, IDENT } from './map.js';
import { $, $$, esc, norm, hoy, hhmm, fecha, toast, reducirFoto } from './util.js';

const APP_V = 'micologia-v1';   // = V de sw.js
const S = { view: 'mapa', arg: '', map: null, pins: null, me: null, acc: null, tmp: null, mini: null, centered: false, filtro: { salida: '', especie: '' }, clase: '', q: '', syncErr: false };
const VIEWS = ['mapa', 'salidas', 'salida', 'setas', 'ajustes'];
const TITULOS = { mapa: 'Mapa', salidas: 'Salidas', salida: 'Salida', setas: 'Setas', ajustes: 'Ajustes' };
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
const tag = c => '<span class="tag" style="--c:' + cat.CLASES[c].color + '">' + cat.CLASES[c].label + '</span>';
const identTag = i => '<span class="tag" style="--c:' + (IDENT[i] || IDENT.sin_identificar).color + ';color:#0a0f0e">' + (IDENT[i] || IDENT.sin_identificar).label + '</span>';
const nombreHall = h => { const e = cat.byId(h.especieId); return e ? cat.nombre(e) : (h.especieTxt || 'Sin identificar'); };
async function pickFoto(onId) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment'); inp.id = 'file-foto';
  inp.style.display = 'none'; document.body.appendChild(inp);
  inp.onchange = async () => { const f = inp.files[0]; inp.remove(); if (!f) return; try { const id = await db.putBlob(await reducirFoto(f)); await onId(id); } catch (e) { toast('No se pudo guardar la foto'); } };
  inp.click();
}

/* ---------- selector de especie (catálogo o texto libre) ---------- */
function pickerHTML(st) {
  const e = cat.byId(st.id);
  return '<label class="l">Especie</label><div class="chips"><button class="opt ' + (!st.id && !st.txt ? 'on' : '') + '" id="sp-no">No sé</button></div>' +
    '<input type="search" id="sp-q" placeholder="Buscar en el catálogo o escribir…" autocomplete="off" style="margin-top:8px" value="' + esc(e ? cat.nombre(e) : st.txt) + '"><div id="sp-sugs" class="sugs" hidden></div>' +
    '<div id="sp-sel" style="margin-top:6px">' + (e ? tag(e.clase) : '') + '</div>';
}
function pickerWire(root, st) {
  const q = $('#sp-q', root), sg = $('#sp-sugs', root), sel = $('#sp-sel', root), no = $('#sp-no', root);
  const mark = () => no.classList.toggle('on', !st.id && !st.txt);
  q.oninput = () => {
    st.id = null; st.txt = q.value.trim(); sel.innerHTML = ''; mark();
    const r = st.txt ? cat.buscar(st.txt).slice(0, 5) : [];
    sg.hidden = !r.length; sg.innerHTML = r.map(e => '<button data-id="' + e.id + '"><span class="dot" style="--c:' + cat.CLASES[e.clase].color + '"></span><span>' + esc(cat.nombre(e)) + '</span></button>').join('');
  };
  sg.onclick = ev => { const b = ev.target.closest('button'); if (!b) return; const e = cat.byId(b.dataset.id); st.id = e.id; st.txt = ''; q.value = cat.nombre(e); sel.innerHTML = tag(e.clase); sg.hidden = true; mark(); };
  no.onclick = () => { st.id = null; st.txt = ''; q.value = ''; sel.innerHTML = ''; sg.hidden = true; mark(); };
}

/* ---------- mapa ---------- */
function initMap() {
  S.map = createMap('map'); S.pins = L.layerGroup().addTo(S.map);
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
  geo.start();
}
async function refreshPins() {
  if (!S.map) return; S.pins.clearLayers();
  const [hs, act] = [await db.list('hallazgos'), await activa()], f = S.filtro;
  hs.filter(h => (!f.salida || (f.salida === 'activa' ? act && h.salidaId === act.id : h.salidaId === f.salida)) && (!f.especie || h.especieId === f.especie))
    .forEach(h => pin(h).on('click', () => abrirHallazgo(h.id)).addTo(S.pins));
  $('#filterbtn').classList.toggle('on', !!(f.salida || f.especie));
}
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
  const id = await db.add('salidas', { fecha: hoy(), titulo: '', notas: '', zonaIds: [], fotos: [], estado: 'en_curso', totalTxt: '', zonaMejorId: '', creada: Date.now() });
  toast('Salida empezada'); location.hash = '#salida/' + id;
}
async function renderSalidas() {
  const [ss, hs, act] = [(await db.list('salidas')).sort((a, b) => (b.creada || 0) - (a.creada || 0)), await db.list('hallazgos'), await activa()];
  const n = id => hs.filter(h => h.salidaId === id).length;
  $('#v-salidas').innerHTML = '<div class="pad">' + (act ? '<a class="item" href="#salida/' + act.id + '" style="border-color:#5a4220;background:#1d160b"><div class="t"><b>Salida en curso</b><small>' + esc(fecha(act.fecha)) + ' · ' + n(act.id) + ' hallazgos</small></div><span class="tag" style="--c:#e0a458;color:#1a1206">Abrir</span></a>'
    : '<button class="btn p big" id="s-new">Empezar salida</button>') +
    '<div class="sec">Salidas</div>' + (ss.length ? ss.map(s => '<a class="item" href="#salida/' + s.id + '" style="text-decoration:none"><div class="t"><b>' + esc(fecha(s.fecha)) + (s.titulo ? ' · ' + esc(s.titulo) : '') + '</b><small>' + n(s.id) + ' hallazgos' + (s.totalTxt ? ' · ' + esc(s.totalTxt) : '') + (s.estado === 'en_curso' ? ' · en curso' : '') + '</small></div>›</a>').join('') : '<div class="empty">Aún no hay salidas.<br>Empieza una cuando salgas al monte.</div>') + '</div>';
  const b = $('#s-new'); if (b) b.onclick = empezarSalida;
}
async function renderSalida(id) {
  if (S.mini) { S.mini.remove(); S.mini = null; }
  const s = await db.get('salidas', id), root = $('#v-salida');
  if (!s) { root.innerHTML = '<div class="pad"><a class="back" href="#salidas">‹ Salidas</a><div class="empty">Esta salida no existe.</div></div>'; return; }
  const [hs, zonas] = [(await db.list('hallazgos')).filter(h => h.salidaId === id).sort((a, b) => a.ts - b.ts), await db.list('zonas')];
  const zn = zid => (zonas.find(z => z.id === zid) || {}).nombre || '—';
  const porZona = {}; hs.forEach(h => { if (h.zonaId) porZona[h.zonaId] = (porZona[h.zonaId] || 0) + 1; });
  const auto = mejorZonaId(hs), mejor = s.zonaMejorId || auto, pend = hs.filter(h => h.identificacion !== 'confirmada').length;
  root.innerHTML = '<div class="pad"><a class="back" href="#salidas">‹ Salidas</a>' +
    '<input type="text" id="sd-tit" value="' + esc(s.titulo) + '" placeholder="' + esc(fecha(s.fecha)) + ' · título (opcional)"><div style="margin:6px 2px 0;color:var(--mut);font-size:13px">' + esc(fecha(s.fecha)) + (s.estado === 'en_curso' ? ' · <b style="color:var(--acc)">en curso</b>' : ' · terminada') + '</div>' +
    '<div class="stats"><div><b>' + hs.length + '</b><span>hallazgos</span></div><div><b>' + Object.keys(porZona).length + '</b><span>zonas</span></div><div><b>' + pend + '</b><span>por identificar</span></div></div>' +
    '<div class="smap" id="smap"></div>' +
    '<label class="l">Total recogido</label><input type="text" id="sd-tot" value="' + esc(s.totalTxt) + '" placeholder="p. ej. ≈2 kg">' +
    '<label class="l">Dónde hubo más</label><select id="sd-mej"><option value="">' + (auto ? 'Automático: ' + esc(zn(auto)) : 'Automático') + '</option>' + zonas.filter(z => porZona[z.id] || z.id === s.zonaMejorId).map(z => '<option value="' + z.id + '"' + (s.zonaMejorId === z.id ? ' selected' : '') + '>' + esc(z.nombre) + ' (' + (porZona[z.id] || 0) + ')</option>').join('') + '</select>' +
    '<div class="sec">Fotos de la salida</div><div class="gal" id="sd-gal">' + (s.fotos || []).map(f => '<img data-blob="' + f + '">').join('') + '</div><div class="row"><button class="btn" id="sd-foto">Añadir foto</button></div>' +
    '<div class="sec">Hallazgos' + (mejor ? ' · mejor zona: ' + esc(zn(mejor)) : '') + '</div>' +
    (hs.length ? hs.map(h => '<button class="item" data-h="' + h.id + '"><span class="dot" style="--c:' + (IDENT[h.identificacion] || IDENT.sin_identificar).color + '"></span><div class="t"><b>' + esc(nombreHall(h)) + '</b><small>' + hhmm(h.ts) + (h.zonaId ? ' · ' + esc(zn(h.zonaId)) : '') + (h.cantidad ? ' · ' + esc(h.cantidad) : '') + '</small></div>›</button>').join('') : '<div class="empty">Sin hallazgos todavía.</div>') +
    '<div class="row">' + (s.estado === 'en_curso' ? '<button class="btn p big" id="sd-fin">Terminar salida</button>' : '<button class="btn" id="sd-reab">Reabrir salida</button>') + '<button class="btn d" id="sd-del">Borrar salida</button></div></div>';
  hydrate(root);
  /* minimapa */
  S.mini = createMap('smap', { zoom: 10 }); const ls = [];
  hs.forEach(h => { pin(h, { interactive: false }).addTo(S.mini); ls.push([h.lat, h.lon]); });
  if (ls.length) S.mini.fitBounds(ls, { padding: [30, 30], maxZoom: 17 });
  $('#sd-tit', root).onchange = e => db.patch('salidas', id, { titulo: e.target.value.trim() });
  $('#sd-tot', root).onchange = e => db.patch('salidas', id, { totalTxt: e.target.value.trim() });
  $('#sd-mej', root).onchange = e => db.patch('salidas', id, { zonaMejorId: e.target.value });
  root.onclick = async ev => {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.h) abrirHallazgo(t.dataset.h);
    else if (t.id === 'sd-foto') pickFoto(async fid => { await db.patch('salidas', id, { fotos: [...(s.fotos || []), fid] }); syn.auto(); });
    else if (t.id === 'sd-fin') terminarSalida(s, hs, zonas, porZona, mejor);
    else if (t.id === 'sd-reab') { if (await activa()) toast('Ya hay otra salida en curso'); else { await db.patch('salidas', id, { estado: 'en_curso' }); toast('Salida reabierta'); } }
    else if (t.id === 'sd-del') { if (t.dataset.sure) { for (const h of hs) await db.patch('hallazgos', h.id, { salidaId: null }); await db.remove('salidas', id); toast('Salida borrada (los hallazgos se conservan)'); location.hash = '#salidas'; } else { t.dataset.sure = 1; t.textContent = 'Otra vez para borrar'; } }
  };
}
function terminarSalida(s, hs, zonas, porZona, mejor) {
  const zn = zid => (zonas.find(z => z.id === zid) || {}).nombre || '—';
  const sh = openSheet('<h2>Terminar salida</h2><p class="sub">' + esc(fecha(s.fecha)) + '</p><div class="stats"><div><b>' + hs.length + '</b><span>hallazgos</span></div><div><b>' + Object.keys(porZona).length + '</b><span>zonas</span></div><div><b>' + hs.filter(h => h.recogida).length + '</b><span>recogidos</span></div></div>' +
    (Object.keys(porZona).length ? '<div class="note">' + Object.keys(porZona).map(z => esc(zn(z)) + ': ' + porZona[z]).join(' · ') + (mejor ? '<br><b>Dónde más:</b> ' + esc(zn(mejor)) : '') + '</div>' : '') +
    '<label class="l">Total recogido</label><input type="text" id="tf-tot" value="' + esc(s.totalTxt) + '" placeholder="p. ej. ≈2 kg"><label class="l">Nota</label><textarea id="tf-nota">' + esc(s.notas) + '</textarea>' +
    '<div class="row"><button class="btn" id="tf-x">Seguir</button><button class="btn p" id="tf-ok" style="flex:2">Terminar</button></div>');
  $('#tf-x', sh).onclick = closeSheet;
  $('#tf-ok', sh).onclick = async () => { await db.patch('salidas', s.id, { estado: 'terminada', totalTxt: $('#tf-tot', sh).value.trim(), notas: $('#tf-nota', sh).value.trim(), zonaMejorId: s.zonaMejorId || mejor || '' }); closeSheet(); toast('Salida terminada'); syn.auto(1500); };
}
async function chipSalida() {
  const a = await activa(), c = $('#chip');
  if (!a) { c.hidden = true; return; }
  const n = (await db.list('hallazgos')).filter(h => h.salidaId === a.id).length;
  c.hidden = false; c.textContent = 'En curso · ' + n; c.onclick = () => { location.hash = '#salida/' + a.id; };
}

/* ---------- catálogo ---------- */
function renderSetas() {
  const root = $('#v-setas');
  if (!$('#q', root)) {
    root.innerHTML = '<div class="pad"><div class="warn">' + esc(cat.aviso()) + '</div><input type="search" id="q" placeholder="Buscar seta…" autocomplete="off" style="margin-top:12px"><div class="chips" id="cl" style="margin:10px 0 4px"></div><div id="slist"></div>' +
      '<p class="note" style="margin-top:14px">Catálogo en borrador: ' + cat.todas().length + ' fichas sin contrastar. Las comestibles candidatas figuran como «sin datos» hasta verificarlas con ≥2 fuentes y una persona experta.</p></div>';
    $('#q', root).oninput = e => { S.q = e.target.value; listaSetas(); };
    $('#cl', root).onclick = e => { const b = e.target.closest('button'); if (!b) return; S.clase = b.dataset.c; listaSetas(); };
    $('#slist', root).onclick = e => { const b = e.target.closest('[data-e]'); if (b) abrirFicha(b.dataset.e); };
  }
  listaSetas();
}
function listaSetas() {
  const root = $('#v-setas');
  $('#cl', root).innerHTML = '<button class="opt ' + (!S.clase ? 'on' : '') + '" data-c="">Todas</button>' + Object.entries(cat.CLASES).filter(([k]) => cat.todas().some(e => e.clase === k)).map(([k, v]) => '<button class="opt ' + (S.clase === k ? 'on' : '') + '" data-c="' + k + '">' + v.label + '</button>').join('');
  const r = cat.buscar(S.q, { clase: S.clase });
  $('#slist', root).innerHTML = r.length ? r.map(e => '<button class="item" data-e="' + e.id + '"><span class="dot" style="--c:' + cat.CLASES[e.clase].color + '"></span><div class="t"><b><i>' + esc(e.nombreCientifico) + '</i></b><small>' + esc([...(e.nombresComunes.es || []), ...(e.nombresComunes.eu || [])].join(', ') || e.grupo) + '</small></div>' + tag(e.clase) + '</button>').join('') : '<div class="empty">Nada con ese nombre.</div>';
}
const RASGOS = [['sombrero', 'Sombrero'], ['himenio', 'Himenio'], ['reticulo', 'Retículo'], ['pie', 'Pie'], ['anillo', 'Anillo'], ['volva', 'Volva'], ['carne', 'Carne'], ['olor', 'Olor'], ['esporada', 'Esporada'], ['habitat', 'Hábitat'], ['fenologia', 'Época']];
function abrirFicha(id) {
  const e = cat.byId(id); if (!e) return;
  const ras = RASGOS.filter(([k]) => e[k]);
  const sh = openSheet('<h2><i>' + esc(e.nombreCientifico) + '</i></h2><p class="sub" style="font-family:inherit">' + esc([...(e.nombresComunes.es || []), ...(e.nombresComunes.eu || [])].join(' · ')) + '</p>' +
    '<div class="chips" style="margin-bottom:10px">' + tag(e.clase) + '<span class="tag" style="--c:#3a4743">' + esc(cat.NIVELES[e.nivelVerificacion] || e.nivelVerificacion) + '</span></div>' +
    '<div class="warn">' + esc(cat.aviso()) + '</div>' +
    (e.notaComestibilidad ? '<div class="note" style="margin-top:10px">' + esc(e.notaComestibilidad) + '</div>' : '') +
    (e.sindrome ? '<div class="sec">Si es tóxica</div><dl class="kv"><dt>Síndrome</dt><dd>' + esc(e.sindrome) + '</dd>' + (e.latencia ? '<dt>Aparece a las</dt><dd>' + esc(e.latencia) + '</dd>' : '') + (e.gravedad ? '<dt>Gravedad</dt><dd>' + esc(e.gravedad) + '</dd>' : '') + '</dl><p class="note" style="margin-top:8px">Intoxicación: urgencias ya (112), con restos de la seta y la hora de ingestión. No esperar a que «pase».</p>' : '') +
    '<div class="sec">Rasgos</div>' + (ras.length ? '<dl class="kv">' + ras.map(([k, l]) => '<dt>' + l + '</dt><dd>' + esc(e[k]) + '</dd>').join('') + '</dl>' : '<div class="empty" style="padding:6px 0;text-align:left">Sin datos de rasgos todavía.</div>') +
    ((e.confusiones || []).length ? '<div class="sec">Se confunde con</div>' + e.confusiones.map(c => (c.id ? '<button class="item" data-e="' + c.id + '">' : '<div class="item" style="cursor:default">') + '<div class="t"><b style="white-space:normal">' + esc(c.nombre) + '</b><small style="white-space:normal">' + esc(c.comoDistinguir) + '</small></div>' + (c.id ? '›</button>' : '</div>')).join('') : '') +
    (e.candidataComestible ? '<div class="row"><button class="btn big" id="fi-antes">Antes de comer</button></div>' : '') +
    '<div class="sec">Fuentes</div>' + e.fuentes.map(f => '<div class="note" style="margin-bottom:8px"><b>' + esc(f.nombre) + '</b>' + (f.url ? '<br><a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.url) + '</a>' : '') + (f.nota ? '<br><small style="color:var(--mut)">' + esc(f.nota) + '</small>' : '') + '</div>').join(''));
  sh.addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; if (b.dataset.e) abrirFicha(b.dataset.e); else if (b.id === 'fi-antes') abrirAntesDeComer(); });
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
    '<div class="card"><h3>Datos</h3><div class="row"><button class="btn" id="a-exp">Exportar copia (JSON)</button></div></div>' +
    '<div class="card"><h3>Zonas</h3>' + (zonas.length ? zonas.map(z => '<div class="row" style="margin-top:8px"><input type="text" data-z="' + z.id + '" value="' + esc(z.nombre) + '" style="flex:1"><button class="btn d" data-zd="' + z.id + '" style="flex:none">Borrar</button></div>').join('') : '<p style="color:var(--mut);margin:8px 0 0">Las zonas se crean al marcar un hallazgo.</p>') + '</div>' +
    '<div class="card"><h3>Acerca de</h3><p style="margin:6px 0;color:var(--mut);font-size:13.5px">Versión ' + APP_V + '<br>Las coordenadas de tus sitios solo viven en este móvil y en tu repositorio privado. La app nunca certifica que una seta sea comestible.<br>Mapa: imágenes PNOA/Sentinel © IGN España (CC BY 4.0 scne.es) · callejero © OpenStreetMap.</p></div></div>';
  $('#a-sync', root).onclick = async () => {
    const repo = $('#a-repo', root).value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, ''), tok = $('#a-tok', root).value.trim() || c.token, st = $('#a-st', root);
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !tok) { st.textContent = 'Pon el repositorio como usuario/nombre y pega el token.'; return; }
    syn.setCfg({ ...c, repo, token: tok }); await correrSync(m => { st.textContent = m; });
  };
  $('#a-exp', root).onclick = async () => { const a = document.createElement('a'); a.href = URL.createObjectURL(await db.exportAll()); a.download = 'micologia-copia-' + hoy() + '.json'; document.body.appendChild(a); a.click(); a.remove(); };
  root.onchange = e => { const z = e.target.dataset.z; if (z && e.target.value.trim()) db.patch('zonas', z, { nombre: e.target.value.trim() }); };
  root.onclick = async e => { const b = e.target.closest('[data-zd]'); if (!b) return; if (b.dataset.sure) { await db.remove('zonas', b.dataset.zd); toast('Zona borrada'); } else { b.dataset.sure = 1; b.textContent = '¿Seguro?'; } };
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
  if (S.view === 'salidas') await renderSalidas(); else if (S.view === 'salida') await renderSalida(S.arg); else if (S.view === 'setas') renderSetas(); else if (S.view === 'ajustes') await renderAjustes();
}
async function boot() {
  await db.init(); await cat.load();
  initMap(); badge(); route(); chipSalida();
  addEventListener('hashchange', route);
  db.onChange(() => { badge(); refreshPins(); chipSalida(); if (S.view !== 'setas') renderView(); });
  addEventListener('online', badge); addEventListener('offline', badge);
  $('#syncbtn').onclick = () => { const c = syn.cfg(); if (!c.repo || !c.token) { location.hash = '#ajustes'; toast('Configura el repositorio y el token'); } else correrSync(); };
  if (syn.cfg().repo) syn.auto(2500);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => { });
  window.__MI = { db, geo, syn, cat, S, abrirHallazgo, abrirFicha };
  document.body.dataset.ready = '1';
}
boot().catch(e => { console.error(e); document.body.insertAdjacentHTML('beforeend', '<div class="warn" style="position:fixed;top:60px;left:12px;right:12px;z-index:9999">No se pudo arrancar la app: ' + esc(e.message || e) + '</div>'); });
