import * as db from './db.js';
import * as geo from './geo.js';
import * as syn from './sync.js';
import * as cat from './catalog.js';
import { createMap, pin, spotPin, dragPin, IDENT, recomendado } from './map.js';
import { I } from './iconos.js';
import { $, $$, esc, norm, hoy, hhmm, fecha, toast, reducirFoto } from './util.js';
import { guiaHTML } from './guia.js';
import * as lib from './libro.js';
import * as tmp from './temporada.js';
import * as fi from './ficha.js';
import * as trk from './track.js';
import * as ia from './ia.js';
import * as au from './audio.js';
import * as off from './offline.js';
import { renderPlan } from './plan.js';
import * as lug from './lugar.js';
import * as bos from './bosques.js';
import * as cmpx from './comparar.js';
import * as zon from './zona.js';
import * as tr from './tramos.js';

const APP_V = 'micologia-v59';   // = V de sw.js
const S = { view: 'mapa', arg: '', map: null, pins: null, me: null, acc: null, tmp: null, mini: null, centered: false, filtro: { salida: '', especie: '' }, clase: '', q: '', syncErr: false, mes: new Date().getMonth() + 1 };
const VIEWS = ['mapa', 'salidas', 'salida', 'setas', 'mes', 'plan', 'ajustes'];
const TITULOS = { mapa: 'Mapa', salidas: 'Salidas', salida: 'Salida', setas: 'Setas', mes: 'Este mes', plan: 'Plan de salida', ajustes: 'Ajustes' };
const ICON_SYNC = '<svg viewBox="0 0 24 24"><path d="M7 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 9.5a4.2 4.2 0 0 1 .5 8.5"/><path d="M12 12v8m0-8l-3 3m3-3l3 3"/></svg>';
const ESTADOS = [['joven', 'Joven'], ['madura', 'Madura'], ['pasada', 'Pasada']];

