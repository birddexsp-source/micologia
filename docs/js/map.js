/* Mapa Leaflet: satélite IGN (PNOA) por defecto, callejero OSM conmutable. Marcadores de spots y hallazgos. */
import { esc } from './util.js';
export const PNOA = 'https://www.ign.es/wmts/pnoa-ma?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=OI.OrthoimageCoverage&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg';
const VACIA = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';   // sin red y sin tesela: hueco limpio, no el icono de imagen rota
export const OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const IDENT = { sin_identificar: { label: 'Sin identificar', color: '#9aa5a1' }, provisional: { label: 'Provisional', color: '#e0a458' }, confirmada: { label: 'Confirmada por experto', color: '#4cc3d9' } };
export const getBase = () => { try { return localStorage.getItem('mi.base') === 'calle' ? 'calle' : 'sat'; } catch (e) { return 'sat'; } };
export const saveBase = b => { try { localStorage.setItem('mi.base', b); } catch (e) { } };

export function createMap(el, { center = [43.26, -2.93], zoom = 10, base = getBase() } = {}) {
  const map = L.map(el, { zoomControl: false, attributionControl: true, maxZoom: 20, tap: true }).setView(center, zoom);
  map.attributionControl.setPrefix(false);
  /* ign.es responde con Access-Control-Allow-Origin:* (verificado con una tesela de Bizkaia): crossOrigin permite que el SW guarde las teselas vistas para usarlas sin cobertura */
  const sat = L.tileLayer(PNOA, { maxNativeZoom: 19, maxZoom: 20, crossOrigin: true, errorTileUrl: VACIA, attribution: 'Imágenes PNOA/Sentinel © IGN España · CC BY 4.0 scne.es' });
  const calle = L.tileLayer(OSM, { maxNativeZoom: 19, maxZoom: 20, crossOrigin: true, errorTileUrl: VACIA, attribution: '© OpenStreetMap' });
  const layers = { sat, calle }; let cur = base;
  layers[cur].addTo(map);
  map.setBase = b => { if (b === cur) return cur; map.removeLayer(layers[cur]); cur = b; layers[cur].addTo(map); saveBase(cur); map.getContainer().dataset.base = cur; return cur; };
  map.getBase = () => cur;
  map.getContainer().dataset.base = cur;
  /* según el zoom: lejos solo puntos y spots sin nombre; cerca, fotos y nombres */
  const zc = () => { const z = map.getZoom(), c = map.getContainer().classList; c.toggle('z-far', z < 14); c.toggle('z-mid', z >= 14 && z < 16); };
  map.on('zoomend', zc); zc();
  return map;
}
/* Hallazgo: burbuja con la foto (la tuya o la de referencia de la especie) y el borde del color de su clase */
export function pin(h, { color, foto = '', ok = false, enz = false, ...opts } = {}) {
  const c = color || (IDENT[h.identificacion] || IDENT.sin_identificar).color;
  return L.marker([h.lat, h.lon], { icon: L.divIcon({ className: 'pin' + (ok ? ' ok' : '') + (enz ? ' enz' : ''), html: '<i style="--c:' + c + '">' + (foto ? '<img src="' + esc(foto) + '" alt="" loading="lazy" crossorigin="anonymous">' : '') + '</i>', iconSize: [32, 32], iconAnchor: [16, 16] }), ...opts });
}
const GLIFO = {
  seta: '<svg viewBox="0 0 24 24"><path d="M12 4C7 4 3.5 7.3 3.5 11.2c0 .5.4.8.8.8h15.4c.4 0 .8-.3.8-.8C20.5 7.3 17 4 12 4z"/><path d="M9.6 13h4.8v3.6c0 1.9-1 3.2-2.4 3.2s-2.4-1.3-2.4-3.2z"/></svg>',
  flag: '<svg viewBox="0 0 24 24"><path d="M6 21V3.5h1.9v1h9.8l-2.3 4 2.3 4H7.9V21z"/></svg>'
};
/* Spot: chincheta con número de especies y nombre debajo */
export function spotPin(z, { n = 0, ...opts } = {}) {
  const por = z.estado === 'por_visitar';
  const html = '<div class="spm"><svg class="gota" viewBox="0 0 36 46"><path d="M18 44S33 29.4 33 17.5A15 15 0 0 0 3 17.5C3 29.4 18 44 18 44z"/></svg><span class="gl">' + (por ? GLIFO.flag : GLIFO.seta) + '</span>' + (n ? '<b>' + n + '</b>' : '') + '</div><span class="lbl">' + esc(z.nombre || 'Spot') + '</span>';
  return L.marker([z.lat, z.lon], { icon: L.divIcon({ className: 'spot' + (por ? ' por' : ''), html, iconSize: [36, 46], iconAnchor: [18, 45] }), title: z.nombre, zIndexOffset: 400, riseOnHover: true, ...opts });
}
export function dragPin() {
  return (lat, lon) => L.marker([lat, lon], { draggable: true, zIndexOffset: 1000, icon: L.divIcon({ className: 'pin drag', html: '<i></i>', iconSize: [30, 30], iconAnchor: [15, 15] }) });
}
