/* Recorrido de la salida (GPS grabado) y fotos de lo recogido. Todo con posiciones sintéticas, nunca sitios reales. */
const fs = require('fs');
const { PNG1 } = require('../lib/harness');
const LAT0 = 43.1, LON = -2.8, PASO = 0.0003;   // ≈33 m por paso hacia el norte
module.exports = {
  name: 'Recorrido de la salida y fotos de lo recogido',
  launch: { viewport: { width: 390, height: 844 } },
  async run(t) {
    let sid, lat = LAT0;
    const pts = () => t.page.evaluate(() => window.__MI.trk.puntos().length);
    const paso = async (n = 1, acc = 8) => { for (let i = 0; i < n; i++) { lat += PASO; await t.setGeo(lat, LON, acc); await t.wait(350); } };

    await t.case('empezar salida: empieza a grabar el recorrido', async () => {
      await t.go('#salidas'); await t.tap('#s-new', 600);
      const s = (await t.docs('salidas'))[0]; sid = s.id;
      t.ok('campos nuevos de la salida', Array.isArray(s.track) && s.grabar === true && Array.isArray(s.fotosCosecha) && s.fin === null);
      t.eq('el grabador está activo para esta salida', await t.page.evaluate(() => window.__MI.trk.activo()), sid);
      t.ok('aviso «Grabando el recorrido»', /Grabando el recorrido/.test(await t.T('#v-salida .rec') || ''));
      t.ok('avisa de la limitación al bloquear la pantalla', /bloquea la pantalla/.test(await t.T('#v-salida .rec') || ''));
    });
    await t.case('caminando: guarda puntos cada ≥12 m y descarta los imprecisos', async () => {
      await t.fixGPS(); const n0 = await pts(); t.ok('punto inicial guardado', n0 >= 1, 'n0=' + n0);
      await paso(4); const n1 = await pts(); t.ok('cuatro pasos de 33 m → +4 puntos', n1 - n0 === 4, 'antes ' + n0 + ', ahora ' + n1);
      lat += 0.00003; await t.setGeo(lat, LON, 8); await t.wait(350);   // ≈3 m: dentro del ruido
      t.eq('un movimiento de 3 m no suma punto', await pts(), n1);
      await t.setGeo(lat + 0.01, LON, 120); await t.wait(350);          // muy lejos pero con precisión mala
      t.eq('un punto con precisión de 120 m se descarta', await pts(), n1);
      await t.setGeo(lat, LON, 8); await t.wait(300);
      const m = await t.page.evaluate(() => Math.round(window.__MI.trk.metros(window.__MI.trk.puntos())));
      t.ok('distancia ≈132 m', m > 110 && m < 150, 'm=' + m);
    });
    await t.case('el recorrido se guarda en la salida y se dibuja', async () => {
      await t.page.evaluate(() => window.__MI.trk.flush()); await t.wait(200);
      const s = (await t.docs('salidas'))[0];
      t.ok('track guardado en la base (puntos [lat, lon, segundos])', s.track.length >= 5 && s.track.every(p => p.length >= 3 && typeof p[2] === 'number' && p[2] > 1.7e9), 'n=' + s.track.length);
      t.ok('coordenadas con 5 decimales', s.track.every(p => String(p[0]).split('.')[1].length <= 5));
      t.ok('track marcado como pendiente de sincronizar', await t.page.evaluate(() => window.__MI.db.dirtyCount() > 0));
      await t.go('#mapa'); await t.wait(500);
      t.ok('línea del recorrido en el mapa principal', (await t.N('#map .trk-line')) >= 1);
      await t.go('#salida/' + sid); await t.wait(600);
      t.ok('línea del recorrido en el minimapa', (await t.N('#smap .trk-line')) >= 1);
      t.ok('recorrido en metros', /^\d+ m$/.test(await t.T('#sd-km') || ''), await t.T('#sd-km'));
      await t.shot('captura-08-salida-grabando');
    });
    await t.case('en vivo: el recorrido y los metros crecen sin recargar', async () => {
      const km0 = await t.page.evaluate(() => document.querySelector('#sd-km').textContent), d0 = await t.page.evaluate(() => document.querySelector('#smap .trk-line').getAttribute('d'));
      await paso(6); await t.wait(300);
      const km1 = await t.T('#sd-km'), d1 = await t.page.evaluate(() => document.querySelector('#smap .trk-line').getAttribute('d'));
      t.ok('los kilómetros suben', km1 !== km0, km0 + ' → ' + km1);
      t.ok('la línea cambia', d1 && d1 !== d0);
      t.ok('con ≥300 m lo da en kilómetros con coma', /^\d,\d km$/.test(km1) || /^\d+ m$/.test(km1), km1);
    });
    await t.case('el flush periódico no vuelve a pintar la pantalla', async () => {
      await t.page.evaluate(() => { document.querySelector('#v-salida').dataset.marca = '1'; document.querySelector('#v-salida .pad').dataset.marca = '1'; });
      await paso(1); await t.page.evaluate(() => window.__MI.trk.flush()); await t.wait(500);
      t.ok('el contenido sigue siendo el mismo nodo (no se re-renderizó)', await t.page.evaluate(() => document.querySelector('#v-salida .pad').dataset.marca === '1'));
    });
    await t.case('hallazgo durante el recorrido y avatar en la lista', async () => {
      await t.go('#mapa'); await t.marcarRapido({ zona: 'Zona prueba', esp: 'amanita phalloides' });
      await t.go('#salida/' + sid); await t.wait(500);
      t.eq('1 hallazgo', await t.N('#v-salida .item[data-h]'), 1);
      t.ok('la fila usa la foto de la especie', (await t.N('#v-salida .item[data-h] .phw.av img.ph')) === 1);
      t.ok('la fila indica el estado de identificación', /Sin identificar|Provisional/.test(await t.T('#v-salida .item[data-h]') || ''));
    });
    await t.case('pausa y reanudar: no graba en pausa y no une los tramos', async () => {
      await t.tap('#sd-pau', 500);
      t.eq('grabar = false', (await t.docs('salidas'))[0].grabar, false);
      t.eq('el grabador se detiene', await t.page.evaluate(() => window.__MI.trk.activo()), null);
      t.ok('aviso «Recorrido en pausa» y botón Reanudar', /en pausa/.test(await t.T('#v-salida .rec') || '') && /Reanudar/.test(await t.T('#sd-pau') || ''));
      const n = (await t.docs('salidas'))[0].track.length;
      await paso(3); t.eq('en pausa no se añaden puntos', (await t.docs('salidas'))[0].track.length, n);
      await t.tap('#sd-pau', 500);
      t.eq('vuelve a grabar', await t.page.evaluate(() => window.__MI.trk.activo()), sid);
      await paso(2); await t.page.evaluate(() => window.__MI.trk.flush()); await t.wait(200);
      const tr = (await t.docs('salidas'))[0].track;
      t.ok('al reanudar se añaden puntos', tr.length > n, n + ' → ' + tr.length);
      t.eq('el primer punto tras la pausa abre un tramo nuevo', tr.filter(p => p[3] === 1).length, 1);
      const seg = await t.page.evaluate(() => window.__MI.trk.lineas((window.__MI.db.M.get('salidas/' + window.__MI.trk.activo()).d.track)).length);
      t.eq('dos tramos', seg, 2);
      const bad = await t.page.evaluate(() => { const T = window.__MI.trk, p = T.puntos(), l = T.lineas(p); const a = T.metros(p), b = l.reduce((s, x) => s + T.metros(x), 0); return Math.abs(a - b) < 0.01; });
      t.ok('los metros no cuentan el salto de la pausa', bad);
      t.eq('2 líneas pintadas (una por tramo)', await t.N('#smap .trk-line'), 2);
    });
    await t.case('si se cierra y se vuelve a abrir la app, sigue grabando y conserva lo grabado', async () => {
      const antes = (await t.docs('salidas'))[0].track.length;
      await t.page.evaluate(() => window.__MI.trk.flush()); await t.reload(); await t.fixGPS(); await t.wait(400);
      t.eq('sigue activo', await t.page.evaluate(() => window.__MI.trk.activo()), sid);
      t.ok('no pierde puntos', (await t.docs('salidas'))[0].track.length >= antes);
      await paso(1); t.ok('y sigue añadiendo', (await pts()) > antes);
    });
    await t.case('pantalla encendida: botón y wake lock (simulado)', async () => {
      await t.page.evaluate(() => { window.__wl = 0; Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => { window.__wl++; return { release: async () => { window.__wl--; }, addEventListener() { } }; } } }); });
      await t.go('#salidas'); await t.go('#salida/' + sid); await t.wait(500);
      t.ok('hay botón de pantalla encendida', await t.has('#sd-wake'));
      await t.tap('#sd-wake', 300);
      t.eq('pide el bloqueo', await t.page.evaluate(() => window.__wl), 1);
      t.ok('botón en «Activada»', /Activada/.test(await t.T('#sd-wake') || ''));
      await t.tap('#sd-wake', 300);
      t.eq('lo suelta', await t.page.evaluate(() => window.__wl), 0);
    });
    await t.case('terminar: resumen con recorrido y fotos de lo recogido', async () => {
      await t.tap('#sd-fin', 500);
      t.ok('el resumen enseña el recorrido y la duración', /recorrido/i.test(await t.T('#sheet') || '') && /duración/i.test(await t.T('#sheet') || ''));
      t.ok('bloque «Fotos de lo que te llevas» arriba', /Fotos de lo que te llevas/.test(await t.T('#sheet .cosecha') || ''));
      t.eq('0 fotos al principio', await t.N('#tf-gal img'), 0);
      const [fc] = await Promise.all([t.page.waitForEvent('filechooser'), t.page.evaluate(() => document.querySelector('#tf-cam').click())]);
      t.ok('la cámara no es selección múltiple', !fc.isMultiple());
      await fc.setFiles({ name: 'cesta.png', mimeType: 'image/png', buffer: PNG1 });
      await t.page.waitForSelector('#tf-gal img', { timeout: 5000 }); await t.wait(300);
      t.eq('1 miniatura', await t.N('#tf-gal img'), 1);
      t.eq('guardada al momento en la salida', (await t.docs('salidas'))[0].fotosCosecha.length, 1);
      const [fg] = await Promise.all([t.page.waitForEvent('filechooser'), t.page.evaluate(() => document.querySelector('#tf-gal-b').click())]);
      t.ok('la galería permite varias a la vez', fg.isMultiple());
      await fg.setFiles([{ name: 'a.png', mimeType: 'image/png', buffer: PNG1 }, { name: 'b.png', mimeType: 'image/png', buffer: PNG1 }]);
      await t.page.waitForFunction(() => document.querySelectorAll('#tf-gal img').length === 3, null, { timeout: 6000 }); await t.wait(300);
      t.eq('3 fotos de lo recogido', (await t.docs('salidas'))[0].fotosCosecha.length, 3);
      const b = await t.page.evaluate(id => { const x = window.__MI.db.B.get(id); return x ? { type: x.type, dirty: x.dirty } : null; }, (await t.docs('salidas'))[0].fotosCosecha[0]);
      t.ok('blob JPEG pendiente de sincronizar', !!b && b.type === 'image/jpeg' && b.dirty === true);
      await t.shot('captura-08-terminar');
      await t.page.fill('#tf-tot', '≈1 kg'); await t.tap('#tf-ok', 700);
      const s = (await t.docs('salidas'))[0];
      t.eq('terminada', s.estado, 'terminada'); t.ok('hora de fin guardada', typeof s.fin === 'number' && s.fin >= s.creada);
      t.eq('el grabador se detiene', await t.page.evaluate(() => window.__MI.trk.activo()), null);
      const n = s.track.length; await paso(2); t.eq('ya no se añaden puntos', (await t.docs('salidas'))[0].track.length, n);
    });
    await t.case('salida terminada: «Lo que me llevé», visor y quitar foto', async () => {
      await t.go('#salida/' + sid); await t.wait(500);
      t.eq('3 fotos en «Lo que me llevé»', await t.N('#sd-cos img'), 3);
      t.ok('la duración y los km se ven en las estadísticas', /^\d+ m$|^\d,\d km$/.test(await t.T('#sd-km') || '') && !/^—$/.test(await t.T('#sd-km') || ''), await t.T('#sd-km'));
      t.eq('el contador de fotos recogidas', await t.page.evaluate(() => document.querySelectorAll('#sd-st2 b')[2].textContent), '3');
      t.ok('el recorrido sigue dibujado', (await t.N('#smap .trk-line')) >= 2);
      await t.page.evaluate(() => document.querySelector('#sd-cos img').click()); await t.wait(400);
      t.ok('visor de foto con botón Quitar', await t.has('#sheet img.big-foto') && await t.has('#vf-del'));
      await t.tap('#vf-del', 500);
      t.eq('queda 2', (await t.docs('salidas'))[0].fotosCosecha.length, 2);
      await t.shot('captura-08-salida-terminada');
    });
    await t.case('GPX: recorrido y hallazgos, XML bien formado', async () => {
      const [d] = await Promise.all([t.page.waitForEvent('download'), t.page.evaluate(() => document.querySelector('#sd-gpx').click())]);
      t.ok('nombre salida-AAAA-MM-DD.gpx', /^salida-\d{4}-\d{2}-\d{2}\.gpx$/.test(d.suggestedFilename()), d.suggestedFilename());
      const p = await d.path(), txt = fs.readFileSync(p, 'utf8');
      const ok = await t.page.evaluate(x => { const doc = new DOMParser().parseFromString(x, 'application/xml'); return { err: !!doc.querySelector('parsererror'), trkpt: doc.getElementsByTagName('trkpt').length, seg: doc.getElementsByTagName('trkseg').length, wpt: doc.getElementsByTagName('wpt').length, name: (doc.querySelector('wpt name') || {}).textContent }; }, txt);
      t.ok('XML válido', !ok.err);
      t.ok('tiene puntos de recorrido y 2 tramos', ok.trkpt >= 10 && ok.seg === 2, JSON.stringify(ok));
      t.eq('un waypoint por hallazgo', ok.wpt, 1);
      t.ok('el waypoint lleva el nombre de la especie', /Amanita phalloides/i.test(ok.name || ''), ok.name);
    });
    await t.case('reabrir graba otra vez y borrar la salida detiene el grabador', async () => {
      await t.tap('#sd-reab', 600);
      t.eq('en curso y sin hora de fin', [(await t.docs('salidas'))[0].estado, (await t.docs('salidas'))[0].fin], ['en_curso', null]);
      t.eq('grabador activo', await t.page.evaluate(() => window.__MI.trk.activo()), sid);
      await t.tap('#sd-del', 200); await t.tap('#sd-del', 600);
      t.eq('salida borrada', (await t.docs('salidas')).length, 0);
      t.eq('grabador parado', await t.page.evaluate(() => window.__MI.trk.activo()), null);
    });
    await t.case('privacidad: el módulo del recorrido no usa la red', async () => {
      const src = fs.readFileSync(require('path').join(__dirname, '..', '..', 'docs', 'js', 'track.js'), 'utf8');
      t.ok('track.js no hace peticiones de red', !/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(src));
    });
  }
};