/* ---------- utilidades de interfaz ---------- */
function openSheet(html, { dim = true } = {}) {
  const lg = $('#mleg'); if (lg && !lg.hidden) { lg.hidden = true; $('#legbtn').classList.remove('on'); }
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
function closeSheet() { S.ftBack = null;
  const s = $('#sheet'); s.hidden = true; s.innerHTML = ''; s.onclick = null;
  if (S.rec) { S.rec.cancel(); S.rec = null; clearInterval(S.recT); }
  if (S.tmp) { S.tmp.remove(); S.tmp = null; }
  marcarSel(null);
  if (S.spTrk) { S.spTrk.remove(); S.spTrk = null; }
  if (S.bqSel) { S.bqSel.remove(); S.bqSel = null; }
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
  S.map = createMap('map'); S.map.on('moveend', () => { S.lastCenter = S.map.getCenter(); }); S.trkL = L.layerGroup().addTo(S.map); S.spotsL = L.layerGroup().addTo(S.map); S.pins = L.layerGroup().addTo(S.map);
  S.me = L.marker([0, 0], { icon: L.divIcon({ className: 'me', html: '<i></i>', iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false, opacity: 0, zIndexOffset: 900 }).addTo(S.map);
  S.acc = L.circle([0, 0], { radius: 0, color: '#4c9bff', weight: 1, fillOpacity: .1, interactive: false }).addTo(S.map);
  $('#v-mapa').insertAdjacentHTML('beforeend', '<div class="mhint" id="mhint" hidden>' + I.flag + '<div><b>Tu mapa está vacío</b><small>Crea tu primer spot con la bandera de la derecha, o pulsa «Marcar aquí» cuando encuentres una seta.</small></div></div>');
  $('#locate').innerHTML = I.locate; $('#layerbtn').innerHTML = I.layers; $('#spotbtn').innerHTML = I.flag; $('#filterbtn').innerHTML = I.filter; $('#legbtn').innerHTML = I.info; $('#bosqbtn').innerHTML = I.arbol; $('#fab .fi').innerHTML = I.plus;
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
  $('#bosqbtn').onclick = abrirBosques;
  $('#filterbtn').onclick = abrirFiltro;
  /* leyenda: qué significa cada marca del mapa */
  $('#legbtn').onclick = () => { const l = $('#mleg'), ver = l.hidden; if (ver) l.innerHTML = leyendaMapa(); l.hidden = !ver; $('#legbtn').classList.toggle('on', ver); };
  $('#mleg').onclick = () => { $('#mleg').hidden = true; $('#legbtn').classList.remove('on'); };
  $('#fab').onclick = () => marcar();
  $('#spotbtn').onclick = () => editarSpot();
  /* tocar el mapa fuera de un marcador cierra el resumen abierto */
  S.map.on('click', ev => {
    /* con la capa de bosques puesta, tocar una mancha dice qué árbol es */
    if (S.bosq && !S.tmp) { const r = bos.en(ev.latlng.lat, ev.latlng.lng); if (r) { abrirRodal(r, ev.latlng.lat, ev.latlng.lng); return; } }
    const s = $('#sheet'); if (!S.tmp && !s.hidden && !s.classList.contains('dim')) closeSheet(); });
  /* filtros rápidos: tocar uno enseña solo eso; tocarlo otra vez vuelve a enseñarlo todo */
  $('#mchips').onclick = e => { const b = e.target.closest('[data-capa]'); if (!b) return; S.capa = S.capa === b.dataset.capa ? 'todo' : b.dataset.capa; $$('#mchips button').forEach(x => x.classList.toggle('on', x.dataset.capa === S.capa)); refreshPins(); };
  trk.onAdd(() => { if (S.trkId && trk.activo() === S.trkId) pintarTrack(trk.puntos()); });
  geo.start();
  /* sin GPS todavía (en casa, en interior): enseña tus spots en vez de un mapa de Bizkaia vacío */
  setTimeout(async () => { if (S.centered || geo.fix()) return; const zs = (await db.list('zonas')).filter(z => z.lat != null); if (zs.length && !S.centered) S.map.fitBounds(zs.map(z => [z.lat, z.lon]), { padding: [70, 70], maxZoom: 16, animate: false }); }, 1800);
}
function abrirCapas() {
  const b = S.map.getBase();
  const sh = openSheet('<h2>Tipo de mapa</h2><div class="capas">' + [['sat', 'Satélite', 'Foto aérea del IGN: se ven los bosques y los claros'], ['calle', 'Mapa', 'Pistas, caminos y pueblos (OpenStreetMap)']].map(([k, t, d]) =>
    '<button class="capa ' + k + (b === k ? ' on' : '') + '" data-base="' + k + '"><span class="pv"></span><b>' + t + '</b><small>' + d + '</small></button>').join('') + '</div><button class="btn" id="capa-off" style="width:100%;margin-top:12px">Guardar este mapa sin conexión…</button>');
  sh.onclick = e => {
    if (e.target.closest('#capa-off')) { S.lastCenter = S.map.getCenter(); (OFF.sel = OFF.sel || new Set(off.PRESETS.map(p => p.clave))).add('centro'); closeSheet(); location.hash = '#ajustes'; return; }
    const x = e.target.closest('[data-base]'); if (!x) return; S.map.setBase(x.dataset.base); closeSheet(); };
}
/* ---------- analizador de bosques (inventario forestal oficial, no a ojo) ---------- */
async function capaBosques(on) {
  if (!on) { if (S.bosq) { S.bosq.remove(); S.bosq = null; } $('#bosqbtn').classList.remove('on'); return true; }
  if (!S.bosq) {
    if (!bos.listo()) toast('Cargando el mapa de bosques…');
    if (!(await bos.cargar())) { toast('No se pudo cargar el mapa de bosques'); return false; }
    S.bosq = bos.capa(L).addTo(S.map);
  }
  $('#bosqbtn').classList.add('on'); return true;
}
const repartoHTML = l => { const t = l.reduce((a, c) => a + c.ha, 0) || 1;
  return '<div class="bq-bar">' + l.map(c => '<i style="--c:' + c.c + ';flex:' + c.ha.toFixed(1) + '"></i>').join('') + '</div><div class="bq-ley">' +
    l.map(c => '<span style="--c:' + c.c + '"><i></i>' + esc(c.n) + ' <b>' + Math.round(c.ha / t * 100) + '%</b></span>').join('') + '</div>'; };
const tagBosque = r => '<span class="tag" style="--c:' + r.c.c + '">' + esc(r.c.n) + '</span>';
async function abrirBosques() {
  if (S.bosq && $('#sheet').hidden === false && $('#bq-h')) { closeSheet(); return; }
  if (!(await capaBosques(true))) return;
  const D = bos.datos(), b = S.map.getBounds(), yo = geo.fix(), ref = yo || { lat: S.map.getCenter().lat, lon: S.map.getCenter().lng };
  const rep = bos.reparto([b.getSouth(), b.getNorth(), b.getWest(), b.getEast()]);
  const zs = (await db.list('zonas')).filter(z => z.lat != null), spR = zs.map(z => ({ z, r: bos.cerca(z.lat, z.lon) })).filter(x => x.r);
  const malos = spR.filter(x => x.r.c.k === 'euca'), buenos = spR.filter(x => x.r.s >= 60);
  const cal = D.calientes.map(z => ({ ...z, d: distM(ref, z), nom: lug.nombreSpot(z.lat, z.lon) || 'Zona caliente' })).sort((a, c) => a.d - c.d);
  const filaC = (z, i) => '<button class="item bq-z" data-cz="' + i + '"><span class="bq-n" style="--c:#2f9e44">' + z.s + '</span><div class="t"><b>' + esc(z.nom) + '</b><small>' +
    esc(z.especies.slice(0, 2).join(' + ')) + ' · ' + z.ha + ' ha de buen bosque · ' + esc((bos.ESTADOS_TXT[D.estados[z.e]] || '')) + '</small></div><em class="bq-d">' + kmFmt(z.d) + '</em></button>';
  const filaS = x => '<button class="item bq-s" data-spot="' + x.z.id + '"><span class="bq-n" style="--c:' + x.r.c.c + '">' + x.r.s + '</span><div class="t"><b>' + esc(x.z.nombre) + '</b><small>' + esc(x.r.c.n) + ' · ' + esc(x.r.sp.map(q => q.n).slice(0, 2).join(' + ')) + '</small></div></button>';
  const sh = openSheet('<div class="sv-h" id="bq-h"><div class="sv-t"><h2>Analizador de bosques</h2><div class="meta"><span>Qué árbol hay en cada mancha · inventario oficial ' + D.ano + '</span></div></div><button class="icb" id="sv-x" aria-label="Cerrar">' + I.close + '</button></div>' +
    (rep.length ? '<div class="sec">En lo que ves del mapa</div>' + repartoHTML(rep) : '<p class="mut sm">En esta parte del mapa no hay bosques del inventario (cubre de Bakio y Mungia a Gernika y Ea).</p>') +
    '<p class="mut sm">Toca cualquier mancha del mapa para ver qué árboles tiene y qué setas de tu guía viven ahí.</p>' +
    (malos.length ? '<div class="alerta">' + I.aviso + '<div><b>' + plural(malos.length, 'spot tuyo está', 'spots tuyos están') + ' en eucalipto:</b> ' + esc(malos.map(x => x.z.nombre).join(', ')) + '.</div></div>' : '') +
    '<button class="navrow" id="bq-est">' + I.chart + '<span class="t"><b>Lo que dicen tus setas</b><small>Dónde las encuentras y sitios recomendados que encajan</small></span>' + I.chev + '</button>' +
    '<div class="sec">Zonas calientes cerca<small>' + cal.length + '</small></div><p class="mut sm">Manchas grandes de bosque autóctono maduro (16 ha cada cuadro). El número es el interés, de 0 a 100.</p>' +
    '<div id="bq-cal">' + cal.slice(0, 5).map(filaC).join('') + '</div>' + (cal.length > 5 ? '<button class="btn" id="bq-mas" style="width:100%">Ver las ' + cal.length + ' zonas</button>' : '') +
    (spR.length ? '<details class="det"><summary>Tus spots según su bosque (' + buenos.length + ' en buen bosque)</summary>' + spR.sort((a, c) => c.r.s - a.r.s).map(filaS).join('') + '</details>' : '') +
    '<details class="det"><summary>Cómo se calcula</summary><p class="mut sm">Cada mancha es un rodal del <b>Inventario Forestal de la CAPV ' + D.ano + '</b> del Gobierno Vasco, con su especie dominante medida sobre el terreno y la foto aérea. No es una estimación desde el satélite.</p>' +
      '<p class="mut sm">El interés (0–100) junta: el tipo de bosque (autóctono 100, frondosas plantadas 70, pinar 55, otras coníferas 45, otros árboles 25, eucalipto 3), lo maduro que está (maduro ×1, joven ×0,85, monte bravo ×0,5, repoblado ×0,3, talado ×0,15) y si hay mezcla de especies (+5 por especie). Es una guía de dónde mirar, no promete setas.</p>' +
      '<div class="bq-ley col">' + D.clases.map(c => '<span style="--c:' + c.c + '"><i></i><b>' + esc(c.n) + '</b> ' + esc(c.d) + '</span>').join('') + '</div></details>' +
    '<p class="mut sm bq-f">' + esc(D.fuente) + '</p><button class="btn" id="bq-off" style="width:100%">Quitar la capa de bosques</button>', { dim: false });
  sh.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.id === 'sv-x') closeSheet();
    else if (t.id === 'bq-off') { capaBosques(false); closeSheet(); }
    else if (t.id === 'bq-est') abrirEstadisticas();
    else if (t.id === 'bq-mas') { $('#bq-cal', sh).innerHTML = cal.map(filaC).join(''); t.remove(); }
    else if (t.dataset.cz) { const z = cal[+t.dataset.cz]; closeSheet(); S.map.setView([z.lat, z.lon], 16); const r = bos.cerca(z.lat, z.lon); if (r) abrirRodal(r, z.lat, z.lon); }
    else if (t.dataset.spot) abrirSpot(t.dataset.spot);
  });
}
/* «Lo que dicen tus setas»: dónde salen tus hallazgos (tipo de bosque y bordes) frente a por dónde andas, y sitios que encajan */
async function abrirEstadisticas() {
  if (!(await capaBosques(true))) return;
  const D = bos.datos(), hs = (await db.list('hallazgos')).filter(h => h.lat != null);
  const sal = await db.list('salidas'), a = await activa();
  const track = sal.flatMap(x => (a && x.id === a.id && trk.activo() === a.id ? trk.puntos() : x.track) || []);
  const E = bos.estadistica(hs, track), yo = geo.fix() || { lat: 43.4205, lon: -2.723 };
  const km = trk.metros(track) / 1000, pct = x => Math.round(x * 100) + ' %', maxP = Math.max(...E.sitios.map(x => Math.max(x.ph, x.pt || 0)), .01);
  const conT = E.nt >= 30;
  const filaSit = x => '<div class="bq-sit"><div class="t"><b>' + esc(x.n) + '</b><small>' + plural(x.h, 'hallazgo', 'hallazgos') + (conT && x.x != null && x.h ? ' · <em class="' + (x.x >= 1.3 ? 'up' : x.x < .8 ? 'dn' : '') + '">rinde ×' + x.x.toFixed(1).replace('.', ',') + '</em>' : '') + '</small></div>' +
    '<div class="bq-b2"><i class="h" style="width:' + (x.ph / maxP * 100).toFixed(1) + '%"></i>' + (conT ? '<i class="t" style="width:' + ((x.pt || 0) / maxP * 100).toFixed(1) + '%"></i>' : '') + '</div></div>';
  /* por especie (las identificadas) */
  const porEsp = {}; E.sh.forEach(({ h, k }) => { const id = h.especieId; if (!id) return; (porEsp[id] = porEsp[id] || {})[k] = (porEsp[id][k] || 0) + 1; });
  const corta = { 'ab-pin': 'claro junto a pinar', 'ab-fro': 'claro junto a autóctono', 'pin-b': 'borde de pinar', 'pin-i': 'dentro del pinar', 'fro-b': 'borde de autóctono', 'fro-i': 'dentro de autóctono', euc: 'eucalipto', otro: 'otros' };
  const esp = Object.entries(porEsp).map(([id, t]) => ({ e: cat.byId(id), t, n: Object.values(t).reduce((a, b) => a + b, 0) })).filter(x => x.e).sort((a, b) => b.n - a.n);
  const zs = await db.list('zonas');
  const rec = (D.recomendados || []).map((z, i) => ({ ...z, i, d: distM(yo, z), ya: zs.find(s => s.lat != null && distM(s, z) < 80) })).sort((a, b) => a.d - b.d);
  const sh = openSheet('<div class="sv-h"><div class="sv-t"><h2>Lo que dicen tus setas</h2><div class="meta"><span>' + plural(E.nh, 'hallazgo', 'hallazgos') + '</span><span>' + km.toFixed(1).replace('.', ',') + ' km con GPS</span></div></div><button class="icb" id="sv-x" aria-label="Cerrar">' + I.close + '</button></div>' +
    (E.nh ? '<div class="bq-kpi"><div><b>' + pct(E.bordeH) + '</b><small>de tus setas, en un borde: a menos de 15 m de un prado, matorral o cortafuegos</small></div>' +
      (conT ? '<div><b>' + pct(E.bordeT) + '</b><small>de lo que andas va por bordes (por eso compara lo que encuentras con lo que pisas)</small></div>' : '') + '</div>' +
      '<div class="sec">Dónde salen</div>' + (conT ? '<div class="bq-ley"><span style="--c:#ffd43b"><i></i>tus hallazgos</span><span style="--c:#4c9bff"><i></i>lo que andas</span></div>' : '') +
      E.sitios.filter(x => x.h || (conT && x.pt > .03)).sort((a, b) => b.h - a.h).map(filaSit).join('') +
      '<p class="mut sm">«Rinde ×2» quiere decir: ahí sale el doble de setas de lo que te tocaría por el tiempo que pasas ahí. ' + (conT ? '' : 'Graba el recorrido en tus salidas para poder comparar. ') + 'Con ' + plural(E.nh, 'hallazgo', 'hallazgos') + ' es una primera pista: se recalcula sola con cada salida.</p>' +
      (esp.length ? '<details class="det" open><summary>Por especie</summary>' + esp.slice(0, 8).map(x => '<div class="bq-esp"><b>' + esc(corto(x.e)) + '</b><span>' + Object.entries(x.t).sort((a, b) => b[1] - a[1]).map(([k, n]) => esc(corta[k]) + (n > 1 ? ' ×' + n : '')).join(' · ') + '</span></div>').join('') + '</details>' : '')
      : '<p class="mut">Aún no hay hallazgos con posición para analizar.</p>') +
    (rec.length ? '<div class="sec">Sitios que encajan<small>' + rec.length + '</small></div><p class="mut sm">Bordes de pinar o de bosque autóctono maduro con prado, matorral o cortafuegos, sin eucalipto, cerca de Bermeo: el tipo de sitio de tus níscalos y boletos. En el mapa son las líneas <b class="bq-amar">amarillas</b> (pinar) y <b class="bq-verd">verdes</b> (autóctono).</p>' +
      rec.map(z => '<button class="item bq-z" data-rc="' + z.i + '"><span class="bq-n" style="--c:' + (z.tipo === 'pinar' ? '#ffd43b' : '#8ce99a') + '">' + (z.tipo === 'pinar' ? 'PIN' : 'AUT') + '</span><div class="t"><b>' + esc(z.nombre || 'Sitio recomendado') + (z.ya ? ' <em class="bq-ya">en tus spots</em>' : '') + '</b><small>' + esc(z.sp.slice(0, 2).join(' + ')) + ' · ' + Math.round(z.v / 10) * 10 + ' m de borde bueno</small></div><em class="bq-d">' + kmFmt(z.d) + '</em></button>').join('') : '') +
    '<p class="mut sm bq-f">' + esc(D.fuente) + '</p>', { dim: false });
  sh.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.id === 'sv-x') closeSheet();
    else if (t.dataset.rc) { const z = rec.find(x => x.i === +t.dataset.rc); closeSheet(); S.map.setView([z.lat, z.lon], 17); if (z.ya) abrirSpot(z.ya.id); else { const r = bos.cerca(z.lat, z.lon); if (r) abrirRodal(r, z.lat, z.lon); } }
  });
}
function abrirRodal(r, lat, lon) {
  closeSheet();
  S.bqSel = L.polygon(r.pts, { color: '#fff', weight: 3, fill: false, interactive: false }).addTo(S.map);
  const est = bos.estado(r), habs = bos.habitats(r), euca = r.c.k === 'euca';
  const setas = euca ? [] : cat.porRareza(cat.todas().filter(e => (e.habitats || []).some(h => habs.includes(h))));
  const pct = o => o ? o * 10 + ' %' : '';
  const abierto = bos.ABIERTO.has(r.c.k);
  const sh = openSheet('<div class="sv-h"><div class="sv-t"><h2>' + esc(r.c.n) + '</h2><div class="meta">' + (abierto ? '<span>Zona abierta</span>' : '<span class="bq-n sm" style="--c:' + r.c.c + '">' + r.s + '</span><span>Interés ' + bos.nivel(r.s).toLowerCase() + '</span>') +
      (est ? '<span>' + esc(est) + '</span>' : '') + '<span>' + (Math.round(bos.ha(r) * 10) / 10).toString().replace('.', ',') + ' ha</span></div></div><button class="icb" id="sv-x" aria-label="Cerrar">' + I.close + '</button></div>' +
    (euca ? '<div class="alerta">' + I.aviso + '<div><b>Eucalipto.</b> Casi no tiene setas de nuestros bosques: mejor busca en otra mancha.</div></div>' : '') +
    (abierto ? '' : '<div class="sec">Árboles de esta mancha</div><div class="bq-sp">') + (abierto ? [] : r.sp).map(q => '<span><b>' + esc(q.n) + '</b>' + (r.sp.length > 1 ? '<em>' + pct(q.o) + '</em>' : '') + '</span>').join('') + (abierto ? '' : '</div>') +
    '<p class="mut sm">' + esc(r.c.d) + (est ? ' Estado: <b>' + esc(est.toLowerCase()) + '</b> (' + esc(bos.ESTADOS_TXT[est] || '') + ').' : '') + '</p>' +
    (setas.length ? '<div class="sec">Setas de tu guía que viven en ' + (abierto ? 'este tipo de sitio' : 'este bosque') + '<small>' + setas.length + '</small></div><div class="echs">' + setas.slice(0, 12).map(e => '<button class="ech sin" data-e="' + e.id + '" style="--c:' + colorEsp(e) + '"><i></i>' + esc(corto(e)) + '</button>').join('') + '</div>' +
      '<p class="mut sm">Según el hábitat de cada ficha. Que viva en este tipo de bosque no quiere decir que esté aquí.</p>' : '') +
    '<div class="acts"><button class="btn" id="bq-spot">' + I.flag + 'Guardar «Quiero ir»</button><a class="btn" target="_blank" rel="noopener" href="' + rutaURL({ lat, lon }) + '">' + I.route + 'Cómo llegar</a></div>' +
    '<p class="mut sm bq-f">' + esc(bos.datos().fuente) + '</p>', { dim: false });
  sh.addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.id === 'sv-x') closeSheet();
    else if (t.dataset.e) abrirFicha(t.dataset.e);
    else if (t.id === 'bq-spot') {
      const zs = await db.list('zonas'), nom = lug.nombreSpot(lat, lon, zs.map(z => z.nombre)) || 'Bosque por visitar';
      const id = await db.add('zonas', { nombre: nom, lat, lon, notas: r.c.n + ': ' + r.sp.map(q => q.n).join(', ') + ' (analizador de bosques)', estado: 'por_visitar', fotos: [], audios: [], transcripciones: {}, creada: Date.now() });
      toast('Guardado en «Quiero ir»: ' + nom); closeSheet(); refreshPins(); abrirSpot(id);
    }
  });
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
function dibujarZona(z, g) {
  const c = zon.color(z.i), o = { color: c, weight: 1.5, fillColor: c, interactive: false, className: 'zona-circ' };
  /* una sola mancha por donde has andado: relleno sin los bordes de cada trocito (que parecían círculos) */
  if (z.anillos.length) return L.polygon(z.anillos, { ...o, stroke: false, fillOpacity: .3, fillRule: 'nonzero' }).addTo(g);
  if (z.circulo && z.circulo.n >= 2) return L.circle([z.circulo.lat, z.circulo.lon], { ...o, radius: z.circulo.r, dashArray: '7 6', weight: 2, fillOpacity: .08 }).addTo(g);
  return null;
}
/* lista de zonas de la salida: color, hora, tiempo en marcha, km y qué has encontrado */
function zonasHTML(s, zs) {
  if (!tr.tiene(s)) return '';
  return '<div class="zlist">' + zs.map(z => '<div class="zc" style="--c:' + zon.color(z.i) + '"><i class="zd"></i><div class="zt"><b>' + (z.i + 1) + ' · ' + esc(z.nombre) + (z.en ? ' <em class="zlive">en marcha</em>' : '') + '</b>' +
    '<small>' + hhmm(z.tramo.ini) + (z.en ? '' : '–' + hhmm(z.tramo.fin)) + ' · ' + trk.fmtDur(z.seg) + (z.m ? ' · ' + trk.fmtKm(z.m) : '') + '</small></div>' +
    '<span class="zn">' + plural(z.hallazgos, 'hallazgo', 'hallazgos') + ' · ' + plural(z.especies, 'especie', 'especies') + '</span>' + (z.hallazgos ? avatares(z.hhs, 5) : '') + '</div>').join('') + '</div>';
}
async function refreshPins() {
  if (!S.map) return; S.pins.clearLayers(); S.spotsL.clearLayers(); S.spotM = {};
  const [hs, act, zs] = [await db.list('hallazgos'), await activa(), await db.list('zonas')], f = S.filtro, capa = S.capa || 'todo';
  if (capa === 'todo' || capa === 'hallazgos')
    hs.filter(h => (!f.salida || (f.salida === 'activa' ? act && h.salidaId === act.id : h.salidaId === f.salida)) && (!f.especie || h.especieId === f.especie))
      .forEach(h => pinH(h).on('click', () => verHallazgo(h.id)).addTo(S.pins));
  if (capa !== 'hallazgos')
    zs.filter(z => z.lat != null && z.lon != null && (capa === 'todo' || (capa === 'visit' ? z.estado !== 'por_visitar' : capa === 'porir' ? z.estado === 'por_visitar' && !recomendado(z) : capa === 'rec' ? recomendado(z) : true))).forEach(z => {
      const n = new Set(hs.filter(h => h.zonaId === z.id).map(h => h.especieId || norm(h.especieTxt))).size;
      S.spotM[z.id] = spotPin(z, { n }).on('click', () => verSpot(z.id)).addTo(S.spotsL);
    });
  /* zonas recorridas: no siempre (cargan el mapa); solo al filtrar por una salida. Al tocar un spot salen las suyas */
  if (f.salida && (capa === 'todo' || capa === 'visit')) (await db.list('salidas')).filter(x => !f.salida || (f.salida === 'activa' ? act && x.id === act.id : x.id === f.salida))
    .forEach(x => zon.zonasDeSalida(x, hs, zs).forEach(z => dibujarZona(z, S.spotsL)));
  if (S.selId) marcarSel(S.selId);
  $('#mhint').hidden = !!(hs.length || zs.length);
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
  /* dentro de una salida, el spot por defecto es el más cercano de ESA salida (su zona); fuera, el que tengas a menos de 150 m */
  if (!m.zona) m.zona = zon.spotDefecto(pos, zonas, opts.salida ? await db.get('salidas', opts.salida) : act);
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
  const lugTxt = () => { const r = lug.nombrar(pos.lat, pos.lon); return r ? r.etiqueta : pos.lat.toFixed(5) + ', ' + pos.lon.toFixed(5); };
  const posTxt = () => lugTxt() + (pos.manual || pos.adj ? ' · ajustado a mano' : pos.acc != null ? ' · ±' + pos.acc + ' m' : '');
  const zonasOrd = () => zonas.slice().sort((a, b) => (act && act.zonaIds.includes(b.id)) - (act && act.zonaIds.includes(a.id)) || a.nombre.localeCompare(b.nombre));
  const zonaHTML = () => '<label class="l">Spot</label><div class="chips" id="mk-zonas">' +
    zonasOrd().map(z => '<button class="opt ' + (m.zona === z.id ? 'on' : '') + '" data-z="' + z.id + '">' + esc(z.nombre) + '</button>').join('') +
    '<button class="opt" id="mk-nz">+ Spot nuevo</button></div>' + (m.nueva ? '<div class="row" style="margin-top:8px"><input type="text" id="mk-znom" placeholder="Nombre del spot" value="' + esc(lug.nombreSpot(pos.lat, pos.lon, zonas.map(z => z.nombre))) + '" style="flex:1"><button class="btn p" id="mk-zok" style="flex:none">Crear</button></div>' : '');
  const sh = openSheet('<h2>Nuevo hallazgo</h2><p class="sub" id="mk-pos">' + horaTxt() + ' · ' + posTxt() + '</p>' +
    '<div class="mtiles"><button class="mtile" id="mk-foto">' + I.foto + '<b>Foto</b></button><button class="mtile" id="au-rec"' + (au.soportado() ? '' : ' disabled') + '>' + I.mic + '<b>Nota de voz</b></button></div>' +
    '<div id="mk-th" class="thumbs"></div><div id="mk-iares"></div><div id="au-list"></div>' +
    '<label class="l">¿Qué es?</label><div class="gsp" id="mk-grid">' + gridHTML() + '</div>' + pickerHTML(m.esp, { rejilla: true }) +
    '<div id="mk-zona">' + zonaHTML() + '</div>' +
    '<label class="l">Cantidad</label><div class="cantq">' + ['1', '2–5', 'Muchas', '≈200 g'].map(x => '<button class="opt" data-cq="' + x + '">' + x + '</button>').join('') + '</div><input type="text" id="mk-cant" placeholder="o escríbela: 3 · ≈200 g" style="margin-top:8px">' +
    '<details class="det" id="mk-det"><summary>Estado y nota</summary><label class="l">Estado</label><div class="seg" id="mk-est">' + ESTADOS.map(e => '<button data-e="' + e[0] + '">' + e[1] + '</button>').join('') + '</div>' +
    '<label class="l">Nota</label><input type="text" id="mk-nota" placeholder="Nota corta (o díctala con la nota de voz)"></details>' +
    '<div class="row mk-bar"><button class="btn" id="mk-x">Cancelar</button><button class="btn p" id="mk-ok" style="flex:2">Guardar</button></div>', { dim: !!opts.pos });
  const regrid = () => { $('#mk-grid', sh).innerHTML = gridHTML(); };
  /* Reconocer con IA desde el propio hallazgo: las fotos del hallazgo son las de la IA. Sacas las que quieras (botón Foto), y cuando quieras pulsas «Escanear»: mira todas juntas */
  let iaBusy = false, iaEsc = 0, iaRes = '', iaCands = [], iaFalta = '', iaDif = [];
  const iaPintar = (extra = '') => {
    const n = m.fotos.length, box = $('#mk-iares', sh);
    box.innerHTML = extra + iaRes + '<div class="row"><button class="btn ' + (n ? 'p' : '') + ' ia-go" id="mk-iaes"' + (n && !iaBusy ? '' : ' disabled') + '>' + I.chispa + ' ' +
      (iaBusy ? 'Mirando…' : !n ? 'Escanear con IA · haz una foto primero' : iaEsc ? (iaEsc === Math.min(n, 4) ? 'Escanear otra vez' : 'Escanear de nuevo con ' + n + (n === 1 ? ' foto' : ' fotos')) : 'Escanear con IA · ' + n + (n === 1 ? ' foto' : ' fotos')) + '</button></div>';
  };
  const iaEscanear = async () => {
    if (iaBusy || !m.fotos.length) return;
    if (!ia.getKey()) { iaPintar('<div class="warn">Falta la clave de Gemini: pégala en Ajustes → Reconocer con IA.</div>'); return; }
    if (!navigator.onLine) { iaPintar('<div class="warn">Sin conexión: las fotos quedan guardadas en el hallazgo. Escanea cuando tengas cobertura.</div>'); return; }
    const ids = m.fotos.slice(-4), files = ids.map(id => { const r = db.B.get(id); return r && r.blob; }).filter(Boolean);
    if (!files.length) { iaPintar('<div class="warn">No encuentro las fotos para escanearlas. Haz otra.</div>'); return; }
    iaBusy = true; iaRes = ''; iaPintar('<div class="note ia-wait">' + I.chispa + ' Mirando ' + (files.length === 1 ? 'la foto' : 'las ' + files.length + ' fotos') + '…</div>');
    let err = '';
    try { const r = await ia.reconocer(files); iaCands = (r.candidatas || []).map(c => ({ id: c.id, n: c.nombreCientifico, c: c.confianza, ...(c.encaja ? { si: c.encaja } : {}), ...(c.noEncaja ? { no: c.noEncaja } : {}), ...(c.comprobar ? { k: c.comprobar } : {}) })); iaFalta = r.faltaVer || ''; iaDif = r.diferencias || []; iaRes = resultadoIA(r, 'marcar'); iaEsc = files.length; }
    catch (e) { if (e.message === 'clave') ia.setKey(''); err = '<div class="warn">' + esc(ia.mensajeError(e)) + '</div>'; }
    finally { iaBusy = false; }
    iaPintar(err);
  };
  iaPintar();
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
    else if (t.id === 'mk-nz') { m.nueva = true; rezona(); const zi = $('#mk-znom', sh); zi.focus(); zi.select(); }
    else if (t.id === 'mk-zok') {
      const n = $('#mk-znom', sh).value.trim(); if (!n) return;
      const id = await db.add('zonas', { nombre: n, lat: pos.lat, lon: pos.lon, notas: '', estado: 'visitada', visitadaTs: Date.now() });
      zonas.push({ id, nombre: n, lat: pos.lat, lon: pos.lon }); m.zona = id; m.nueva = false; rezona();
    }
    else if (t.dataset.e) { m.estado = m.estado === t.dataset.e ? '' : t.dataset.e; $$('#mk-est button', sh).forEach(b => b.classList.toggle('on', b.dataset.e === m.estado)); }
    else if (t.dataset.iae || t.closest('[data-iae]') || t.closest('[data-iat]')) {
      const r = t.closest('[data-iae]'), o = t.closest('[data-iat]');
      if (r) { const e = cat.byId(r.dataset.iae); m.esp.id = e.id; m.esp.txt = ''; $('#sp-q', sh).value = cat.nombre(e); $('#sp-sel', sh).innerHTML = tag(cat.vista(e)); toast('Elegida: ' + corto(e) + ' (provisional)'); }
      else if (o) { m.esp.id = null; m.esp.txt = o.dataset.iat; $('#sp-q', sh).value = o.dataset.iat; $('#sp-sel', sh).innerHTML = ''; toast('Anotada: ' + o.dataset.iat); }
      $('#sp-sugs', sh).hidden = true; regrid(); $$('#mk-iares .ia-row', sh).forEach(x => x.classList.toggle('sel', x === (r || o)));
    }
    else if (t.dataset.iav) {
      /* comprobar a pantalla completa (sin perder lo que llevas marcado): qué mirar de cada candidata y sus diferencias */
      const cs = iaCands.map(c => ({ e: cat.byId(c.id), pc: Math.max(0, Math.min(100, c.c | 0)), ia: { encaja: c.si, noEncaja: c.no, comprobar: c.k } })).filter(c => c.e);
      abrirComprobar(cs, { i: Math.max(0, cs.findIndex(c => c.e.id === t.dataset.iav)), faltaVer: iaFalta, dif: iaDif, elegir: e => {
        m.esp.id = e.id; m.esp.txt = ''; $('#sp-q', sh).value = cat.nombre(e); $('#sp-sel', sh).innerHTML = tag(cat.vista(e)); $('#sp-sugs', sh).hidden = true; regrid();
        $$('#mk-iares .ia-row', sh).forEach(x => x.classList.toggle('sel', x.dataset.iae === e.id)); toast('Elegida: ' + corto(e) + ' (provisional)'); } });
    }
    else if (t.id === 'mk-iano') { m.esp.id = null; m.esp.txt = ''; $('#sp-q', sh).value = ''; $('#sp-sel', sh).innerHTML = ''; regrid(); $$('#mk-iares .ia-row', sh).forEach(x => x.classList.remove('sel')); toast('Se guardará sin identificar' + (iaCands.length ? ', con lo que sugirió la IA' : '') + '. Lo miras en casa.', 3600); }
    else if (t.id === 'mk-iaes') iaEscanear()
    else if (t.id === 'mk-foto') pickFoto(id => { m.fotos.push(id); const im = document.createElement('img'); im.dataset.blob = id; $('#mk-th', sh).appendChild(im); hydrate($('#mk-th', sh)); if (!iaBusy) iaPintar(); });
    else if (t.id === 'mk-x') closeSheet();
    else if (t.id === 'mk-ok') {
      t.disabled = true;
      try {
        const a = await activa(), q = $('#sp-q', sh).value.trim();
        const sid = opts.salida || (a ? a.id : null), sa0 = sid && (a && a.id === sid ? a : await db.get('salidas', sid)), tAct = sa0 ? tr.activo(sa0) : null, h = { salidaId: sid, tramoId: opts.ts ? ((sa0 && (tr.deTs(sa0, opts.ts) || {}).id) || undefined) : (tAct ? tAct.id : undefined), zonaId: m.zona, lat: pos.lat, lon: pos.lon, precisionM: pos.acc, ts: opts.ts || Date.now(), especieId: m.esp.id, especieTxt: m.esp.id ? '' : q,
          cantidad: $('#mk-cant', sh).value.trim(), estadoSeta: m.estado, sustrato: '', notas: $('#mk-nota', sh).value.trim(), fotos: m.fotos,
          identificacion: m.esp.id ? 'provisional' : 'sin_identificar', confirmadoPor: '', recogida: false, iaSugerencias: iaCands.length ? iaCands : undefined, iaDif: iaDif.length ? iaDif : undefined, lugar: (lug.nombrar(pos.lat, pos.lon) || {}).etiqueta || '', ajustadoAMano: !!(pos.adj || pos.manual), audios: vz.audios, transcripciones: vz.trans };
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
/* Cómo llegar: abre Google Maps con la ruta en coche ya lista (en el móvil, la app de Maps y a navegar) */
const rutaURL = z => 'https://www.google.com/maps/dir/?api=1&destination=' + z.lat + ',' + z.lon + '&travelmode=driving&dir_action=navigate';
const irA = z => '<a class="goto" href="' + rutaURL(z) + '" target="_blank" rel="noopener" aria-label="Cómo llegar a ' + esc(z.nombre || 'este spot') + '" title="Cómo llegar">' + I.route + '</a>';
const spotColor = z => recomendado(z) ? '#ffd43b' : z.estado === 'por_visitar' ? '#4cc3d9' : '#46b36b';
const spotTag = z => '<span class="tag" style="--c:' + spotColor(z) + '">' + (recomendado(z) ? 'Recomendado' : z.estado === 'por_visitar' ? 'Quiero ir' : 'Visitado') + '</span>';
async function irAlMapa() { if (S.view !== 'mapa') { location.hash = '#mapa'; await new Promise(r => setTimeout(r, 250)); } }
const abrirSpot = id => id ? verSpot(id) : editarSpot();
async function editarSpot(id, o = {}) {
  await irAlMapa();
  closeSheet();
  let z = id ? await db.get('zonas', id) : null; const nuevo = !z;
  const todasZ = await db.list('zonas'), otrosNom = todasZ.filter(x => x.id !== id).map(x => x.nombre);
  if (nuevo) { const f = geo.fix(), c = S.map.getCenter(), la = f ? f.lat : c.lat, lo = f ? f.lon : c.lng; z = { nombre: lug.nombreSpot(la, lo, otrosNom) || (o.salida ? 'Spot ' + (todasZ.length + 1) : ''), estado: 'visitada', lat: la, lon: lo, notas: '' }; }
  let auto = nuevo;                                   /* mientras no lo toques, el nombre sigue al punto */
  const pos = { lat: z.lat, lon: z.lon }, fotos = [...(z.fotos || [])], vz = nuevoVoz(z); let estado = z.estado || 'visitada';
  S.map.setView([pos.lat, pos.lon], Math.max(S.map.getZoom(), 16));
  S.tmp = dragPin()(pos.lat, pos.lon).addTo(S.map);
  const sh = openSheet('<h2>' + (nuevo ? (o.zona ? 'Empezar zona' : 'Nuevo spot') : 'Editar spot') + '</h2><p class="sub" id="st-pos"></p>' +
    '<input type="text" id="st-nom" placeholder="Nombre del sitio (p. ej. Hayedo de Otzarreta)" value="' + esc(z.nombre) + '"><button class="opt st-sug" id="st-sug" hidden></button>' +
    '<label class="l">Estado</label><div class="seg" id="st-est">' + SPOT_EST.map(e => '<button data-s="' + e[0] + '" class="' + (estado === e[0] ? 'on' : '') + '">' + e[1] + '</button>').join('') + '</div>' +
    '<div class="row"><button class="btn" id="st-aqui">Usar mi posición</button>' + (nuevo ? '' : '<a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + z.lat + ',' + z.lon + '">Cómo llegar</a>') + '</div>' +
    '<label class="l">Nota</label><textarea id="st-nota" placeholder="Cómo se llega, qué árboles hay, qué esperas encontrar…">' + esc(z.notas) + '</textarea>' + vozHTML(vz) +
    '<label class="l">Fotos</label><div class="thumbs" id="st-th">' + fotos.map(f => '<img data-blob="' + f + '">').join('') + '</div><div class="row"><button class="btn" id="st-foto">Añadir foto</button></div>' +
    '<div class="row">' + (nuevo ? '' : '<button class="btn d" id="st-del">Borrar</button>') + '<button class="btn" id="st-x">Cancelar</button><button class="btn p" id="st-ok" style="flex:2">' + (o.zona ? 'Empezar zona' : 'Guardar') + '</button></div>', { dim: false });
  const posTxt = () => {
    const r = lug.nombrar(pos.lat, pos.lon), sug = lug.nombreSpot(pos.lat, pos.lon, otrosNom), inp = $('#st-nom', sh);
    if (auto && sug) inp.value = sug;
    $('#st-pos', sh).textContent = (r ? '📍 ' + r.etiqueta + ' · ' : '') + pos.lat.toFixed(5) + ', ' + pos.lon.toFixed(5) + (nuevo ? ' · arrastra el punto a su sitio' : '');
    const b = $('#st-sug', sh); if (b) { b.hidden = !sug || auto || inp.value.trim() === sug; b.dataset.n = sug; b.textContent = '📍 Usar «' + sug + '»'; }
  };
  $('#st-nom', sh).addEventListener('input', () => { auto = false; posTxt(); });
  posTxt(); vozWire(sh, vz); hydrate($('#st-th', sh));
  encuadrar(pos.lat, pos.lon, sh);
  if (S.tmp) S.tmp.on('dragend', () => { const p = S.tmp.getLatLng(); pos.lat = p.lat; pos.lon = p.lng; posTxt(); });
  sh.addEventListener('click', async ev => {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.id === 'st-sug') { $('#st-nom', sh).value = t.dataset.n; auto = !!nuevo; posTxt(); return; }
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
        if (nuevo) {
          const ahora = Date.now(), nid = await db.add('zonas', { ...d, creada: ahora });
          if (o.salida) { const ss = await db.get('salidas', o.salida); if (ss) {
            await db.patch('salidas', o.salida, { zonaIds: [...(ss.zonaIds || []), nid], ...(o.zona ? { tramos: tr.abrir(ss, nid, ahora), grabar: true } : {}) });
            if (o.zona) await trk.start(o.salida, (ss.track || []).length > 0);
          } }
        }
        else await db.patch('zonas', id, d);
        closeSheet(); toast(nuevo ? (o.zona ? 'Zona empezada: te sigo el recorrido' : o.salida ? 'Spot añadido a la salida' : 'Spot guardado') : 'Guardado'); syn.auto();
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
    '<div class="acts"><button class="btn p" id="st-marcar">' + I.plus + (lejos ? 'Añadir especie' : 'Marcar aquí') + '</button><a class="btn" target="_blank" rel="noopener" href="' + rutaURL(z) + '">' + I.route + 'Cómo llegar</a></div>' +
    (peligro.length ? '<div class="alerta">' + I.aviso + '<div>Aquí también has visto <b>' + esc(peligro.map(r => r.nom).join(', ')) + '</b>. Mira bien cada seta antes de cogerla.</div></div>' : '') +
    (esp.length ? '<div class="sec">Especies encontradas<small>' + esp.length + '</small></div><div class="spcs">' + esp.map(card).join('') + '</div>' +
      (delMes.length ? '<div class="tip">' + I.cal + '<div>En <b>' + MES_L[mesAct] + '</b> aquí te han salido: ' + esc(delMes.map(r => r.nom).join(', ')) + '.</div></div>' : '') +
      '<div class="sec">Cuándo has encontrado aquí</div><div class="mbar">' + porMes.map((n, i) => '<div class="' + (i === mesAct ? 'cur' : '') + '"><u style="height:' + (n ? Math.max(12, Math.round(n / max * 100)) : 4) + '%" class="' + (n ? 'h' : '') + '"></u><span>' + MES_C[i] + '</span></div>').join('') + '</div>' +
      '<p class="mut sm">Mejor mes hasta ahora: <b>' + MES_L[mejor] + '</b> (' + porMes[mejor] + (porMes[mejor] === 1 ? ' hallazgo' : ' hallazgos') + ').</p>'
      : '<div class="sv-empty">' + I.seta + '<div>' + (por ? '<b>Aún no has ido.</b> Cuando marques algo aquí pasará a «Visitado».' : '<b>Sin especies anotadas.</b> Pulsa «Marcar aquí» la próxima vez que vengas, o añádelas desde la salida.') + '</div></div>') +
    (ss.some(x => (x.track || []).length > 1) ? '<p class="mut sm">En el mapa, la mancha de color: la zona que recorriste en tus visitas.</p>' : '') + (ss.length ? '<div class="sec">Visitas<small>' + ss.length + '</small></div>' + ss.map(s => { const n = new Set(hs.filter(h => h.salidaId === s.id).map(h => h.especieId || h.especieTxt)).size; return '<a class="vrow" href="#salida/' + s.id + '"><span class="vd"><b>' + (s.fecha || '').slice(8, 10) + '</b>' + esc(new Date((s.fecha || '2000-01-01') + 'T12:00').toLocaleDateString('es-ES', { month: 'short' })) + '</span><span class="vt"><b>' + esc(s.titulo || fecha(s.fecha)) + '</b><small>' + (s.fecha || '').slice(0, 4) + ' · ' + (n ? n + (n === 1 ? ' especie' : ' especies') + ' aquí' : 'sin especies anotadas aquí') + '</small></span>' + I.chev + '</a>'; }).join('') : '') +
    (z.notas || Object.values(z.transcripciones || {}).some(Boolean) ? '<div class="sec">Notas</div><div class="nota">' + (z.notas ? '<p>' + esc(z.notas) + '</p>' : '') + Object.values(z.transcripciones || {}).filter(Boolean).map(t => '<p class="vz">«' + esc(t) + '»</p>').join('') + '</div>' : '') +
    ((z.fotos || []).length ? '<div class="sec">Fotos</div><div class="gal">' + z.fotos.map(f => '<img data-blob="' + f + '" alt="">').join('') + '</div>' : ''), { dim: false });
  marcarSel(id);
  /* qué bosque es, según el inventario forestal */
  bos.cargar().then(() => { const r = bos.cerca(z.lat, z.lon), m = sh.querySelector('.sv-t'); if (!r || !m || !sh.isConnected) return;
    m.insertAdjacentHTML('beforeend', '<button class="bq-spot' + (r.c.k === 'euca' ? ' mal' : '') + '" id="st-bosq" style="--c:' + r.c.c + '">' + I.arbol + '<span>' + esc(r.c.n) + ' · ' + esc(r.sp.map(q => q.n).slice(0, 2).join(' + ')) + '</span><b>' + r.s + '</b></button>'); });
  /* la zona que has recorrido en este spot (en cada salida): aparece solo mientras miras el spot */
  if (S.spTrk) S.spTrk.remove(); S.spTrk = L.layerGroup().addTo(S.map);
  { const zz = await db.list('zonas'); ss.forEach(x => zon.zonasDeSalida(x, hs0, zz).filter(q => q.spotId === id || (q.legado && (x.zonaIds || []).includes(id))).forEach(q => dibujarZona(q, S.spTrk))); }
  S.map.setView([z.lat, z.lon], Math.max(S.map.getZoom(), 15), { animate: false });
  encuadrar(z.lat, z.lon, sh);
  sh.addEventListener('click', ev => {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.id === 'st-bosq') { const r = bos.cerca(z.lat, z.lon); if (r) { capaBosques(true); abrirRodal(r, z.lat, z.lon); } return; }
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
    (h.iaSugerencias && h.iaSugerencias.length ? '<div class="nota ia-sug"><b>Sugerencias de la IA</b>' + h.iaSugerencias.map(x => { const q = cat.byId(x.id); return '<p>' + (q ? '<button class="lnk" data-hc="' + q.id + '">' + esc(corto(q)) + '</button>' : '<i>' + esc(x.n) + '</i>') + ' · ' + (x.c | 0) + ' %</p>'; }).join('') +
      (h.iaSugerencias.some(x => cat.byId(x.id)) ? '<button class="btn" data-hc="" style="width:100%;margin-top:6px">' + I.lupa + 'Comprobar cuál es: qué mirar y diferencias</button>' : '') + '</div>' : '') +
    avisoComer(e) +
    '<div class="acts">' + (e ? '<button class="btn" id="hv-ficha">' + I.libro + 'Ver ficha</button>' : '') + (z ? '<button class="btn" id="hv-spot">' + I.flag + esc(z.nombre) + '</button>' : '') + '</div>');
  sh.addEventListener('click', ev => {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.hc !== undefined) {
      const cs = h.iaSugerencias.map(x => ({ e: cat.byId(x.id), pc: Math.max(0, Math.min(100, x.c | 0)), ia: { encaja: x.si, noEncaja: x.no, comprobar: x.k } })).filter(c => c.e);
      if (e && !cs.some(c => c.e.id === e.id)) cs.unshift({ e, pc: null });
      abrirComprobar(cs, { i: Math.max(0, cs.findIndex(c => c.e.id === (t.dataset.hc || (e && e.id)))), dif: h.iaDif, elegir: async x => {
        await db.patch('hallazgos', id, { especieId: x.id, especieTxt: '', identificacion: h.identificacion === 'confirmada' && h.especieId === x.id ? 'confirmada' : 'provisional' });
        toast('Anotada como ' + corto(x) + ' (provisional)'); verHallazgo(id); refreshPins(); } });
      return;
    }
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
  toast('Salida empezada: marca la primera zona'); editarSpot(null, { salida: id, zona: true });
}
/* Duración de la salida: desde que se empieza hasta que se termina (o hasta ahora si sigue en curso) */
const durSeg = s => tr.tiene(s) ? tr.durTotal(s) : !s.creada ? 0 : Math.max(0, Math.round(((s.estado === 'en_curso' ? Date.now() : s.fin) || s.creada) - s.creada) / 1000);
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
  const filaZ = z => { const h = deZ(z.id), ne = especiesDe(h).length, por = z.estado === 'por_visitar', rec = recomendado(z);
    return '<div class="spotr"><button class="item spotc' + (por ? ' por' : '') + (rec ? ' sug' : '') + '" data-spot="' + z.id + '"><span class="sico">' + (rec ? I.estrella : por ? I.flag : I.seta) + '</span><div class="t"><b>' + esc(z.nombre) + '</b><small>' + [ne ? plural(ne, 'especie', 'especies') : (por ? 'sin visitar' : 'sin especies'), yo ? kmFmt(distM(yo, z)) : '', ultZ(z)].filter(Boolean).join(' · ') + '</small>' + avatares(h) + '</div></button>' + (z.lat != null && z.lon != null ? irA(z) : I.chev) + '</div>'; };
  const grupo = (est, tit) => { const l = zs.filter(z => est === 'rec' ? recomendado(z) : (z.estado || 'visitada') === est && !recomendado(z)).sort((a, b) => yo ? distM(yo, a) - distM(yo, b) : a.nombre.localeCompare(b.nombre, 'es', { numeric: true })); return l.length ? '<div class="grp" style="--c:' + (est === 'rec' ? '#ffd43b' : spotColor({ estado: est })) + '">' + tit + '<small>' + l.length + '</small></div>' + l.map(filaZ).join('') : ''; };
  const filaS = s => { const h = deS(s.id), n = nSpots(s);
    return '<a class="item sal" href="#salida/' + s.id + '">' + diaMes(s.fecha) + '<div class="t"><b>' + esc(s.titulo || fecha(s.fecha)) + '</b><small>' + [(s.fecha || '').slice(0, 4) === String(new Date().getFullYear()) ? '' : (s.fecha || '').slice(0, 4), tr.lista(s).length > 1 ? plural(tr.lista(s).length, 'zona', 'zonas') : n ? plural(n, 'spot', 'spots') : '', plural(h.length, 'hallazgo', 'hallazgos'), s.totalTxt ? esc(s.totalTxt) : '', s.estado === 'en_curso' ? 'en curso' : ''].filter(Boolean).join(' · ') + '</small>' + avatares(h) + '</div>' + I.chev + '</a>'; };
  $('#v-salidas').innerHTML = '<div class="pad">' + (act ? '<a class="item cur-sal" href="#salida/' + act.id + '"><span class="rdot"></span><div class="t"><b>Salida en curso</b><small>' + esc(fecha(act.fecha)) + ' · ' + plural(deS(act.id).length, 'hallazgo', 'hallazgos') + ' · ' + durTxt(act) + '</small></div><span class="tag" style="--c:#e0a458;color:#1a1206">Abrir</span></a>'
    : '<button class="start" id="s-new"><span class="ic">' + I.plus + '</span><span class="t"><b>Empezar salida</b><small>Marca dónde aparcas, graba tu recorrido y lo que encuentres</small></span></button>') +
    (ss.length ? (() => { const ne = especiesDe(hs.filter(h => h.especieId)).length; return '<div class="sal-res"><div><b>' + ss.length + '</b><small>' + (ss.length === 1 ? 'salida' : 'salidas') + '</small></div><div><b>' + hs.length + '</b><small>' + (hs.length === 1 ? 'hallazgo' : 'hallazgos') + '</small></div><div><b>' + ne + '</b><small>' + (ne === 1 ? 'especie' : 'especies') + '</small></div><div><b>' + zs.length + '</b><small>spots</small></div></div>'; })() : '') +
    '<div class="sec">Salidas<small>' + (ss.length || '') + '</small></div>' + (ss.length ? ss.map(filaS).join('') : '<div class="empty">Aún no hay salidas.<br>Empieza una cuando salgas al monte.</div>') +
    '<div class="sec">Mis spots<small>' + (zs.length || '') + '</small></div>' + (zs.length ? grupo('por_visitar', 'Quiero ir') + grupo('rec', 'Recomendados por el análisis') + grupo('visitada', 'Visitados') : '<div class="empty">Marca sitios que has visitado o que quieres visitar y aparecerán aquí y en el mapa.</div>') +
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
/* Nota de voz de la salida («aquí no hay setas porque…»): se graba, se transcribe y queda con la hora, el GPS y el spot más cercano */
async function abrirNotaSalida(sid) {
  const s = await db.get('salidas', sid); if (!s) return;
  const f = geo.fix(), zonas = (await db.list('zonas')).filter(z => z.lat != null), vz = nuevoVoz(); let tipo = 'nota', zona = null;
  zona = zon.spotDefecto(f, zonas, s);
  const sh = openSheet('<h2>Nota de voz</h2><p class="sub">' + hhmm(Date.now()) + (f ? ' · ' + ((lug.nombrar(f.lat, f.lon) || {}).etiqueta || f.lat.toFixed(5) + ', ' + f.lon.toFixed(5)) : ' · sin GPS') + '</p>' +
    '<label class="l">Qué es</label><div class="seg" id="dn-tipo"><button data-tp="nota" class="on">Nota</button><button data-tp="sin_setas">Aquí no hay setas</button></div>' +
    '<label class="l">Spot</label><select id="dn-zona"><option value="">Ninguno</option>' + zonas.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map(z => '<option value="' + z.id + '"' + (z.id === zona ? ' selected' : '') + '>' + esc(z.nombre) + '</option>').join('') + '</select>' +
    vozHTML(vz) + '<label class="l">Texto (se rellena solo con lo que dices; puedes corregirlo)</label><textarea id="dn-txt" rows="3" placeholder="Qué ves y por qué crees que hay o no hay setas"></textarea>' +
    '<div class="row mk-bar"><button class="btn" id="dn-x">Cancelar</button><button class="btn p" id="dn-ok" style="flex:2">Guardar</button></div>');
  vozWire(sh, vz);
  vz.onTrans = (id, t) => { const x = $('#dn-txt', sh); x.value = x.value.trim() ? x.value.trim() + ' ' + t : t; };
  sh.addEventListener('click', async ev => {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.tp) { tipo = t.dataset.tp; $$('#dn-tipo button', sh).forEach(b => b.classList.toggle('on', b === t)); }
    else if (t.id === 'dn-x') { if (S.rec) { S.rec.cancel(); S.rec = null; clearInterval(S.recT); } closeSheet(); }
    else if (t.id === 'dn-ok') {
      if (S.rec) return toast('Para la grabación antes de guardar');
      const texto = $('#dn-txt', sh).value.trim(); if (!texto && !vz.audios.length) return toast('Graba algo o escribe una línea');
      t.disabled = true;
      try {
        const cur = await db.get('salidas', sid), fx = geo.fix(), e = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ts: Date.now(), tipo, zonaId: $('#dn-zona', sh).value || null, lat: fx ? fx.lat : null, lon: fx ? fx.lon : null, precisionM: fx ? fx.acc : null, texto, audios: vz.audios, transcripciones: vz.trans };
        await db.patch('salidas', sid, { diario: [...(cur.diario || []), e] });
        closeSheet(); toast('Nota guardada en la salida'); syn.auto(); if (S.view === 'salida' && S.arg === sid) location.hash = '#salida/' + sid + '/diario'; else renderView();
      } catch (er) { t.disabled = false; toast('No se pudo guardar: ' + (er.message || er)); }
    }
  });
}
async function renderSalida(id) {
  const gen = S.gen = (S.gen || 0) + 1;   // si llegan varios pintados seguidos (una foto, un punto…), solo vale el último
  const s = await db.get('salidas', id), root = $('#v-salida');
  const [hs0, zonas] = [await db.list('hallazgos'), await db.list('zonas')];
  if (gen !== S.gen) return;
  if (S.mini) { S.mini.remove(); S.mini = null; }
  if (S.unlive) { S.unlive(); S.unlive = null; } if (S.unme) { S.unme(); S.unme = null; } clearInterval(S.tick);
  if (!s) { root.innerHTML = '<div class="pad"><a class="back" href="#salidas">‹ Salidas</a><div class="empty">Esta salida no existe.</div></div>'; return; }
  const hs = hs0.filter(h => h.salidaId === id).sort((a, b) => a.ts - b.ts);
  const zn = zid => (zonas.find(z => z.id === zid) || {}).nombre || '—';
  const porZona = {}; hs.forEach(h => { if (h.zonaId) porZona[h.zonaId] = (porZona[h.zonaId] || 0) + 1; });
  const zids = [...new Set([...(s.zonaIds || []), ...Object.keys(porZona)])].filter(zid => zonas.some(z => z.id === zid));
  const auto = mejorZonaId(hs), mejor = s.zonaMejorId || auto, pend = hs.filter(h => h.identificacion !== 'confirmada').length;
  const curso = s.estado === 'en_curso', graba = curso && (tr.tiene(s) ? !!tr.activo(s) : s.grabar !== false), cos = s.fotosCosecha || [];
  const live = () => trk.activo() === id ? { ...s, track: trk.puntos() } : s;
  /* spots en el orden en que se recorrieron (por la hora del primer hallazgo) */
  const t0 = zid => Math.min(Infinity, ...hs.filter(h => h.zonaId === zid).map(h => h.ts));
  /* si lo has ordenado a mano (ordenSpots), manda ese orden; los spots nuevos van al final */
  const auto0 = zids.slice().sort((a, b) => t0(a) - t0(b)), man = (s.ordenSpots || []).filter(z => zids.includes(z));
  const orden = man.length ? [...man, ...auto0.filter(z => !man.includes(z))] : auto0, ordenando = S.ordenando === id;
  const tramo = zid => { const ts = hs.filter(h => h.zonaId === zid).map(h => h.ts); if (!ts.length) return ''; const a = hhmm(Math.min(...ts)), b = hhmm(Math.max(...ts)); return a === b ? a : a + '–' + b; };
  const chips = zid => { const g = {}; hs.filter(h => h.zonaId === zid).forEach(h => { const k = h.especieId || 'x:' + norm(h.especieTxt); (g[k] = g[k] || { h, n: 0 }).n++; });
    const l = Object.values(g); return l.length ? '<div class="echs">' + l.map(r => { const e = cat.byId(r.h.especieId); return '<button class="ech" ' + (e ? 'data-e="' + e.id + '"' : 'data-h="' + r.h.id + '"') + '>' + mini(e) + '<span>' + esc(nombreCorto(r.h)) + (r.n > 1 ? ' <em>×' + r.n + '</em>' : '') + '</span></button>'; }).join('') + '</div>' : '<p class="mut sm" style="margin:4px 0 0">Sin especies anotadas</p>'; };
  const nEsp = especiesDe(hs).length;
  const tab = S.sdTab && S.sdTab.id === id ? S.sdTab.t : 'spots', tieneTrk = (live().track || []).length > 1;
  const tAct = tr.activo(s), zonasS = zon.zonasDeSalida(s, hs, zonas);
  const pSpots = zonasHTML(s, zonasS) + (orden.length ? '<div class="tline">' + orden.map((zid, i) => { const z = zonas.find(x => x.id === zid), n = hs.filter(h => h.zonaId === zid).length;
      return '<div class="tl"><span class="tn">' + (i + 1) + '</span><div class="tc"><div class="th"><div><b>' + esc(z.nombre) + '</b><small>' + [tramo(zid), n ? plural(n, 'hallazgo', 'hallazgos') : ''].filter(Boolean).join(' · ') + '</small></div>' + (ordenando ? '<span class="ord-b"><button class="btn sm" data-up="' + i + '"' + (i ? '' : ' disabled') + ' aria-label="Subir">↑</button><button class="btn sm" data-dn="' + i + '"' + (i < orden.length - 1 ? '' : ' disabled') + ' aria-label="Bajar">↓</button></span>' : '<button class="btn sm" data-sa="' + zid + '">＋ Especie</button>') + '</div>' + chips(zid) + '</div></div>'; }).join('') + '</div>'
      : '<div class="sv-empty">' + I.flag + '<div><b>Aún sin spots.</b> ' + (curso ? 'Cuando llegues a un sitio interesante pulsa «Spot aquí».' : 'Añade los sitios por los que pasaste.') + '</div></div>') + '<div class="row">' + (orden.length > 1 ? (ordenando ? '<button class="btn" id="sd-inv">⇅ Invertir orden</button><button class="btn p" id="sd-ordok">Listo</button>' : '<button class="btn" id="sd-ord">⇅ Cambiar orden</button>') : '') + (ordenando ? '' : '<button class="btn" id="sd-addspot">＋ Añadir spot a la salida</button>') + '</div>';
  const pHall = hs.length ? hs.map(h => { const e = cat.byId(h.especieId); return '<button class="item" data-h="' + h.id + '">' + (e ? fi.avatar(e) : '<span class="dot" style="--c:' + (IDENT[h.identificacion] || IDENT.sin_identificar).color + '"></span>') + '<div class="t"><b>' + esc(nombreCorto(h)) + '</b><small>' + hhmm(h.ts) + (h.zonaId ? ' · ' + esc(zn(h.zonaId)) : '') + (h.cantidad ? ' · ' + esc(h.cantidad) : '') + ' · ' + (IDENT[h.identificacion] || IDENT.sin_identificar).label + '</small></div>' + I.chev + '</button>'; }).join('') + (mejor ? '<p class="mut sm">Donde más hubo: <b>' + esc(zn(mejor)) + '</b></p>' : '') : '<div class="empty">Sin hallazgos todavía.</div>';
  const pFotos = '<div class="cosecha"><b>Lo que me llevé</b><div class="gal" id="sd-cos">' + (cos.length ? galHTML(cos, 'fotosCosecha') : '') + '</div>' + (cos.length ? '' : '<p>Al llegar a casa, una foto de todo lo recogido.</p>') + '<div class="row"><button class="btn p" id="sd-cos-add">Añadir foto de lo recogido</button></div>' +
    '<label class="l">Total recogido</label><input type="text" id="sd-tot" value="' + esc(s.totalTxt) + '" placeholder="p. ej. ≈2 kg"></div>' +
    '<label class="l">Otras fotos de la salida</label><div class="gal" id="sd-gal">' + galHTML(s.fotos || [], 'fotos') + '</div><div class="row"><button class="btn" id="sd-foto">Añadir foto</button></div>';
  const dnE = e => '<div class="dn" data-dn="' + e.id + '"><div class="dn-h"><span class="tag" style="--c:' + (e.tipo === 'sin_setas' ? '#e5484d' : '#4cc3d9') + '">' + (e.tipo === 'sin_setas' ? 'Aquí no hay setas' : 'Nota') + '</span><small>' + hhmm(e.ts) + (e.zonaId ? ' · ' + esc(zn(e.zonaId)) : '') + '</small><button class="btn d sm" data-dd="' + e.id + '">Quitar</button></div>' +
    (e.audios || []).map(a => '<audio controls preload="none" data-blob="' + a + '"></audio>').join('') + '<textarea data-dt="' + e.id + '" placeholder="Qué pasó y por qué crees que fue así">' + esc(e.texto || '') + '</textarea></div>';
  const pDiario = '<p class="mut sm" style="margin:2px 0 10px">Habla con calma: qué ves, por qué crees que hay o no hay setas aquí, qué pasó antes (lluvia, helada, gente). Se transcribe solo y queda guardado con la hora y el spot. En casa lo miramos juntos.</p><div class="row"><button class="btn p" id="sd-voz">' + I.mic + ' Nueva nota de voz</button></div>' +
    ((s.diario || []).length ? (s.diario || []).slice().sort((a, b) => b.ts - a.ts).map(dnE).join('') : '<div class="sv-empty">' + I.mic + '<div><b>Sin notas todavía.</b> Por ejemplo: «Aquí no hay setas: lleva una semana sin llover».</div></div>');
  const pMas = '<label class="l" style="margin-top:4px">Dónde hubo más</label><select id="sd-mej"><option value="">' + (auto ? 'Automático: ' + esc(zn(auto)) : 'Automático') + '</option>' + zonas.filter(z => porZona[z.id] || z.id === s.zonaMejorId).map(z => '<option value="' + z.id + '"' + (s.zonaMejorId === z.id ? ' selected' : '') + '>' + esc(z.nombre) + ' (' + (porZona[z.id] || 0) + ')</option>').join('') + '</select>' +
    '<label class="l">Recorrido</label><div class="card trk-c"><div class="kv2"><div><b id="sd-km">' + kmTxt(live()) + '</b><span>distancia</span></div><div><b id="sd-dur">' + durTxt(s) + '</b><span>duración</span></div></div>' +
    '<p class="mut sm">' + (tieneTrk ? 'Se ve en el mapa de arriba y en los spots que visitaste.' : 'Opcional. Puedes importar el GPX de Wikiloc al volver.') + '</p>' +
    '<div class="row"><button class="btn" id="sd-gpxin">Importar GPX (Wikiloc)</button>' + (hs.length || tieneTrk ? '<button class="btn" id="sd-gpx">Exportar GPX</button>' : '') + '</div>' +
    (curso ? '<div class="rec ' + (graba ? 'on' : '') + '" style="margin-top:10px"><span class="rdot"></span><div class="t"><b>' + (graba ? 'Grabando el recorrido' : tieneTrk ? 'Recorrido en pausa' : 'Grabar con el GPS del móvil') + '</b><small>' + (graba ? (trk.nativo() ? 'Puedes bloquear el móvil: sigo grabando (verás un aviso fijo en la barra).' : 'Mantén la app abierta: si el móvil bloquea la pantalla puede dejar de grabar.') : (tr.tiene(s) ? 'Entre zonas no se graba: empieza la siguiente zona y te sigo.' : 'Apagado: gasta batería y no hace falta si usas Wikiloc.')) + '</small></div>' + (tr.tiene(s) ? '' : '<button class="btn" id="sd-pau">' + (graba ? 'Pausar' : (tieneTrk ? 'Reanudar' : 'Grabar')) + '</button>') + '</div>' +
      (graba && trk.pantallaSoportada() && !trk.nativo() ? '<div class="rec"><div class="t"><b>Pantalla encendida</b><small>Evita que se apague mientras andas. Gasta más batería.</small></div><button class="btn' + (trk.pantallaOn() ? ' p' : '') + '" id="sd-wake">' + (trk.pantallaOn() ? 'Activada' : 'Activar') + '</button></div>' : '') : '') + '</div>' +
    '<div class="row" style="margin-top:18px">' + (curso ? '' : '<button class="btn" id="sd-reab">Reabrir salida</button>') + '<button class="btn d" id="sd-del">Borrar salida</button></div>';
  /* ---------- pantalla de la salida: resumen corto + pantallas de detalle ---------- */
  const sub = S.sub || '', clave = S.key || '', raiz = '#salida/' + id;
  const volver = def => { const p = S.prevHash || ''; return p.startsWith(raiz) && p !== location.hash ? p : def; };
  const keyH = h => h.especieId || (h.especieTxt ? 'x:' + norm(h.especieTxt) : 'u:' + h.id);
  const grupos = (() => { const g = new Map(); hs.forEach(h => { const k = keyH(h); if (!g.has(k)) g.set(k, { k, hs: [], e: cat.byId(h.especieId) }); g.get(k).hs.push(h); }); return [...g.values()].sort((a, b) => b.hs.length - a.hs.length || a.hs[0].ts - b.hs[0].ts); })();
  const fotosG = g => g.hs.flatMap(h => h.fotos || []);
  const portada = g => { const f = fotosG(g)[0], r = g.e && g.e.fotos && g.e.fotos[0]; return f ? '<img data-blob="' + f + '" alt="">' : r ? '<img class="ph" src="' + esc(fi.fotoURL(r, 250)) + '" alt="" loading="lazy" crossorigin="anonymous">' : '<span class="ph0">?</span>'; };
  const cardG = g => '<a class="spc" style="--c:' + colorEsp(g.e) + '" href="' + raiz + '/especie/' + encodeURIComponent(g.k) + '"><span class="spf">' + portada(g) + (fotosG(g).length ? '<i class="spn">' + I.foto + fotosG(g).length + '</i>' : '') + '</span><b>' + esc(nombreCorto(g.hs[0])) + '</b><small>' + plural(g.hs.length, 'hallazgo', 'hallazgos') + '</small></a>';
  /* todas las fotos de la salida: las de cada hallazgo (las tuyas de cada seta), las de la salida y las de lo recogido */
  const capH = h => nombreCorto(h) + ' · ' + hhmm(h.ts) + (h.zonaId ? ' · ' + zn(h.zonaId) : '');
  const fotosAll = [...hs.slice().sort((a, b) => b.ts - a.ts).flatMap(h => (h.fotos || []).map(b => ({ b, k: 'h', h: h.id, g: keyH(h), cap: capH(h) }))),
    ...(s.fotos || []).map(b => ({ b, k: 'fotos', cap: 'Foto de la salida' })), ...cos.map(b => ({ b, k: 'fotosCosecha', cap: 'Lo que me llevé' }))];
  const ffil = S.fFoto && S.fFoto.id === id ? S.fFoto.f : 'todas';
  const filtraF = f => fotosAll.filter(x => f === 'todas' || (f === 'setas' && x.k === 'h') || (f === 'recogido' && x.k === 'fotosCosecha') || (f === 'otras' && x.k === 'fotos') || (f.startsWith('sp:') && x.g === f.slice(3)));
  let vista = fotosAll;
  const thumbs = (l, max) => l.slice(0, max).map((x, i) => '<button class="fth" data-vi="' + i + '"><img data-blob="' + x.b + '" alt=""></button>').join('');
  const filaH = h => { const e = cat.byId(h.especieId), f = (h.fotos || [])[0], idn = IDENT[h.identificacion] || IDENT.sin_identificar;
    return '<button class="rg" data-h="' + h.id + '"><span class="rgt">' + (f ? '<img data-blob="' + f + '" alt="">' : e ? fi.avatar(e) : '<span class="dot" style="--c:' + idn.color + '"></span>') + '</span><div class="t"><b>' + esc(nombreCorto(h)) + '</b><small>' + hhmm(h.ts) + (h.cantidad ? ' · ' + esc(h.cantidad) : '') + ' · ' + idn.label + '</small></div>' + ((h.fotos || []).length ? '<span class="rgn">' + I.foto + h.fotos.length + '</span>' : '') + I.chev + '</button>'; };
  const volverHTML = (def, txt) => '<a class="back" href="' + volver(def) + '">‹ ' + txt + '</a>';
  const zonasPag = tr.tiene(s) ? zonasS : orden.map((zid, i) => ({ id: zid, i, nombre: zn(zid), hhs: hs.filter(h => h.zonaId === zid), legado: true, spot: true, tramo: null, anillos: [], circulo: null, seg: 0, m: 0, en: false }));
  const zonaSel = sub === 'zona' ? zonasPag.find(z => z.id === clave) : null;
  const zcard = z => '<a class="zcard" style="--c:' + zon.color(z.i) + '" href="' + raiz + '/zona/' + z.id + '"><i class="zd"></i><div class="t"><b>' + (z.i + 1) + ' · ' + esc(z.nombre) + (z.en ? ' <em class="zlive">en marcha</em>' : '') + '</b><small>' +
    (z.tramo ? hhmm(z.tramo.ini) + (z.en ? '' : '–' + hhmm(z.tramo.fin)) + ' · ' + trk.fmtDur(z.seg) + (z.m ? ' · ' + trk.fmtKm(z.m) : '') : (tramo(z.id) || 'sin hora')) + '</small>' + (z.hhs.length ? avatares(z.hhs, 6) : '') + '</div>' + I.chev + '</a>';
  const fila = (href, ic, t, d, n) => '<a class="navrow" href="' + href + '"><span class="nri">' + ic + '</span><div class="t"><b>' + t + '</b><small>' + d + '</small></div>' + (n !== '' ? '<em>' + n + '</em>' : '') + I.chev + '</a>';
  const bl = (t, ver, cuerpo) => '<section class="bl"><div class="bl-h"><b>' + t + '</b>' + (ver || '') + '</div>' + cuerpo + '</section>';
  const verMas = (href, n, extra) => '<a class="bl-m" href="' + href + '">' + (extra || 'Ver todas') + (n ? ' (' + n + ')' : '') + ' ›</a>';
  const mapaHero = '<div class="hero-m"><div class="smap' + (sub ? '' : ' big') + '" id="smap"></div>' + (curso && !sub ? '<span class="live"><i></i>En curso · ' + durTxt(s).replace('—', 'recién empezada') + (tieneTrk ? ' · <b id="sd-km">' + kmTxt(live()) + '</b>' : '') + '</span>' : '') + '</div>';
  let cuerpo = '';
  if (!sub) {
    const quick = curso ? '<div class="zbar' + (tAct ? ' on' : '') + '">' + (tAct ? '<i class="zd" style="--c:' + zon.color(zonasS.findIndex(z => z.en)) + '"></i><div class="zt"><b>Zona ' + (zonasS.findIndex(z => z.en) + 1) + ' · ' + esc((zonasS.find(z => z.en) || {}).nombre || '') + '</b><small>en marcha · <span id="sd-zdur">' + trk.fmtDur(tr.dur(tAct)) + '</span> · te sigo el recorrido</small></div><button class="btn" id="sd-zcam">Cambiar de zona</button>'
        : '<i class="zd"></i><div class="zt"><b>' + (tr.tiene(s) ? 'Entre zonas' : 'Sin zona en marcha') + '</b><small>Sin contar tiempo ni grabar el recorrido</small></div><button class="btn p" id="sd-zini">Empezar zona</button>') + '</div>' +
      '<div class="quick"><button class="qb p" id="sd-mk">' + I.plus + '<span><b>Especie aquí</b><small>con tu GPS</small></span></button><button class="qb" id="sd-sp">' + I.flag + '<span><b>Spot aquí</b><small>nuevo sitio</small></span></button><button class="qb w" id="sd-vozq">' + I.mic + '<span><b>Nota de voz</b><small>«aquí no hay setas porque…»</small></span></button></div>' : '';
    const pasos = curso && !hs.length && !zids.length ? '<div class="pasos"><div><i>1</i><span><b>Llegas a una zona</b>«Empezar zona»: marca dónde aparcas y te sigo</span></div><div><i>2</i><span><b>Ves una seta</b>«Especie aquí»: foto y nota de voz</span></div><div><i>3</i><span><b>En casa</b>foto de lo recogido y «Terminar»</span></div></div>' : '';
    const kpis = !hs.length && !zids.length ? '' : '<div class="kpis"><div class="stats"><div><b>' + hs.length + '</b><span>hallazgos</span></div><div><b>' + zids.length + '</b><span>spots</span></div><div><b>' + nEsp + '</b><span>especies</span></div><div><b>' + pend + '</b><span>por identificar</span></div></div></div>';
    const bEsp = grupos.length ? bl('Qué has visto', verMas(raiz + '/especies', grupos.length), '<div class="hscroll">' + grupos.slice(0, 8).map(cardG).join('') + (grupos.length > 8 ? '<a class="spc mas" href="' + raiz + '/especies"><span class="spf"><b>+' + (grupos.length - 8) + '</b></span><small>ver todas</small></a>' : '') + '</div>') : (curso ? '' : bl('Qué has visto', '', '<div class="empty">Sin hallazgos en esta salida.</div>'));
    const bZon = zonasPag.length ? bl(tr.tiene(s) ? 'Zonas' : 'Spots', zonasPag.length > 3 ? verMas(raiz + '/zonas', zonasPag.length) : verMas(raiz + '/zonas', 0, 'Editar'), '<div class="zcards">' + zonasPag.slice(0, 3).map(zcard).join('') + '</div>') : '';
    const bFot = fotosAll.length ? bl('Fotos', verMas(raiz + '/fotos', fotosAll.length), '<div class="fstrip">' + thumbs(fotosAll, 9) + (fotosAll.length > 9 ? '<a class="fth mas" href="' + raiz + '/fotos"><b>+' + (fotosAll.length - 9) + '</b></a>' : '') + '</div>') : '';
    const entradas = '<div class="navrows">' + fila(raiz + '/registro', I.libro, 'Registro', hs.length ? 'Hora a hora, zona por zona' : 'Aún sin hallazgos', hs.length) + fila(raiz + '/diario', I.mic, 'Diario', (s.diario || []).length ? 'Tus notas de voz' : 'Notas de voz de la salida', (s.diario || []).length || '') +
      fila(raiz + '/fotos', I.foto, 'Fotos', fotosAll.length ? 'Tus fotos, filtradas por seta' : 'Añade fotos de la salida', fotosAll.length || '') + fila(raiz + '/mas', I.edit, 'Más', 'Total recogido, recorrido, GPX', '') + '</div>';
    cuerpo = '<a class="back" href="#salidas">‹ Salidas</a>' + mapaHero +
      '<div class="sd-hd"><div class="sd-tt"><input type="text" id="sd-tit" class="tit" value="' + esc(s.titulo) + '" placeholder="Ponle un título"><div class="sd-date">' + esc(fecha(s.fecha)) + (curso ? '' : ' · terminada') + '</div></div>' + (curso ? '<button class="btn p" id="sd-fin">Terminar</button>' : '') + '</div>' +
      pasos + kpis + quick + bEsp + bZon + bFot + entradas;
  } else if (sub === 'especies') {
    cuerpo = volverHTML(raiz, 'Salida') + '<h2 class="sp-t">Especies de la salida</h2><p class="mut sm sp-s">' + plural(grupos.length, 'especie', 'especies') + ' · ' + plural(hs.length, 'hallazgo', 'hallazgos') + '. Toca una para ver tus fotos y dónde la encontraste.</p><div class="spgrid">' + grupos.map(cardG).join('') + '</div>' + (grupos.length ? '' : '<div class="empty">Sin hallazgos todavía.</div>');
  } else if (sub === 'especie') {
    const g = grupos.find(x => x.k === clave); vista = g ? fotosAll.filter(x => x.g === g.k) : [];
    if (!g) cuerpo = volverHTML(raiz + '/especies', 'Especies') + '<div class="empty">Esta especie ya no está en la salida.</div>';
    else {
      const zs = [...new Set(g.hs.map(h => h.zonaId).filter(Boolean))].map(zn), ts = g.hs.map(h => h.ts), ia = (g.hs.find(h => (h.iaSugerencias || []).length) || {}).iaSugerencias || [];
      cuerpo = volverHTML(raiz + '/especies', 'Especies') + '<div class="esp-h" style="--c:' + colorEsp(g.e) + '"><h2 class="sp-t">' + esc(nombreCorto(g.hs[0])) + '</h2>' + (g.e ? '<small class="sci">' + esc(g.e.nombreCientifico) + '</small>' : '') + '<div class="chs">' + (g.e ? tag(cat.vista(g.e)) : '<span class="tag" style="--c:#9aa5a1">Sin identificar</span>') + '</div></div>' +
        '<div class="stats"><div><b>' + g.hs.length + '</b><span>hallazgos</span></div><div><b>' + fotosG(g).length + '</b><span>fotos</span></div><div><b>' + hhmm(Math.min(...ts)) + '</b><span>primera</span></div><div><b>' + (g.hs.length > 1 ? hhmm(Math.max(...ts)) : '—') + '</b><span>última</span></div></div>' +
        (vista.length ? '<div class="gcar">' + thumbs(vista, 40) + '</div>' : '<div class="sv-empty">' + I.foto + '<div><b>Sin fotos tuyas.</b> ' + (g.e && g.e.fotos && g.e.fotos[0] ? 'Esta es una foto de referencia.' : '') + '</div></div>' + (g.e && g.e.fotos && g.e.fotos[0] ? '<div class="ref-f"><img class="ph" src="' + esc(fi.fotoURL(g.e.fotos[0], 500)) + '" alt="" loading="lazy" crossorigin="anonymous"></div>' : '')) +
        (zs.length ? '<p class="mut sm">Zonas: <b>' + zs.map(esc).join(', ') + '</b></p>' : '') +
        '<label class="l">Cada hallazgo</label>' + g.hs.map(filaH).join('') +
        (ia.length ? '<label class="l">Lo que sugirió la IA</label><div class="card">' + ia.slice(0, 4).map(c => '<div class="iaf"><span>' + esc(c.nombre || c.nombreCientifico || c.id || '') + '</span><b>' + (c.pct != null ? c.pct + ' %' : c.confianza != null ? Math.round(c.confianza * 100) + ' %' : '') + '</b></div>').join('') + '</div>' : '') +
        (g.e ? '<div class="row" style="margin-top:12px"><button class="btn p" data-e="' + g.e.id + '">Ver la ficha de la especie</button></div>' : '');
    }
  } else if (sub === 'registro') {
    const asig = new Set(), grp = zonasPag.map(z => { z.hhs.forEach(h => asig.add(h.id)); return { t: (z.i + 1) + ' · ' + z.nombre, d: z.tramo ? hhmm(z.tramo.ini) + (z.en ? ' · en marcha' : '–' + hhmm(z.tramo.fin)) : tramo(z.id), c: zon.color(z.i), hs: z.hhs.slice().sort((a, b) => a.ts - b.ts) }; });
    const resto = hs.filter(h => !asig.has(h.id)); if (resto.length) grp.push({ t: tr.tiene(s) ? 'Entre zonas' : 'Sin spot', d: '', c: '#8a9a95', hs: resto });
    cuerpo = volverHTML(raiz, 'Salida') + '<h2 class="sp-t">Registro</h2><p class="mut sm sp-s">Hora a hora. Toca un hallazgo para ver sus fotos y datos.</p>' +
      (grp.filter(x => x.hs.length).map(x => '<div class="rgg" style="--c:' + x.c + '"><div class="rgh"><i class="zd"></i><b>' + esc(x.t) + '</b><small>' + esc(x.d || '') + '</small></div>' + x.hs.map(filaH).join('') + '</div>').join('') || '<div class="empty">Sin hallazgos todavía.</div>') +
      (mejor ? '<p class="mut sm">Donde más hubo: <b>' + esc(zn(mejor)) + '</b></p>' : '');
  } else if (sub === 'zonas') {
    cuerpo = volverHTML(raiz, 'Salida') + '<h2 class="sp-t">' + (tr.tiene(s) ? 'Zonas y spots' : 'Spots') + '</h2>' + pSpots;
  } else if (sub === 'zona') {
    if (!zonaSel) cuerpo = volverHTML(raiz, 'Salida') + '<div class="empty">Esa zona no existe.</div>';
    else {
      const z = zonaSel, spIr = zonas.find(x => x.id === (z.spotId || z.id)), gz = []; z.hhs.forEach(h => { const k = keyH(h); let g = gz.find(x => x.k === k); if (!g) gz.push(g = { k, hs: [], e: cat.byId(h.especieId) }); g.hs.push(h); }); vista = fotosAll.filter(x => x.h && z.hhs.some(h => h.id === x.h));
      cuerpo = volverHTML(raiz, 'Salida') + mapaHero + '<h2 class="sp-t" style="--c:' + zon.color(z.i) + '"><i class="zd"></i> ' + (z.i + 1) + ' · ' + esc(z.nombre) + (z.en ? ' <em class="zlive">en marcha</em>' : '') + '</h2>' +
        '<div class="stats"><div><b>' + (z.tramo ? trk.fmtDur(z.seg) : '—') + '</b><span>tiempo</span></div><div><b>' + (z.m ? trk.fmtKm(z.m) : '—') + '</b><span>recorrido</span></div><div><b>' + z.hhs.length + '</b><span>hallazgos</span></div><div><b>' + gz.length + '</b><span>especies</span></div></div>' +
        (gz.length ? bl('Qué has visto aquí', '', '<div class="hscroll">' + gz.map(cardG).join('') + '</div>') : '') +
        (vista.length ? bl('Fotos de esta zona', '', '<div class="fstrip">' + thumbs(vista, 12) + '</div>') : '') +
        (z.hhs.length ? '<label class="l">Registro de la zona</label>' + z.hhs.slice().sort((a, b) => a.ts - b.ts).map(filaH).join('') : '<div class="empty">Sin hallazgos en esta zona.</div>') +
        (spIr ? '<div class="row" style="margin-top:12px"><button class="btn" data-spot="' + spIr.id + '">Ver el spot en el mapa</button>' + (spIr.lat != null ? '<a class="btn" target="_blank" rel="noopener" href="' + rutaURL(spIr) + '">' + I.route + 'Cómo llegar</a>' : '') + '</div>' : '');
    }
  } else if (sub === 'fotos') {
    vista = filtraF(ffil); const sps = grupos.filter(g => fotosG(g).length), chipF = (f, t) => '<button class="opt' + (ffil === f ? ' on' : '') + '" data-ff="' + f + '">' + t + '</button>';
    cuerpo = volverHTML(raiz, 'Salida') + '<h2 class="sp-t">Fotos</h2><div class="chips fch">' + chipF('todas', 'Todas ' + fotosAll.length) + (fotosAll.some(x => x.k === 'h') ? chipF('setas', 'Mis setas') : '') + (cos.length ? chipF('recogido', 'Lo recogido') : '') + ((s.fotos || []).length ? chipF('otras', 'Otras') : '') + sps.map(g => chipF('sp:' + g.k, esc(nombreCorto(g.hs[0])))).join('') + '</div>' +
      (vista.length ? '<div class="fgrid">' + thumbs(vista, 400) + '</div>' : '<div class="empty">Sin fotos aquí todavía.</div>') +
      '<div class="row" style="margin-top:14px"><button class="btn p" id="sd-cos-add">Foto de lo recogido</button><button class="btn" id="sd-foto">Otra foto</button></div>';
  } else if (sub === 'diario') {
    cuerpo = volverHTML(raiz, 'Salida') + '<h2 class="sp-t">Diario</h2>' + pDiario;
  } else {
    cuerpo = volverHTML(raiz, 'Salida') + '<h2 class="sp-t">Más</h2><label class="l" style="margin-top:4px">Total recogido</label><input type="text" id="sd-tot" value="' + esc(s.totalTxt) + '" placeholder="p. ej. ≈2 kg"><label class="l">Notas</label><p class="mut sm">' + (s.notas ? esc(s.notas) : 'Sin notas de la salida.') + '</p>' + pMas;
  }
  root.innerHTML = '<div class="pad sal-pg" data-sub="' + (sub || 'resumen') + '">' + cuerpo + '</div>';
  { const k = id + '/' + sub + '/' + clave; if (S.sdScroll !== k) root.scrollTop = 0; S.sdScroll = k; }
  hydrate(root);
  /* minimapa: recorrido + hallazgos (en la pantalla de una zona, solo lo de esa zona) */
  let ls = [], pintar = () => { };
  if ($('#smap', root)) {
    const mz = zonaSel, hsM = mz ? mz.hhs : hs, zonasM = mz ? [mz] : zonasS, trackDe = () => mz && mz.tramo ? tr.puntos(mz.tramo, live().track) : live().track;
    S.mini = createMap('smap', { zoom: 10 }); const capa = L.layerGroup().addTo(S.mini);
    pintar = () => { capa.clearLayers(); trazo(trackDe()).addTo(capa); };
    pintar(); trk.lineas(trackDe()).forEach(l => l.forEach(p => ls.push([p[0], p[1]])));
    hsM.forEach(h => { pinH(h, { interactive: false }).addTo(S.mini); ls.push([h.lat, h.lon]); });
    zonasM.forEach(z => { const g = dibujarZona(z, S.mini); if (g) { const bb = g.getBounds(); ls.push([bb.getSouth(), bb.getWest()], [bb.getNorth(), bb.getEast()]); } });
    (mz ? (mz.spot ? [mz.id] : []) : orden).forEach((zid, i) => { const z = zonas.find(x => x.id === zid); if (!z || z.lat == null) return; L.marker([z.lat, z.lon], { interactive: false, zIndexOffset: 500, icon: L.divIcon({ className: 'tnm', html: '<b>' + (mz ? 1 : i + 1) + '</b>', iconSize: [24, 24], iconAnchor: [12, 12] }) }).addTo(S.mini); ls.push([z.lat, z.lon]); });
    if (!ls.length) { const f = geo.fix(); if (f) { S.mini.setView([f.lat, f.lon], 15); L.marker([f.lat, f.lon], { interactive: false, icon: L.divIcon({ className: 'me', html: '<i></i>', iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(S.mini); } }
    if (ls.length) S.mini.fitBounds(ls, { padding: [30, 30], maxZoom: 17, animate: false });
    /* salida en marcha: dónde estás ahora (punto azul que se mueve) */
    if (curso && !mz || (mz && mz.en)) {
      const yo = L.marker([0, 0], { interactive: false, zIndexOffset: 900, icon: L.divIcon({ className: 'me', html: '<i></i>', iconSize: [22, 22], iconAnchor: [11, 11] }) });
      const mover = f => { if (!f || !S.mini) return; yo.setLatLng([f.lat, f.lon]); if (!S.mini.hasLayer(yo)) { yo.addTo(S.mini); if (!S.mini.getBounds().contains([f.lat, f.lon])) S.mini.setView([f.lat, f.lon], Math.max(S.mini.getZoom(), 16), { animate: false }); } };
      mover(geo.fix()); S.unme = geo.onFix(mover);
    }
  }
  if (trk.activo() === id) S.unlive = trk.onAdd(() => { if (S.view !== 'salida' || S.arg !== id || !S.mini) return; pintar(); const k = $('#sd-km'); if (k) k.textContent = kmTxt(live()); });
  if (curso) S.tick = setInterval(() => { const d = $('#sd-dur'); if (S.view === 'salida' && S.arg === id && d) d.textContent = durTxt(s); const zd = $('#sd-zdur'); if (zd && tAct) zd.textContent = trk.fmtDur(tr.dur(tAct)); }, 30000);
  const on = (sel, f) => { const el = $(sel, root); if (el) el.onchange = f; };
  on('#sd-tit', e => db.patch('salidas', id, { titulo: e.target.value.trim() }));
  on('#sd-tot', e => db.patch('salidas', id, { totalTxt: e.target.value.trim() }));
  on('#sd-mej', e => db.patch('salidas', id, { zonaMejorId: e.target.value }));
  root.addEventListener('change', async e => { const k = e.target.dataset && e.target.dataset.dt; if (!k) return; const cur = await db.get('salidas', id); await db.patch('salidas', id, { diario: (cur.diario || []).map(x => x.id === k ? { ...x, texto: e.target.value.trim() } : x) }); });
  root.onclick = async ev => {
    const im = ev.target.closest('img[data-blob]'); if (im && im.dataset.k) { verFoto(id, im.dataset.k, im.dataset.blob); return; }
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.tb) { S.sdTab = { id, t: t.dataset.tb }; $$('.tabs button', root).forEach(b => b.classList.toggle('on', b === t)); $$('.tabp', root).forEach(p => { p.hidden = p.dataset.p !== t.dataset.tb; }); }
    else if (t.dataset.h) verHallazgo(t.dataset.h);
    else if (t.dataset.e) abrirFicha(t.dataset.e);
    else if (t.dataset.vi != null) abrirVisor(vista, +t.dataset.vi, id);
    else if (t.dataset.ff) { S.fFoto = { id, f: t.dataset.ff }; renderSalida(id); }
    else if (t.dataset.spot) { location.hash = '#mapa'; setTimeout(() => verSpot(t.dataset.spot), 400); }
    else if (t.id === 'sd-mk') marcar();
    else if (t.id === 'sd-voz' || t.id === 'sd-vozq') abrirNotaSalida(id);
    else if (t.dataset.dd) { const cur = await db.get('salidas', id); await db.patch('salidas', id, { diario: (cur.diario || []).filter(x => x.id !== t.dataset.dd) }); S.sdTab = { id, t: 'diario' }; renderSalida(id); }
    else if (t.id === 'sd-sp') editarSpot(null, { salida: id });
    else if (t.id === 'sd-zini') editarSpot(null, { salida: id, zona: true });
    else if (t.id === 'sd-zcam') { await trk.stop(); const cur = await db.get('salidas', id); await db.patch('salidas', id, { tramos: tr.cerrar(cur), grabar: false }); toast('Zona cerrada: entre zonas no cuento tiempo'); syn.auto(); renderSalida(id); }
    else if (t.id === 'sd-gpxin') importarGPX(id);
    else if (t.id === 'sd-ord') { S.ordenando = id; renderSalida(id); }
    else if (t.id === 'sd-ordok') { S.ordenando = null; renderSalida(id); }
    else if (t.id === 'sd-inv' || t.dataset.up || t.dataset.dn) {
      const o = orden.slice();
      if (t.id === 'sd-inv') o.reverse(); else { const i = +(t.dataset.up || t.dataset.dn), j = t.dataset.up ? i - 1 : i + 1; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; }
      db.patch('salidas', id, { ordenSpots: o }).then(() => renderSalida(id));
    }
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
  $('#tf-ok', sh).onclick = async () => { await trk.stop(); const cur = await db.get('salidas', s.id); await db.patch('salidas', s.id, { ...(tr.tiene(cur) ? { tramos: tr.cerrar(cur) } : {}), estado: 'terminada', fin: Date.now(), totalTxt: $('#tf-tot', sh).value.trim(), notas: $('#tf-nota', sh).value.trim(), zonaMejorId: s.zonaMejorId || mejor || '' }); closeSheet(); toast('Salida terminada'); syn.auto(1500); };
}
/* Visor de fotos a pantalla completa: se desliza de una a otra, con el pie (seta · hora · zona) y acceso al hallazgo */
function abrirVisor(items, i, sid) {
  if (!items || !items.length) return;
  const v = document.createElement('div'); v.className = 'visor'; v.id = 'visor';
  v.innerHTML = '<div class="vs-top"><span id="vs-n"></span><button class="vs-x" aria-label="Cerrar">' + I.close + '</button></div><div class="vs-tr">' + items.map((it, k) => '<figure data-k="' + k + '"><img data-blob="' + it.b + '" alt=""><figcaption><b>' + esc(it.cap) + '</b><span>' +
    (it.h ? '<button class="btn sm" data-vh="' + it.h + '">Ver hallazgo</button>' : '<button class="btn d sm" data-vq="' + it.k + '|' + it.b + '">Quitar</button>') + '</span></figcaption></figure>').join('') + '</div>';
  document.body.appendChild(v); hydrate(v);
  const tr_ = v.querySelector('.vs-tr'), n = v.querySelector('#vs-n'), upd = () => { n.textContent = (Math.round(tr_.scrollLeft / Math.max(1, tr_.clientWidth)) + 1) + ' / ' + items.length; };
  tr_.scrollLeft = i * tr_.clientWidth; tr_.onscroll = upd; upd();
  const cerrar = () => { v.remove(); document.removeEventListener('keydown', tecla); }, tecla = e => { if (e.key === 'Escape') cerrar(); };
  document.addEventListener('keydown', tecla);
  v.onclick = async e => {
    if (e.target.closest('.vs-x') || e.target === tr_) return cerrar();
    const h = e.target.closest('[data-vh]'); if (h) { cerrar(); return verHallazgo(h.dataset.vh); }
    const q = e.target.closest('[data-vq]'); if (q) { const [k, b] = q.dataset.vq.split('|'), cur = await db.get('salidas', sid); if (cur) await db.patch('salidas', sid, { [k]: (cur[k] || []).filter(x => x !== b) }); cerrar(); toast('Foto quitada'); syn.auto(); }
  };
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
  $('#lec-w', root).innerHTML = leccionHTML(lecciones(enc));
  $('#col-w', root).innerHTML = colCabecera(enc) + enTemporada(enc);
  if (S.view === 'setas') listaSetas();
}
/* ---------- Colección al estilo AveDex: contador, barra por rareza y «En temporada» ---------- */
const mensual = e => (((e.temporada || {}).inat || {}).mensual) || [];
/* sale en el mes m si ese mes tiene al menos un cuarto de las citas de su mejor mes (sin datos: no se sabe, no cuenta) */
const saleEn = (e, m) => { const v = mensual(e), mx = Math.max(0, ...v); return mx > 0 && v[m] / mx >= 0.25; };
function colCabecera(enc) {
  const T = cat.todas(), tot = T.length;
  const niv = cat.ORDEN_RAREZA.map(k => { const l = T.filter(e => e.rareza === k); return { k, x: cat.RAREZAS[k], t: l.length, n: l.filter(e => enc.has(e.id)).length }; });
  return '<div class="cx-h"><div class="cx-top"><b class="cx-num">' + enc.size + '</b><span class="cx-lbl">encontradas<small>de ' + tot + ' setas</small></span>' +
    (enc.size ? '<span class="cx-last">' + [...enc.keys()].slice(0, 4).map(id => '<button class="cmini" data-e="' + id + '">' + mini(cat.byId(id)) + '</button>').join('') + '</span>' : '') + '</div>' +
    '<div class="cx-bar">' + niv.map(v => '<i style="--c:' + v.x.color + ';flex:' + v.t + '"><u style="width:' + (v.t ? v.n / v.t * 100 : 0) + '%"></u></i>').join('') + '</div>' +
    '<div class="cx-leg">' + niv.map(v => '<button class="cx-lv" data-rz="' + v.k + '" style="--c:' + v.x.color + '">' + fi.pips(v.x) + '<span>' + v.x.label + '</span><em><b>' + v.n + '</b>/' + v.t + '</em></button>').join('') + '</div></div>';
}
function enTemporada(enc) {
  const mes = new Date().getMonth(), falta = cat.porRareza(cat.todas().filter(e => !enc.has(e.id)));
  const ahora = falta.filter(e => saleEn(e, mes)); if (!falta.length) return '<div class="cx-tmp fin"><b>¡Las tienes todas!</b></div>';
  const hist = MES_C.map((l, m) => falta.filter(e => saleEn(e, m)).length), mx = Math.max(1, ...hist);
  return '<button class="cx-tmp" id="cx-tmp"><span class="cx-tmp-k"><i class="cx-live"></i>En temporada · ' + MES_L[mes] + '<em>Ver ' + I.chev + '</em></span>' +
    '<span class="cx-tmp-m"><span><b class="cx-tmp-n">' + ahora.length + '</b><small>setas que te faltan salen ahora en la costa cantábrica</small></span>' +
    '<span class="cx-histo">' + hist.map((n, m) => '<i class="' + (m === mes ? 'on' : '') + '"><u style="height:' + Math.max(8, Math.round(n / mx * 100)) + '%"></u><b>' + MES_C[m] + '</b></i>').join('') + '</span></span>' +
    (ahora.length ? '<span class="cx-avs">' + ahora.slice(0, 6).map(e => '<span class="cx-av" style="--c:' + cat.rareza(e).color + '">' + mini(e) + '</span>').join('') + (ahora.length > 6 ? '<span class="cx-av mas">+' + (ahora.length - 6) + '</span>' : '') + '</span>' : '') + '</button>';
}
function renderSetas() {
  const root = $('#v-setas');
  if (!$('#q', root)) {
    root.innerHTML = '<div class="pad">' +
      '<div class="sbar"><input type="search" id="q" placeholder="Buscar seta por nombre (es, eu, latín)…" autocomplete="off"><div class="seg ord" id="ord">' + [['rareza', 'Por rareza'], ['peligro', 'Por peligro'], ['col', 'Colecciones'], ['az', 'A–Z']].map(([k, t]) => '<button data-ord="' + k + '">' + t + '</button>').join('') + '</div><div class="chips" id="cl"></div></div>' +
      '<div id="intro-w">' +
      '<div class="learn2"><button class="lc" id="gu-open" style="--c:#e0a458">' + ICO_SETA + '<b>Partes de una seta</b><small>Esquema con nombres</small></button><button class="lc" id="li-open" style="--c:#7ccf8e"><span class="ic">' + lib.CAPS[0].ico + '</span><b>El libro</b><small>Para empezar</small></button><button class="lc" id="ia-open" style="--c:#b48cff"><span class="ic">✨</span><b>Reconocer con IA</b><small>Con 1–3 fotos</small></button></div>' +
      '<div id="col-w"></div><div id="lec-w"></div></div>' +
      '<div class="warn sm2">' + esc(cat.aviso()) + '</div><div id="slist"></div>' +
      '<p class="note" style="margin-top:14px">Catálogo en borrador: ' + cat.todas().length + ' fichas sin revisar por una persona experta. Las comestibles llevan «según fuentes» porque lo dicen Wikipedia y guías divulgativas, no una persona experta: siguen pendientes de revisión. Fotos de Wikimedia Commons con su autoría y licencia en cada ficha.</p></div>';
    $('#q', root).oninput = e => { S.q = e.target.value; root.classList.toggle('busca', !!S.q.trim()); listaSetas(); };
    root.onclick = e => {
      if (e.target.closest('#gu-open')) return abrirGuia('');
      if (e.target.closest('#li-open')) return abrirLibro('');
      if (e.target.closest('#ia-open')) return abrirIA();
      if (e.target.closest('#lec-next')) { S.lecOff = (S.lecOff || 0) + 1; return pintarAprender(); }
      const o = e.target.closest('[data-ord]'); if (o) { S.orden = o.dataset.ord; return listaSetas(); }
      if (e.target.closest('#cx-tmp')) { S.ahora = true; S.orden = 'rareza'; listaSetas(); const l = $('#slist', root); if (l) l.scrollIntoView({ block: 'start' }); return; }
      if (e.target.closest('#cx-quita')) { S.ahora = false; return listaSetas(); }
      const z = e.target.closest('[data-rz]'); if (z) { S.orden = 'rareza'; S.q = ''; $('#q', root).value = ''; root.classList.remove('busca'); listaSetas(); const hh = $('#rz-' + z.dataset.rz, root); if (hh) hh.scrollIntoView({ block: 'start' }); return; }
      const j = e.target.closest('[data-ir]'); if (j) { const h = $('#col-' + j.dataset.ir, root); if (h) h.scrollIntoView({ block: 'start' }); return; }
      const c = e.target.closest('#cl button'); if (c) { if (c.dataset.mias !== undefined) S.mias = !S.mias; else { S.clase = c.dataset.c; if (!S.clase) S.mias = false; } return listaSetas(); }
      const b = e.target.closest('[data-e]'); if (b) abrirFicha(b.dataset.e);
    };
  }
  listaSetas(); pintarAprender();
}
const itemEsp = (e, extra = '') => { const m = S.enc && S.enc.get(e.id), cien = e.nombreCientifico.split(' (')[0], c = corto(e), r = cat.rareza(e);
  return '<button class="item sp' + (m ? ' mia' : '') + '" data-e="' + e.id + '" style="--c:' + cat.CLASES[cat.vista(e)].color + (r ? ';--rc:' + r.color : '') + '" aria-label="' + esc(c) + (r ? ', ' + r.label : '') + (m ? ', encontrada' : '') + '">' + fi.avatar(e) +
    '<i class="cr-n">' + String(cat.numero(e)).padStart(3, '0') + '</i>' + (m ? '<span class="mia-b">✓' + (m.n > 1 ? ' ×' + m.n : '') + '</span>' : '') +
    '<div class="t"><b>' + esc(c) + '</b><small>' + fi.rarezaTag(e, { mini: true }) + '<i>' + esc(cien) + '</i>' + (c === cien ? ' · ' + esc(fi.nombres(e) || e.grupo) : '') + '</small>' + extra + '</div>' + fi.tagEsp(e) + '<i class="cr-rz"></i></button>'; };
function listaSetas() {
  const root = $('#v-setas');
  $('#cl', root).innerHTML = '<button class="opt ' + (!S.clase && !S.mias ? 'on' : '') + '" data-c="">Todas</button>' + (S.enc && S.enc.size ? '<button class="opt ' + (S.mias ? 'on' : '') + '" data-mias="">✓ Las mías</button>' : '') + Object.entries(cat.CLASES).filter(([k]) => cat.todas().some(e => cat.vista(e) === k)).map(([k, v]) => '<button class="opt ' + (S.clase === k ? 'on' : '') + '" data-c="' + k + '">' + v.label + '</button>').join('');
  const mes = new Date().getMonth();
  const r = cat.buscar(S.q, { clase: S.clase }).filter(e => (!S.mias || (S.enc && S.enc.has(e.id))) && (!S.ahora || (saleEn(e, mes) && !(S.enc && S.enc.has(e.id))))); let h = '', cur = '';
  if (S.ahora) h += '<div class="cx-filtro"><span><i class="cx-live"></i>Te faltan y salen ahora · ' + r.length + '</span><button id="cx-quita" aria-label="Quitar filtro">Quitar ✕</button></div>';
  const ord = S.orden || 'rareza';
  $$('#ord button', root).forEach(b => b.classList.toggle('on', b.dataset.ord === ord));
  if (ord === 'col') {
    /* como un libro: capítulo (colección) → familia → especies */
    const cols = [...cat.COLECCIONES, { id: 'otras', titulo: 'Otras', color: '#7b8683', fam: [], intro: '' }].map(c => ({ c, l: r.filter(e => cat.coleccion(e).id === c.id) })).filter(x => x.l.length);
    h = '<div class="colidx">' + cols.map(x => '<button data-ir="' + x.c.id + '" style="--c:' + x.c.color + '">' + esc(x.c.titulo.split(':')[0]) + ' <em>' + x.l.length + '</em></button>').join('') + '</div>';
    cols.forEach(({ c, l }) => {
      const mias = S.enc ? l.filter(e => S.enc.has(e.id)).length : 0, pel = l.filter(e => e.clase === 'mortal' || e.clase === 'toxica').length;
      h += '<div class="colh" id="col-' + c.id + '" style="--c:' + c.color + '"><b>' + esc(c.titulo) + '</b>' + (c.intro ? '<p>' + esc(c.intro) + '</p>' : '') + '<small>' + plural(l.length, 'especie', 'especies') + (pel ? ' · ' + pel + ' peligrosas' : '') + (mias ? ' · ✓ ' + mias + ' tuyas' : '') + '</small></div>';
      const fams = [...new Set(l.map(e => e.familia || '—'))];
      fams.forEach(f => { const lf = l.filter(e => (e.familia || '—') === f).sort((a, b) => corto(a).localeCompare(corto(b), 'es')); if (fams.length > 1) h += '<div class="famh">' + esc(f) + '<small>' + lf.length + '</small></div>'; h += lf.map(e => itemEsp(e)).join(''); });
    });
    $('#slist', root).innerHTML = r.length ? h : '<div class="empty">Nada con ese nombre.</div>'; return;
  }
  if (ord === 'rareza') {
    /* de lo más fácil de encontrar a lo más difícil: para aprender primero las comunes */
    cat.ORDEN_RAREZA.forEach(k => {
      const l = cat.porRareza(r.filter(e => e.rareza === k)); if (!l.length) return; const x = cat.RAREZAS[k], mias = S.enc ? l.filter(e => S.enc.has(e.id)).length : 0;
      const tt = cat.todas().filter(e => e.rareza === k), tn = S.enc ? tt.filter(e => S.enc.has(e.id)).length : 0;
      h += '<div class="rzh rz-' + k + '" id="rz-' + k + '" style="--c:' + x.color + '"><span class="rzh-i">' + fi.pips(x) + '</span><div class="rzh-t"><b>' + x.label + '<em>' + l.length + (l.length !== tt.length ? ' de ' + tt.length : '') + '</em></b>' +
        '<small><b>' + tn + '/' + tt.length + '</b> encontradas' + (tt.length - tn ? ' · <span class="faltan">faltan ' + (tt.length - tn) + '</span>' : ' · ¡completo!') + '</small><i class="rzh-bar"><u style="width:' + (tt.length ? tn / tt.length * 100 : 0) + '%"></u></i><p>' + esc(x.txt) + '</p></div></div>';
      h += l.map(e => itemEsp(e)).join('');
    });
    $('#slist', root).innerHTML = r.length ? h : '<div class="empty">Nada con ese nombre.</div>'; return;
  }
  if (ord === 'az') {
    r.sort((a, b) => corto(a).localeCompare(corto(b), 'es')).forEach(e => { const l = corto(e)[0].toUpperCase(); if (l !== cur) { cur = l; h += '<div class="grp" style="--c:#7b8683">' + l + '</div>'; } h += itemEsp(e); });
    $('#slist', root).innerHTML = r.length ? h : '<div class="empty">Nada con ese nombre.</div>'; return;
  }
  r.forEach(e => { const v = cat.vista(e); if (v !== cur) { cur = v; const n = r.filter(x => cat.vista(x) === cur).length; h += '<div class="grp" style="--c:' + cat.CLASES[cur].color + '">' + (cur === 'sin_datos' ? 'Sin datos' : cur === 'ok_fuentes' ? 'Comestibles · según fuentes' : cur === 'cond_fuentes' ? 'Con condiciones · según fuentes' : cat.CLASES[cur].label) + '<small>' + n + '</small></div>'; } h += itemEsp(e); });
  $('#slist', root).innerHTML = r.length ? h : '<div class="empty">Nada con ese nombre.</div>';
}
/* Pestañas de la ficha: 'todo' las muestra todas (lo usan las pruebas). Al volver de la guía o del libro se reabre en la misma pestaña. */
function fichaTab(sh, k, { ir = false } = {}) {
  const tabs = $$('.ft', sh), pan = $$('.fp', sh); if (!tabs.length) return;
  tabs.forEach(t => { const on = t.dataset.ft === k; t.classList.toggle('on', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); });
  pan.forEach(p => { p.hidden = k !== 'todo' && p.dataset.fp !== k; });
  const bar = $('#ftabs', sh), on = $('.ft.on', sh); if (on && bar) bar.scrollTo({ left: on.offsetLeft - 12, behavior: 'smooth' });
  if (ir && bar) { const d = bar.getBoundingClientRect().top - sh.getBoundingClientRect().top; if (d > 4) sh.scrollTo({ top: sh.scrollTop + d - 4, behavior: 'smooth' }); }
  S.ftab = { id: sh.dataset.fid, tab: k };
}
function leyendaMapa() {
  const cl = ['ok_fuentes', 'cond_fuentes', 'no_comestible', 'toxica', 'mortal'].map(k => cat.CLASES[k]);
  return '<b>Qué significa cada marca</b><div class="ml-r"><span class="ml-sp" style="--c:var(--spot)">' + I.seta + '</span>Spot visitado</div><div class="ml-r"><span class="ml-sp por">' + I.flag + '</span>Spot «quiero ir» (sin visitar)</div><div class="ml-r"><span class="ml-sp por sug">' + I.estrella + '</span>Recomendado por el análisis de tus setas</div>' +
    '<div class="ml-r"><i style="--c:#4cc3d9;background:none;border:2px dashed #4cc3d9"></i>Zona de una salida (cubre sus spots y hallazgos)</div>' + '<small>Hallazgos: el borde es el color de la especie</small>' + cl.map(c => '<div class="ml-r"><i style="--c:' + c.color + '"></i>' + esc(c.label) + '</div>').join('') + '<div class="ml-r"><i style="--c:#9aa5a1"></i>Sin identificar o sin datos</div><small class="ml-x">Toca para cerrar</small>';
}
function abrirFicha(id) {
  const e = cat.byId(id); if (!e) return;
  const sh = openSheet(fi.fichaHTML(e, S.mes)), hero = $('#hero', sh), dots = $$('#dots i', sh); sh.dataset.fid = id; fi.activarVisor(sh);
  if (hero && dots.length) hero.onscroll = () => { const i = Math.round(hero.scrollLeft / Math.max(1, hero.clientWidth)); dots.forEach((d, k) => d.classList.toggle('on', k === i)); };
  if (S.ftBack && S.ftBack.id === id) { fichaTab(sh, S.ftBack.tab); } S.ftBack = null;
  const sal = () => { S.ftBack = { id, tab: (S.ftab && S.ftab.id === id && S.ftab.tab) || 'ident' }; };
  sh.addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; if (b.dataset.ft) fichaTab(sh, b.dataset.ft, { ir: b.classList.contains('rs') || b.classList.contains('rz') }); else if (b.dataset.e) abrirFicha(b.dataset.e); else if (b.dataset.h) { sal(); abrirHabitat(b.dataset.h, id); } else if (b.dataset.g !== undefined) { sal(); abrirGuia(b.dataset.g, id); } else if (b.dataset.l !== undefined) { sal(); abrirLibro(b.dataset.l, id); } else if (b.id === 'fi-antes') abrirAntesDeComer(); });
}
/* Guía de hábitats: desde una ficha (volverA = id de la seta) o desde «¿Dónde busco?» (volverA = 'donde') */
function abrirHabitat(id, volverA) {
  const sh = openSheet(fi.habitatHTML(id, { volver: volverA }));
  sh.addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; if (b.id === 'hb-x') closeSheet(); else if (b.id === 'hb-b') { if (volverA === 'donde') abrirDondeBuscar(); else abrirFicha(volverA); } else if (b.dataset.e) abrirFicha(b.dataset.e); });
}
function abrirDondeBuscar() {
  const sh = openSheet(fi.dondeBuscarHTML());
  sh.addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; if (b.id === 'hb-x') closeSheet(); else if (b.dataset.h) abrirHabitat(b.dataset.h, 'donde'); });
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
const IA_SLOTS = [['Sombrero (desde arriba)', 'Por encima'], ['Láminas o poros (por debajo)', 'Por debajo'], ['Base del pie (con la volva si hay)', 'Base del pie'], ['Cualquier otra vista (entera, en el suelo, corte…)', 'Otra']];
function abrirIA() {
  const fotos = [null, null, null, null], urls = []; let nota = '', ultimo = null;
  const sh = openSheet('');
  const pintar = (res, err, cargando) => {
    const hay = fotos.some(Boolean), key = ia.getKey();
    let h = '<h2>Reconocer con IA</h2>';
    if (!key) {
      h += '<p class="sub" style="font-family:inherit">Necesito una clave gratuita de Gemini. Se guarda en tu repositorio privado y se copia sola a tus otros dispositivos.</p><ol class="note" style="margin:8px 0 0 18px;padding:0"><li>Entra en <b>aistudio.google.com/apikey</b></li><li>«Crear clave de API» (gratis, sin tarjeta)</li><li>Cópiala y pégala aquí</li></ol>' +
        '<input type="password" id="ia-k" placeholder="AIza…" autocomplete="off" autocapitalize="off" style="margin-top:10px"><div class="row"><button class="btn p" id="ia-ks">Guardar clave</button><button class="btn" id="gu-x">Cerrar</button></div>' + (err ? '<div class="warn" style="margin-top:10px">' + esc(err) + '</div>' : '');
      sh.innerHTML = h; return;
    }
    h += '<p class="sub" style="font-family:inherit">Vale una sola foto o las que tengas, en el orden que sea: cuantas más vistas, mejor (arriba, por debajo, base del pie). Si sabes el árbol o el sitio, anótalo.</p><div class="ia-slots">' +
      IA_SLOTS.map((s, i) => '<label class="ia-slot' + (fotos[i] ? ' ok' : '') + '" data-i="' + i + '">' + (fotos[i] ? '<img src="' + urls[i] + '" alt="">' : '<span>＋</span>') + '<small>' + s[1] + '</small><input type="file" accept="image/*" data-i="' + i + '" hidden></label>').join('') + '</div><input type="text" id="ia-nota" maxlength="120" placeholder="Árbol o sitio (opcional): pino, robledal, hierba…" value="' + esc(nota) + '">';
    if (cargando) h += '<div class="note" style="margin-top:12px">Mirando las fotos…</div>';
    if (err) h += '<div class="warn" style="margin-top:12px">' + esc(err) + '</div>';
    if (res) h += resultadoIA(res);
    h += '<div class="row"><button class="btn p" id="ia-go"' + (hay && !cargando ? '' : ' disabled') + '>Reconocer</button><button class="btn" id="gu-x">Cerrar</button></div>' +
      '<p class="note" style="margin-top:12px">Es una pista, no una identificación. Nunca se come una seta por lo que diga una IA ni esta app. Las fotos se envían a Google (Gemini) solo al pulsar «Reconocer». <a href="#" id="ia-kc" style="color:var(--acc)">Cambiar clave</a></p>';
    sh.innerHTML = h;
  };
  sh.oninput = e => { if (e.target.id === 'ia-nota') nota = e.target.value; };
  sh.onchange = e => {
    const f = e.target.files && e.target.files[0], i = +e.target.dataset.i; if (!f || isNaN(i)) return;
    fotos[i] = f; if (urls[i]) URL.revokeObjectURL(urls[i]); urls[i] = URL.createObjectURL(f); pintar();
  };
  sh.onclick = async e => {
    const b = e.target.closest('button'), a = e.target.closest('#ia-kc');
    if (a) { e.preventDefault(); ia.setKey(''); return pintar(); }
    if (b.id === 'gu-x') { urls.forEach(u => u && URL.revokeObjectURL(u)); return closeSheet(); }
    if (b.dataset.e) { const cs = ((ultimo && ultimo.candidatas) || []).map(c => ({ e: cat.byId(c.id), pc: Math.max(0, Math.min(100, c.confianza | 0)), ia: c })).filter(c => c.e); return abrirComprobar(cs.length ? cs : [{ e: cat.byId(b.dataset.e), pc: null }], { i: Math.max(0, cs.findIndex(c => c.e.id === b.dataset.e)), faltaVer: ultimo && ultimo.faltaVer, dif: ultimo && ultimo.diferencias }); }
    if (b.id === 'ia-ks') { const k = $('#ia-k', sh).value; if (!ia.claveValida(k)) return pintar(null, 'Esa clave no tiene la forma correcta (la de Google AI Studio, empieza por AIza… o AQ.…).'); ia.setKey(k); return pintar(); }
    if (b.id === 'ia-go') {
      if (!navigator.onLine) return pintar(null, ia.mensajeError(new Error('red')));
      pintar(null, '', true);
      try { ultimo = await ia.reconocer(fotos.filter(Boolean), { nota }); pintar(ultimo); }
      catch (err) { if (err.message === 'clave') ia.setKey(''); pintar(null, ia.mensajeError(err)); }
    }
  };
  pintar();
}
/* «¿Cuál es?» a pantalla completa, encima de lo que estés haciendo (no se pierde lo marcado) */
function abrirComprobar(cands, o = {}) {
  cands = (cands || []).filter(c => c && c.e); if (!cands.length) return;
  const viejo = document.getElementById('cuales'); if (viejo) viejo.remove();
  const ov = document.createElement('div'); ov.id = 'cuales'; ov.className = 'cq'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', '¿Cuál es?');
  let i = o.i || 0, ficha = false;
  const pinta = () => {
    const sel = i >= 0 ? cands[i] : null;
    ov.innerHTML = '<div class="cq-top"><button class="vs-x" data-cx aria-label="Cerrar">' + I.close + '</button><b>¿Cuál es?</b><small>' + (cands.length > 1 ? cands.length + ' candidatas' : '') + '</small></div>' + cmpx.tabsHTML(cands, i) +
      '<div class="cq-body">' + (o.faltaVer && !ficha ? '<div class="cq-ia"><b>Para salir de dudas, la IA pide mirar:</b> ' + esc(o.faltaVer) + '</div>' : '') +
      (sel ? (ficha ? fi.fichaHTML(sel.e, S.mes) : cmpx.especieHTML(sel.e, cands.filter(c => c !== sel).map(c => c.e), sel.ia)) : cmpx.diferenciasHTML(cands, o.dif || [])) +
      '<p class="note cq-av">La IA y las fotos son una pista. Para comer, nunca basta: mira la seta entera y que la confirme alguien que sepa.</p></div>' +
      '<div class="cq-bar">' + (sel && o.elegir ? '<button class="btn p" data-cel>' + I.check + 'Es esta</button>' : '') + (sel ? '<button class="btn" data-cfi>' + (ficha ? 'Volver a comprobar' : I.libro + 'Ficha completa') + '</button>' : '') +
      (!sel && o.elegir ? '<p class="mut sm">Elige una candidata arriba para marcarla.</p>' : '') + '</div>';
    fi.activarVisor(ov); hydrate(ov);
  };
  ov.addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.cx !== undefined) ov.remove();
    else if (b.dataset.ck != null) { i = +b.dataset.ck; ficha = false; pinta(); }
    else if (b.dataset.cel !== undefined) { const e = cands[i].e; ov.remove(); o.elegir(e); }
    else if (b.dataset.cfi !== undefined) { ficha = !ficha; pinta(); }
    else if (b.dataset.ft) fichaTab(ov, b.dataset.ft);
    else if (b.dataset.e) { const x = cat.byId(b.dataset.e); if (!x) return; if (!cands.some(c => c.e.id === x.id)) cands.push({ e: x, pc: null }); i = cands.findIndex(c => c.e.id === x.id); ficha = false; pinta(); }
  });
  document.body.appendChild(ov); pinta();
}
function resultadoIA(r, modo) {
  const marcar = modo === 'marcar', pc = c => Math.max(0, Math.min(100, c.confianza | 0));
  if (!r.esSeta) return '<div class="ia-res"><b>No parece una seta.</b><p class="note">Prueba con una foto más cercana.</p></div>';
  const cs = r.candidatas.slice().sort((x, y) => y.confianza - x.confianza);
  const peligro = cs.some(c => { const e = cat.byId(c.id); return e && (e.clase === 'mortal' || e.clase === 'toxica'); });
  const top = cs[0], dudoso = !top || top.confianza < 25;
  let h = '<div class="ia-res">' + (dudoso ? '<b>Con estas fotos no puedo decidirlo.</b>' : '<b>Lo más probable</b>');
  h += cs.map((c, i) => {
    const e = cat.byId(c.id), n = pc(c), niv = n >= 75 ? 'alta' : n >= 40 ? 'media' : 'baja';
    const bar = '<span class="ia-bar ' + niv + '"><i style="width:' + n + '%"></i></span>';
    const rasgos = (c.encaja ? '<small class="ia-c si">✓ ' + esc(c.encaja) + '</small>' : c.rasgos ? '<small class="ia-c">' + esc(c.rasgos) + '</small>' : '') + (c.noEncaja ? '<small class="ia-c no">✗ ' + esc(c.noEncaja) + '</small>' : '');
    const at = e ? (marcar ? ' data-iae="' + e.id + '"' : ' data-e="' + e.id + '"') : (marcar && c.nombreCientifico ? ' data-iat="' + esc(c.nombreCientifico) + '"' : '');
    const nom = e ? esc(corto(e)) : '<i>' + esc(c.nombreCientifico) + '</i>', sub = e ? (corto(e) === e.nombreCientifico.split(' (')[0] ? esc(e.nombreCientifico.includes(' (') ? e.nombreCientifico.split(' (')[1].replace(')', '') : '') : '<i>' + esc(e.nombreCientifico) + '</i>') : esc(c.nombreComun) + ' · no está en tu colección';
    return '<div class="ia-w' + (i === 0 && !dudoso ? ' mejor' : '') + '"><button class="ia-row' + (i === 0 && !dudoso ? ' mejor' : '') + (e ? '' : ' fuera') + '"' + at + ' style="--c:' + (e ? colorEsp(e) : '#7b8683') + '">' +
      '<span class="pf">' + (e ? fotoEsp(e) : '<span class="ph0">?</span>') + '</span><span class="t"><b>' + nom + '</b><small>' + sub + '</small>' + bar + rasgos + '</span><span class="ia-pc">' + n + '<small>%</small></span></button>' +
      (marcar && e ? '<button class="ia-ver" data-iav="' + e.id + '">Comprobar: qué mirar y diferencias ›</button>' : '') + '</div>';
  }).join('');
  if (cs.length && r.diferencias && r.diferencias.length) h += cmpx.pasosIA(r.diferencias);
  if (marcar) h += '<button class="btn ia-no" id="mk-iano">No sé · lo miro en casa</button>';
  h += '<p class="note ia-nota">El porcentaje es lo segura que está la IA con estas fotos, no una garantía.' + (marcar ? ' Toca una para elegirla (queda como provisional).' : '') + '</p>';
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
  root.innerHTML = '<div class="pad"><div class="aj-panel">' + estadoSyncHTML() + resumenAjustes() + '</div>' + ajustesResto(c, last, zonas) + '</div>';
  ajustesWire.zonas = zonas; ajustesWire(root, c);
}
/* resumen: cómo está cada cosa de un vistazo; tocar lleva a su bloque */
function resumenAjustes() {
  const nz = off.zonas().filter(z => z.completa).length, k = !!ia.getKey(), inst = instalada();
  const t = (id, ic, n, v, ok) => '<button class="aj-t' + (ok ? ' ok' : '') + '" data-aj="' + id + '"><span>' + ic + '</span><small>' + n + '</small><b>' + v + '</b></button>';
  return '<div class="aj-ts">' + t('aj-ia', I.chispa, 'IA', k ? 'Activa' : 'Sin clave', k) + t('aj-off', I.mapa, 'Mapa sin red', nz ? plural(nz, 'zona', 'zonas') : 'Nada guardado', nz > 0) + t('aj-inst', I.movil, 'App', inst ? 'Instalada' : 'Sin instalar', inst) + '</div>';
}
function estadoSyncHTML() {
  const c = syn.cfg(), last = syn.lastSync(), pend = db.dirtyCount(), ok = !!(c.repo && c.token);
  const est = !ok ? ['off', 'Sin configurar', 'Tus datos solo están en este móvil.'] : pend ? ['pend', plural(pend, 'cambio por subir', 'cambios por subir'), last ? 'Última vez: ' + new Date(last).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Aún sin sincronizar'] : ['ok', 'Todo al día', last ? 'Última vez: ' + new Date(last).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''];
  return '<div class="aj-st ' + est[0] + '"><span class="aj-d"></span><div><b>' + est[1] + '</b><small>' + est[2] + '</small></div></div>';
}
function ajustesResto(c, last, zonas) {
  const pend = db.dirtyCount(), ok = !!(c.repo && c.token);
  const sec = (ic, t, sub, body, id = '') => '<section class="aj"' + (id ? ' id="' + id + '"' : '') + '><div class="aj-h"><span class="aj-i">' + ic + '</span><div><h3>' + t + '</h3>' + (sub ? '<small>' + sub + '</small>' : '') + '</div></div>' + body + '</section>';
  const nf = Math.round(cat.todas().reduce((n, e) => n + (e.fotos || []).length, 0) * 0.2 / 5) * 5;
  return sec(ICON_SYNC, 'Sincronización', 'Copia en tu repositorio privado de GitHub',
      '<label class="l">Repositorio de datos</label><input type="text" id="a-repo" placeholder="usuario/micologia-datos" autocapitalize="off" autocomplete="off" value="' + esc(c.repo || '') + '">' +
      '<label class="l">Token de GitHub</label><input type="password" id="a-tok" placeholder="' + (c.token ? '•••••• guardado (déjalo vacío para conservarlo)' : 'github_pat_…') + '" autocomplete="off">' +
      '<div class="row"><button class="btn p" id="a-sync">' + (ok ? 'Sincronizar ahora' : 'Guardar y sincronizar') + '</button></div><div class="note" id="a-st" style="margin-top:10px">' + (last ? 'Última sincronización: ' + new Date(last).toLocaleString('es-ES') : 'Aún no has sincronizado.') + (pend ? '<br>Pendiente de subir: ' + pend : '') + '</div>') +
    sec(I.chispa, 'Reconocer con IA', ia.getKey() ? '<span class="okc">✓ Clave guardada y sincronizada con tus dispositivos</span>' : 'Clave gratuita de aistudio.google.com/apikey',
      '<input type="password" id="a-gk" placeholder="' + (ia.getKey() ? '•••••• guardada' : 'AIza… o AQ.…') + '" autocomplete="off" autocapitalize="off" style="margin-top:8px"><div class="row"><button class="btn p" id="a-gks">Guardar</button>' + (ia.getKey() ? '<button class="btn d" id="a-gkd">Borrar</button>' : '') + '</div><div class="note" id="a-gst" style="margin-top:8px"></div>', 'aj-ia') +
    instalarHTML(sec) +
    sec(I.mapa, 'Mapa sin conexión', 'Satélite guardado en el móvil para el monte sin cobertura', offHTML(), 'aj-off') +
    sec(I.foto, 'Fotos sin conexión', 'Las fichas con foto en el monte sin cobertura (≈' + nf + ' MB)',
      '<div class="row"><button class="btn" id="a-fotos">Descargar fotos</button></div><div class="note" id="a-fst" style="margin-top:10px">Comprobando…</div>') +
    sec(I.flag, 'Tus datos', plural(zonas.length, 'spot', 'spots'),
      '<div class="row"><button class="btn" id="a-exp">Exportar copia (JSON)</button></div>' +
      (zonas.length ? '<details class="det"><summary>Renombrar o borrar spots</summary>' + (zonas.some(z => lug.nombrar(z.lat, z.lon)) ? '<div class="row"><button class="btn" id="a-lugar">📍 Poner a todos el nombre de su lugar</button></div>' : '') + zonas.map(z => '<div class="row" style="margin-top:8px"><input type="text" data-z="' + z.id + '" value="' + esc(z.nombre) + '" style="flex:1"><button class="btn d" data-zd="' + z.id + '" style="flex:none">Borrar</button></div>').join('') + '</details>' : '')) +
    '<div class="aj-about"><img src="icon.svg" alt="" width="44" height="44"><div><b>Micología</b><small>Versión ' + APP_V + '</small></div></div>' +
    '<p class="aj-legal">' + lug.FUENTE + '.<br>Las coordenadas de tus sitios solo viven en este móvil y en tu repositorio privado. La app nunca certifica que una seta sea comestible.<br>Mapa: imágenes PNOA/Sentinel © IGN España (CC BY 4.0 scne.es) · callejero © OpenStreetMap.</p>';
}
/* Instalar la app en la pantalla de inicio (PWA): botón directo si el navegador lo permite, y si no, los pasos. */
let PROMPT = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); PROMPT = e; const b = $('#a-inst'); if (b) b.hidden = false; });
addEventListener('appinstalled', () => { PROMPT = null; try { renderAjustes(); } catch (e) { } });
const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function instalarHTML(sec) {
  if (instalada()) return sec(I.movil, 'App instalada', '<span class="okc">✓ Ya la tienes en tu pantalla de inicio</span>', '', 'aj-inst');
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return sec(I.movil, 'Instalar en el móvil', 'Icono en la pantalla de inicio, abre a pantalla completa y funciona con lo ya cargado',
    '<div class="row"><button class="btn p" id="a-inst"' + (PROMPT ? '' : ' hidden') + '>Instalar app</button></div>' +
    '<div class="note" id="a-instn" style="margin-top:8px">' + (ios
      ? 'En iPhone, con Safari: pulsa <b>Compartir</b> (cuadrado con flecha) → <b>Añadir a pantalla de inicio</b>.'
      : 'En Android, con Chrome: menú <b>⋮</b> → <b>Instalar aplicación</b> (o «Añadir a pantalla de inicio»).') +
    '<br>Abre la app desde ese icono la primera vez con conexión para que guarde todo.</div>', 'aj-inst');
}
/* ---------- mapa sin conexión ---------- */
const OFF = { sel: null, km: 5, det: 'normal', ctl: null, msg: '' };
/* grupos descargables: las zonas predefinidas + tus spots + el centro del mapa */
function offGrupos(zonas) {
  const g = off.PRESETS.map(p => ({ clave: p.clave, nombre: p.nombre, desc: p.desc, cajas: off.cajasPreset(p) }));
  if (zonas.length) g.push({ clave: 'spots', nombre: 'Mis spots', desc: plural(zonas.length, 'spot', 'spots') + ' (3 km alrededor de cada uno)', cajas: zonas.map(z => off.cajaAlrededor(z.lat, z.lon, 3)) });
  const c = S.lastCenter || (S.map && S.map.getCenter()) || { lat: 43.26, lng: -2.93 };
  g.push({ clave: 'centro', nombre: 'Centro del mapa', desc: 'Lo que estás mirando ahora en el mapa', cajas: [off.cajaAlrededor(c.lat, c.lng, OFF.km)], extra: true });
  return g;
}
function offHTML() {
  return '<div class="note" style="margin:0 0 8px">Marca las zonas donde andas y descárgalas con wifi. Se guarda la foto aérea (IGN): sin cobertura el mapa, tus spots y tus hallazgos funcionan igual y, al volver la red, se sincroniza solo.</div><div id="off-lista" class="offl"></div>' +
    '<div id="off-km" hidden><label class="l">Radio del «centro del mapa»</label><div class="seg" id="off-k">' + [2, 5, 10].map(k => '<button data-ok="' + k + '">' + k + ' km</button>').join('') + '</div></div>' +
    '<label class="l">Detalle</label><div class="seg" id="off-d"><button data-od="normal">Normal (se ve el bosque)</button><button data-od="alto">Alto (4× más peso)</button></div>' +
    '<div class="note" id="off-n" style="margin-top:10px"></div>' +
    '<div class="row"><button class="btn p" id="off-go">Descargar lo marcado</button><button class="btn d" id="off-stop" hidden>Parar</button></div>' +
    '<div class="note" id="off-st" style="margin-top:8px"></div><div class="note" id="off-tot" style="margin-top:4px">Comprobando…</div><div class="row"><button class="btn d" id="off-del" hidden>Borrar mapas guardados</button></div>';
}
async function offWire(root, zonas) {
  if (!OFF.sel) OFF.sel = new Set(off.PRESETS.map(p => p.clave));
  const st = $('#off-st', root), n = $('#off-n', root), go = $('#off-go', root), stop = $('#off-stop', root), del = $('#off-del', root), tot = $('#off-tot', root), lista = $('#off-lista', root);
  const mb = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB';
  const zmax = () => off.ZMAX[OFF.det];
  const pintar = () => {
    const gs = offGrupos(zonas);
    lista.innerHTML = gs.map(g => {
      const t = off.teselas(g.cajas, zmax()).length, ok = off.guardada(g.clave, zmax());
      return '<label class="offi' + (ok ? ' ok' : '') + '"><input type="checkbox" data-og="' + g.clave + '"' + (OFF.sel.has(g.clave) ? ' checked' : '') + '><span><b>' + esc(g.nombre) + '</b><small>' + esc(g.desc) + ' · ≈ ' + off.estimarMB(t) + ' MB</small></span><em>' + (ok ? '✓ guardada' : '') + '</em></label>';
    }).join('');
    $('#off-km', root).hidden = !OFF.sel.has('centro');
    $$('#off-k button', root).forEach(b => b.classList.toggle('on', +b.dataset.ok === OFF.km));
    $$('#off-d button', root).forEach(b => b.classList.toggle('on', b.dataset.od === OFF.det));
    const marc = gs.filter(g => OFF.sel.has(g.clave)), t = off.teselas(marc.flatMap(g => g.cajas), zmax()).length, grande = off.demasiadas(t);
    n.textContent = marc.length ? plural(marc.length, 'zona marcada', 'zonas marcadas') + ' · ≈ ' + t.toLocaleString('es-ES') + ' teselas · ≈ ' + off.estimarMB(t) + ' MB en total' + (grande ? ' — demasiado grande: desmarca alguna o baja el detalle.' : '') : 'Marca al menos una zona.';
    go.disabled = !marc.length || grande || !!OFF.ctl;
  };
  const estado = async () => { const e = await off.estado(); if (!e.ok) { tot.textContent = 'Este navegador no permite guardar mapas sin conexión.'; go.disabled = true; return; } tot.textContent = e.n ? 'En el móvil: ' + e.n.toLocaleString('es-ES') + ' teselas guardadas.' : 'Aún no has guardado ningún mapa.'; del.hidden = !e.n; };
  const sec = lista.closest('section');
  sec.addEventListener('change', e => { const c = e.target.closest('[data-og]'); if (!c) return; c.checked ? OFF.sel.add(c.dataset.og) : OFF.sel.delete(c.dataset.og); pintar(); });
  sec.addEventListener('click', e => { const k = e.target.closest('[data-ok]'), d = e.target.closest('[data-od]'); if (k) { OFF.km = +k.dataset.ok; pintar(); } else if (d) { OFF.det = d.dataset.od; pintar(); } });
  /* la pantalla se repinta sola (p. ej. al terminar una sincronización): el texto va siempre al elemento actual y se guarda en OFF.msg */
  const dice = m => { OFF.msg = m; const e = $('#off-st'); if (e) e.textContent = m; };
  go.onclick = async () => {
    if (!navigator.onLine) { dice('Necesitas conexión para descargar el mapa.'); return; }
    const grupos = offGrupos(zonas).filter(g => OFF.sel.has(g.clave)); if (!grupos.length) return;
    const ctl = OFF.ctl = {}; go.disabled = true; stop.hidden = false; del.hidden = true;
    try {
      const r = await off.descargar({ grupos, zmax: zmax() }, p => { dice('Descargando mapa… ' + Math.round(p.hechas / p.total * 100) + '% · ' + mb(p.bytes) + (p.fallos ? ' · ' + p.fallos + ' fallos' : '')); }, ctl);
      dice(r.cancelada ? 'Descarga parada (lo ya bajado queda guardado).' : r.fallos ? 'Descargado con ' + r.fallos + ' teselas que fallaron: vuelve a pulsar Descargar para completarlas.' : '✓ Mapa guardado (' + r.total.toLocaleString('es-ES') + ' teselas' + (r.bytes ? ' · ' + mb(r.bytes) + ' nuevos' : ' · ya estaban') + ').');
      toast(r.fallos || r.cancelada ? 'Mapa incompleto' : 'Mapa guardado para usar sin conexión');
    } catch (err) { dice(err.message === 'demasiadas' ? 'Demasiado grande: desmarca alguna zona o baja el detalle.' : 'No se ha podido descargar: ' + (err.message || err)); }
    OFF.ctl = null; if ($('#off-stop')) { $('#off-stop').hidden = true; } if ($('#off-go')) pintar(); estado();
  };
  stop.onclick = () => { if (OFF.ctl) OFF.ctl.cancel = true; };
  del.onclick = async () => { if (del.dataset.sure) { await off.borrarTodo(); del.dataset.sure = ''; del.textContent = 'Borrar mapas guardados'; pintar(); estado(); toast('Mapas borrados'); } else { del.dataset.sure = 1; del.textContent = 'Pulsa otra vez para borrar'; } };
  st.textContent = OFF.msg || ''; stop.hidden = !OFF.ctl;
  pintar(); estado();
}
function ajustesWire(root, c) {
  offWire(root, ajustesWire.zonas || []);
  $$('[data-aj]', root).forEach(b => b.onclick = () => { const x = $('#' + b.dataset.aj, root); if (x) x.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  const bi = $('#a-inst', root); if (bi) bi.onclick = async () => { if (!PROMPT) return; PROMPT.prompt(); try { await PROMPT.userChoice; } catch (e) { } PROMPT = null; renderAjustes(); };
  $('#a-sync', root).onclick = async () => {
    const repo = $('#a-repo', root).value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, ''), tok = $('#a-tok', root).value.trim() || c.token, st = $('#a-st', root);
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !tok) { st.textContent = 'Pon el repositorio como usuario/nombre y pega el token.'; return; }
    syn.setCfg({ ...c, repo, token: tok }); await correrSync(m => { st.textContent = m; });
    const e = $('.aj-st', root); if (e) e.outerHTML = estadoSyncHTML();
  };
  $('#a-gks', root).onclick = () => { const k = $('#a-gk', root).value, st = $('#a-gst', root); if (!ia.claveValida(k)) { st.textContent = 'La clave de AI Studio empieza por AIza… o AQ. y es larga.'; return; } ia.setKey(k); toast('Clave guardada'); renderAjustes(); };
  const gd = $('#a-gkd', root); if (gd) gd.onclick = () => { ia.setKey(''); toast('Clave borrada'); renderAjustes(); };
  $('#a-exp', root).onclick = async () => { const a = document.createElement('a'); a.href = URL.createObjectURL(await db.exportAll()); a.download = 'micologia-copia-' + hoy() + '.json'; document.body.appendChild(a); a.click(); a.remove(); };
  const bl = $('#a-lugar', root); if (bl) bl.onclick = async () => {
    const zs = ajustesWire.zonas || [], usados = [], cambios = [];
    for (const z of zs) { const n = lug.nombreSpot(z.lat, z.lon, usados); if (n) { usados.push(n); if (n !== z.nombre) cambios.push([z, n]); } else usados.push(z.nombre); }
    if (!cambios.length) return toast('Ya tienen el nombre de su lugar');
    if (!bl.dataset.sure) { bl.dataset.sure = 1; bl.textContent = 'Pulsa otra vez: ' + cambios.map(([z, n]) => z.nombre + ' → ' + n).join(' · '); return; }
    for (const [z, n] of cambios) await db.patch('zonas', z.id, { nombre: n });
    toast(plural(cambios.length, 'spot renombrado', 'spots renombrados')); syn.auto();
  };
  root.onchange = e => { const z = e.target.dataset.z; if (z && e.target.value.trim()) db.patch('zonas', z, { nombre: e.target.value.trim() }); };
  fotosEstado($('#a-fst', root));
  $('#a-fotos', root).onclick = async ev => { const st = $('#a-fst', root); ev.target.disabled = true; const r = await descargarFotos(m => { st.textContent = m; }); ev.target.disabled = false; st.textContent = r.fail ? 'Listo con ' + r.fail + ' fallos de ' + r.total + '. Vuelve a pulsar para reintentar.' : 'Listo: ' + r.ok + ' fotos guardadas.'; };
  root.onclick = async e => { const b = e.target.closest('[data-zd]'); if (!b) return; if (b.dataset.sure) { await db.remove('zonas', b.dataset.zd); toast('Zona borrada'); } else { b.dataset.sure = 1; b.textContent = '¿Seguro?'; } };
}
function urlsFotos() { const u = []; cat.todas().forEach(e => { (e.fotos || []).forEach(f => { u.push(fi.fotoURL(f, 250)); u.push(fi.fotoURL(f, 960)); }); (e.anotadas || []).forEach(a => u.push(fi.fotoURL(a.foto, 960))); }); return [...new Set(u)]; }
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

