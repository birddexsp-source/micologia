/* Mapa Leaflet: satélite IGN (PNOA) por defecto, callejero OSM conmutable. */
export const PNOA = 'https://www.ign.es/wmts/pnoa-ma?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=OI.OrthoimageCoverage&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg';
export const OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const IDENT = { sin_identificar: { label: 'Sin identificar', color: '#9aa5a1' }, provisional: { label: 'Provisional', color: '#e0a458' }, confirmada: { label: 'Confirmada por experto', color: '#4cc3d9' } };
export const getBase = () => { try { return localStorage.getItem('mi.base') === 'calle' ? 'calle' : 'sat'; } catch (e) { return 'sat'; } };
export const saveBase = b => { try { localStorage.setItem('mi.base', b); } catch (e) { } };

export function createMap(el, { center = [43.26, -2.93], zoom = 10, base = getBase() } = {}) {
  const map = L.map(el, { zoomControl: false, attributionControl: true, maxZoom: 20, tap: true }).setView(center, zoom);
  map.attributionControl.setPrefix(false);
  /* ign.es responde con Access-Control-Allow-Origin:* (verificado con una tesela de Bizkaia): crossOrigin permite que el SW guarde las teselas vistas para usarlas sin cobertura */
  const sat = L.tileLayer(PNOA, { maxNativeZoom: 19, maxZoom: 20, crossOrigin: true, attribution: 'Imágenes PNOA/Sentinel © IGN España · CC BY 4.0 scne.es' });
  const calle = L.tileLayer(OSM, { maxNativeZoom: 19, maxZoom: 20, attribution: '© OpenStreetMap' });
  const layers = { sat, calle }; let cur = base;
  layers[cur].addTo(map);
  map.setBase = b => { if (b === cur) return cur; map.removeLayer(layers[cur]); cur = b; layers[cur].addTo(map); saveBase(cur); return cur; };
  map.getBase = () => cur;
  return map;
}
export function pin(h, opts = {}) {
  const c = (IDENT[h.identificacion] || IDENT.sin_identificar).color;
  return L.marker([h.lat, h.lon], { icon: L.divIcon({ className: 'pin', html: '<i style="--c:' + c + '"></i>', iconSize: [24, 24], iconAnchor: [12, 12] }), ...opts });
}
export function dragPin() {
  return (lat, lon) => L.marker([lat, lon], { draggable: true, icon: L.divIcon({ className: 'pin drag', html: '<i></i>', iconSize: [30, 30], iconAnchor: [15, 15] }) });
}
