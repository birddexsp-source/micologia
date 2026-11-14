/* Mapa sin conexión: cuentas de teselas, descarga a la caché propia, reintentos, y el caso real:
   con la red cortada el mapa se pinta desde lo guardado, se registran spots y hallazgos, y al volver la red se sincronizan solos. */
const { FakeGH, PNG1 } = require('../lib/harness');
const REPO = 'usuario/micologia-datos', TOKEN = 'token-sintetico-de-prueba-123';
const Z = { lat: 43.1012, lon: -2.8031 };   // spot sintético
const OFFMOD = "const m = await import('./js/offline.js');";
module.exports = {
  name: 'Mapa sin conexión (descarga, uso sin red y sincronización al volver)',
  launch: { viewport: { width: 390, height: 844 } },
  async run(t) {
    const E = (fn, arg) => t.page.evaluate(new Function('arg', 'return (async()=>{' + OFFMOD + fn + '})()'), arg);
    await t.case('cuentas de teselas: sin repetir, mismas URL que pide Leaflet', async () => {
      const r = await E(`
        const caja = m.cajaAlrededor(${Z.lat}, ${Z.lon}, 2), l = m.teselas([caja], 16), k = new Set(l.map(a => a.join('/')));
        const doble = m.teselas([caja, caja], 16).length;
        const z9 = l.filter(a => a[0] === 9).length, z16 = l.filter(a => a[0] === 16).length;
        const u = m.urlTesela(16, 32000, 23000);
        return { n: l.length, unicas: k.size, doble, z9, z16, u, maxz: Math.max(...l.map(a => a[0])), minz: Math.min(...l.map(a => a[0])),
          corte: m.cajaAlrededor(43, -3, 1), mb: m.estimarMB(1000), grande: m.demasiadas(20000), chico: m.demasiadas(100) };`);
      t.ok('hay teselas y ninguna repetida', r.n > 50 && r.n === r.unicas);
      t.eq('dos cajas iguales no duplican', r.doble, r.n);
      t.ok('del zoom 9 al 16', r.minz === 9 && r.maxz === 16);
      t.ok('en el zoom 9 basta 1–4 teselas y en el 16 unas 10×10 (4 km / 447 m)', r.z9 >= 1 && r.z9 <= 4 && r.z16 >= 80 && r.z16 <= 140, JSON.stringify([r.z9, r.z16]));
      t.ok('la URL lleva zoom, columna y fila de PNOA', /TILEMATRIX=16&TILEROW=23000&TILECOL=32000/.test(r.u) && /ign\.es\/wmts\/pnoa-ma/.test(r.u));
      t.ok('la caja de 1 km mide ≈2 km de lado', Math.abs((r.corte[2] - r.corte[0]) * 111.32 - 2) < 0.05);
      t.ok('estimación y tope', r.mb === 21 && r.grande === true && r.chico === false);
      /* las URL de las teselas que pinta Leaflet están entre las que se descargarían */
      await t.page.evaluate(([la, lo]) => window.__MI.S.map.setView([la, lo], 16, { animate: false }), [Z.lat, Z.lon]); await t.wait(900);
      const dentro = await t.page.evaluate(async ([la, lo]) => {
        const m = await import('./js/offline.js'), set = new Set(m.teselas([m.cajaAlrededor(la, lo, 2)], 17).map(a => m.urlTesela(...a)));
        const src = [...document.querySelectorAll('#map .leaflet-tile')].map(i => i.src); return [src.length, src.filter(u => set.has(u)).length];
      }, [Z.lat, Z.lon]);
      t.ok('todas las teselas visibles coinciden con las descargables', dentro[0] > 0 && dentro[0] === dentro[1], JSON.stringify(dentro));
    });
    await t.case('Ajustes: sección, opciones y estimación', async () => {
      await t.go('#ajustes'); await t.wait(500);
      t.ok('aparece «Mapa sin conexión»', /Mapa sin conexión/.test(await t.T('#v-ajustes') || '') && await t.has('#off-go'));
      t.ok('sin spots, «Mis spots» está desactivado y se usa el centro del mapa', await t.page.evaluate(() => document.querySelector('[data-oz="spots"]').disabled && document.querySelector('[data-oz="centro"]').classList.contains('on')));
      const a = await t.T('#off-n'); await t.tap('[data-ok="10"]', 150); const b = await t.T('#off-n');
      const num = s => +((s.match(/≈ ([\d.]+) teselas/) || [])[1] || '0').replace(/\./g, '');
      t.ok('más radio → más teselas', num(b) > num(a) * 2, a + ' | ' + b);
      await t.tap('[data-od="alto"]', 150); t.ok('más detalle → más teselas', num(await t.T('#off-n')) > num(b));
      await t.tap('[data-ok="2"]', 100); await t.tap('[data-od="normal"]', 100);
      t.eq('sin nada descargado lo dice', await t.T('#off-tot'), 'Aún no has guardado ningún mapa.');
      t.ok('no hay botón de borrar todavía', !(await t.visible('#off-del')));
      /* desde el selector de capas del mapa */
      await t.go('#mapa'); await t.page.evaluate(([la, lo]) => window.__MI.S.map.setView([la, lo], 14, { animate: false }), [Z.lat, Z.lon]); await t.wait(300);
      await t.tap('#layerbtn', 300); t.ok('el selector de capas ofrece guardar el mapa', await t.has('#capa-off'));
      await t.tap('#capa-off', 600); t.eq('lleva a Ajustes', await t.page.evaluate(() => location.hash), '#ajustes');
      t.ok('con el centro del mapa elegido', await t.page.evaluate(() => document.querySelector('[data-oz="centro"]').classList.contains('on')));
    });
    await t.case('descarga: guarda en la caché propia, no repite y avisa de fallos', async () => {
      await t.put('zonas', 'zt1', { nombre: 'Boletus T', lat: Z.lat, lon: Z.lon, estado: 'visitada', notas: '' });
      await t.go('#mapa'); await t.go('#ajustes'); await t.wait(500);
      t.ok('con un spot, «Mis spots» ya se puede elegir', await t.page.evaluate(() => !document.querySelector('[data-oz="spots"]').disabled));
      await t.tap('[data-oz="spots"]', 100);
      await t.tap('[data-ok="2"]', 100);
      const est = +((await t.T('#off-n')).match(/≈ ([\d.]+) teselas/)[1].replace(/\./g, ''));
      const n0 = t.tileReqs.length;
      await t.tap('#off-go', 100);
      await t.page.waitForFunction(() => /✓ Mapa guardado/.test(document.querySelector('#off-st').textContent), null, { timeout: 30000 }).catch(async e => { console.log('ESTADO:', await t.T('#off-st'), '|', await t.T('#off-n')); throw e; });
      const c1 = await E(`const c = await caches.open(m.CACHE); return (await c.keys()).length;`);
      t.eq('la caché propia tiene tantas teselas como decía la estimación', c1, est);
      t.ok('se pidieron a la red', t.tileReqs.length - n0 >= est);
      t.ok('queda el botón de borrar', await t.visible('#off-del'));
      t.ok('el estado lo cuenta', new RegExp(est.toLocaleString('es-ES').replace('.', '\\.') + ' teselas en 1 zona').test(await t.T('#off-tot') || ''));
      t.eq('el spot figura como cubierto', await E(`return [m.cubierta(${Z.lat}, ${Z.lon}), m.cubierta(40.4, -3.7)];`), [true, false]);
      /* segunda vez: todo está ya guardado, no vuelve a pedir nada */
      const n1 = t.tileReqs.length; await t.tap('#off-go', 100);
      await t.page.waitForFunction(() => /ya estaban/.test(document.querySelector('#off-st').textContent), null, { timeout: 30000 });
      t.eq('segunda descarga: cero peticiones', t.tileReqs.length - n1, 0);
      /* fallos: el servidor rechaza algunas teselas */
      await t.page.route(/ign\.es.*TILEMATRIX=15&/, r => r.fulfill({ status: 503, body: 'no' }));
      await t.go('#mapa'); await t.page.evaluate(() => window.__MI.S.map.setView([42.9, -2.5], 12, { animate: false })); await t.go('#ajustes'); await t.wait(400);
      await t.tap('[data-oz="centro"]', 100); await t.tap('[data-ok="2"]', 100);
      await t.tap('#off-go', 100);
      await t.page.waitForFunction(() => /fallaron|Descargado con|✓/.test(document.querySelector('#off-st').textContent), null, { timeout: 40000 });
      t.ok('si fallan teselas lo dice y pide reintentar', /fallaron/.test(await t.T('#off-st') || ''), await t.T('#off-st'));
      t.eq('la zona incompleta no cuenta como cubierta', await E(`return m.cubierta(42.9, -2.5);`), false);
      await t.page.unroute(/ign\.es.*TILEMATRIX=15&/);
      await t.tap('#off-go', 100);
      await t.page.waitForFunction(() => /✓ Mapa guardado/.test(document.querySelector('#off-st').textContent), null, { timeout: 40000 });
      t.eq('al reintentar se completa y queda cubierta', await E(`return m.cubierta(42.9, -2.5);`), true);
      /* borrar */
      await t.tap('#off-del', 100); await t.tap('#off-del', 300);
      t.eq('borrar vacía la caché', await E(`const c = await caches.open(m.CACHE); return [(await c.keys()).length, m.zonas().length];`), [0, 0]);
    });
    await t.case('sin conexión de verdad: el mapa sale de lo guardado, se registra y al volver la red se sincroniza', async () => {
      const gh = new FakeGH(), ctx = await t.context({ sw: true }), p = await t.newPage(ctx);
      let simuladas = 0; const tiles = r => { simuladas++; r.fulfill({ status: 200, contentType: 'image/png', body: PNG1, headers: { 'access-control-allow-origin': '*' } }); };
      const reTiles = /ign\.es|tile\.openstreetmap\.org/;
      await ctx.route(reTiles, tiles);          // también alcanza al service worker
      await p.addInitScript(() => { try { if (!localStorage.getItem('mi.cfg')) localStorage.setItem('mi.cfg', JSON.stringify({ repo: 'usuario/micologia-datos', token: 'token-sintetico-de-prueba-123' })); } catch (e) { } });
      await p.goto(t.opts.url + '#mapa'); await p.waitForSelector('body[data-ready="1"]');
      await p.evaluate(async () => { await navigator.serviceWorker.ready; });
      await p.reload(); await p.waitForSelector('body[data-ready="1"]');
      await p.evaluate(([la, lo]) => window.__MI.db.set('zonas', 'zo1', { nombre: 'Spot offline', lat: la, lon: lo, estado: 'visitada', notas: '' }), [Z.lat, Z.lon]);
      await p.evaluate(() => { location.hash = '#ajustes'; }); await p.waitForSelector('#off-go');
      await p.click('[data-ok="2"]'); await p.click('#off-go');
      await p.waitForFunction(() => /✓ Mapa guardado/.test(document.querySelector('#off-st').textContent), null, { timeout: 40000 }).catch(async e => { console.log('ESTADO:', await p.evaluate(() => [document.querySelector('#off-st').textContent, document.querySelector('#off-n').textContent, navigator.serviceWorker.controller && 'ctl'])); throw e; });
      const guardadas = await p.evaluate(async () => (await (await caches.open('mapa-offline-v1')).keys()).length);
      t.ok('mapa guardado con el service worker activo', guardadas > 100, String(guardadas));
      /* a partir de aquí: ni red ni simulador de teselas; solo lo guardado */
      await ctx.unroute(reTiles, tiles); const antes = simuladas; await p.unrouteAll({ behavior: 'ignoreErrors' });
      await ctx.setOffline(true);
      await p.reload(); await p.waitForSelector('body[data-ready="1"]', { timeout: 15000 });
      t.ok('sin red la app arranca', true);
      await p.evaluate(() => { location.hash = '#mapa'; }); await p.waitForTimeout(400);
      const vista = async (la, lo, z) => { await p.evaluate(([a, b, c]) => window.__MI.S.map.setView([a, b], c, { animate: false }), [la, lo, z]); await p.waitForTimeout(1500); return p.evaluate(() => [document.querySelectorAll('#map .leaflet-tile').length, [...document.querySelectorAll('#map .leaflet-tile-loaded')].filter(i => /ign\.es/.test(i.src)).length]); };   // los huecos (tesela vacía) no cuentan
      const dentro = await vista(Z.lat, Z.lon, 16), fuera = await vista(40.4, -3.7, 16);
      t.eq('de verdad sin simulador de red: ninguna tesela llegó de fuera', simuladas, antes);
      t.ok('zona descargada: todas las teselas se pintan sin red', dentro[0] > 0 && dentro[0] === dentro[1], JSON.stringify(dentro));
      t.eq('zona NO descargada: ninguna tesela (sin red no hay mapa)', fuera[1], 0);
      const hasta = await vista(Z.lat, Z.lon, 17); t.ok('también a zoom 17 (el más cercano descargado)', hasta[1] > 0 && hasta[0] === hasta[1], JSON.stringify(hasta));
      /* registrar sin red */
      await p.evaluate(([la, lo]) => window.__MI.db.add('hallazgos', { zonaId: 'zo1', especieId: 'boletus-edulis', lat: la, lon: lo, fecha: Date.now(), cantidad: '2', identificacion: 'provisional' }), [Z.lat, Z.lon]);
      await p.evaluate(() => window.__MI.db.set('zonas', 'zo2', { nombre: 'Spot nuevo sin red', lat: 43.11, lon: -2.79, estado: 'por_visitar', notas: '' }));
      const pend = await p.evaluate(() => window.__MI.db.dirtyCount());
      t.ok('sin red: hallazgo y spot nuevos quedan pendientes en el móvil', pend >= 2, String(pend));
      await p.reload(); await p.waitForSelector('body[data-ready="1"]', { timeout: 15000 });
      const sigue = await p.evaluate(async () => [(await window.__MI.db.list('zonas')).length, (await window.__MI.db.list('hallazgos')).length]);
      t.eq('y sobreviven a cerrar y abrir sin red', sigue, [2, 1]);
      /* vuelve la red → sincroniza solo */
      await t.fakeGitHub(p, gh, REPO);
      await ctx.setOffline(false); await p.evaluate(() => window.dispatchEvent(new Event('online')));
      await p.waitForFunction(() => window.__MI.db.dirtyCount() === 0, null, { timeout: 20000 });
      const f = Object.keys(gh.files());
      t.ok('al volver la red se subieron solos los 2 spots y el hallazgo', f.filter(x => x.startsWith('data/zonas/')).length === 2 && f.some(x => x.startsWith('data/hallazgos/')), JSON.stringify(f));
      await ctx.close();
    });
  }
};