/* ---------- botón «atrás» de Android: cierra lo abierto y retrocede de pantalla en pantalla; solo sale desde el mapa ---------- */
function padre(h) {
  const [v, arg, sub, key] = (h || '#mapa').slice(1).split('/');
  if (v === 'salida') return sub ? (sub === 'especie' && key ? '#salida/' + arg + '/especies' : '#salida/' + arg) : '#salidas';
  return v && v !== 'mapa' ? '#mapa' : null;
}
function atras() {
  const cm = document.getElementById('cuales'); if (cm) { cm.remove(); return 'comparar'; }
  const vis = document.getElementById('visor'); if (vis) { vis.remove(); return 'visor'; }
  const sh = $('#sheet'); if (sh && !sh.hidden) { closeSheet(); return 'hoja'; }
  const lg = $('#mleg'); if (lg && !lg.hidden) { lg.hidden = true; $('#legbtn').classList.remove('on'); return 'leyenda'; }
  const p = padre(location.hash); if (p) { location.hash = p; return p; }
  return null;   /* ya estás en el mapa: ahí sí se sale de la app */
}
function atrasAndroid() {
  try {
    const C = window.Capacitor; if (!(C && C.isNativePlatform && C.isNativePlatform())) return;
    const A = (C.Plugins && C.Plugins.App) || (C.registerPlugin && C.registerPlugin('App')); if (!A || !A.addListener) return;
    A.addListener('backButton', () => { if (atras() === null) A.exitApp(); });
  } catch (e) { }
}

/* ---------- navegación ---------- */
function route() {
  const [v, arg, sub, key] = (location.hash || '#mapa').slice(1).split('/'), view = VIEWS.includes(v) ? v : 'mapa';
  S.prevHash = S.curHash || ''; S.curHash = location.hash; S.sub = sub || ''; S.key = key ? decodeURIComponent(key) : '';
  const vis = document.getElementById('visor'); if (vis) vis.remove();
  if (S.mini && view !== 'salida') { S.mini.remove(); S.mini = null; }
  if (view !== S.view || (arg || '') !== S.arg || (sub || '') !== (S.subAnt || '')) closeSheet();
  S.subAnt = sub || '';
  S.view = view; S.arg = arg || ''; document.body.dataset.view = view;
  VIEWS.forEach(x => { const el = $('#v-' + x), on = x === view; if (on && el.hidden) { el.classList.remove('entra'); void el.offsetWidth; el.classList.add('entra'); } el.hidden = !on; });
  $$('.nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === (view === 'salida' ? 'salidas' : view)));
  $('#ttl').textContent = TITULOS[view];
  if (view === 'mapa') { setTimeout(() => S.map.invalidateSize(), 40); refreshPins(); }
  renderView();
}
async function renderView() {
  const a = document.activeElement;
  if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.closest('.view') && S.view !== 'ajustes') return;
  if (S.view === 'salidas') await renderSalidas(); else if (S.view === 'salida') await renderSalida(S.arg); else if (S.view === 'setas') renderSetas(); else if (S.view === 'mes') renderMes(); else if (S.view === 'plan') await renderPlan($('#v-plan'), S.arg); else if (S.view === 'ajustes') await renderAjustes();
}
async function boot() {
  await db.init(); await cat.load(); lug.cargar();
  initMap(); badge(); route(); chipSalida(); atrasAndroid();
  /* si había una salida en curso (la app se cerró o se recargó), sigue grabando el recorrido */
  { const a = await activa(); if (a && (tr.tiene(a) ? tr.activo(a) : a.grabar !== false)) await trk.start(a.id); }
  addEventListener('hashchange', route);
  document.addEventListener('error', e => { if (e.target.tagName === 'IMG' && e.target.classList.contains('ph')) e.target.classList.add('x'); }, true);
  db.onChange(() => { badge(); refreshPins(); chipSalida(); if (S.view !== 'setas' && S.view !== 'mes' && S.view !== 'plan' && !trk.guardando()) renderView(); });
  addEventListener('online', badge); addEventListener('offline', badge);
  $('#syncbtn').onclick = () => { const c = syn.cfg(); if (!c.repo || !c.token) { location.hash = '#ajustes'; toast('Configura el repositorio y el token'); } else correrSync(); };
  if (syn.cfg().repo) syn.auto(2500);
  ia.alinear();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    const hadCtl = !!navigator.serviceWorker.controller;
    /* nueva versión: aviso con botón (no recarga sola para no cortar lo que estés haciendo) */
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadCtl || document.getElementById('upd')) return;
      const b = document.createElement('button'); b.id = 'upd'; b.textContent = 'Nueva versión lista · toca para actualizar';
      b.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 76px);z-index:99999;padding:14px;border:0;border-radius:14px;background:#d8b545;color:#0a0f0e;font:700 15px system-ui;box-shadow:0 6px 24px #0008';
      b.onclick = () => location.reload(); document.body.appendChild(b);
    });
    navigator.serviceWorker.register('sw.js').then(reg => {
      const buscar = () => { if (navigator.onLine) reg.update().catch(() => { }); };
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') buscar(); });
      buscar();
    }).catch(() => { });
  }
  window.__MI = { verSpot, abrirComprobar, cmpx, bos, abrirBosques, abrirRodal, atras, padre, abrirVisor, fichaTab: k => fichaTab($('#sheet .sh'), k), abrirHabitat, abrirDondeBuscar, db, geo, syn, cat, trk, S, abrirHallazgo, abrirFicha, abrirLibro, abrirIA, ia, abrirSpot, verSpot, editarSpot, verHallazgo, leerGPX };
  document.body.dataset.ready = '1';
}
boot().catch(e => { console.error(e); document.body.insertAdjacentHTML('beforeend', '<div class="warn" style="position:fixed;top:60px;left:12px;right:12px;z-index:9999">No se pudo arrancar la app: ' + esc(e.message || e) + '</div>'); });
