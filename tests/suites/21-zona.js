/* Zona de la salida (círculo que cubre sus spots y hallazgos), spot por defecto dentro de una salida y «la gente también cuenta» en el modelo. */
const MOD = "const z = await import('./js/zona.js'), m = await import('./js/modelo.js');";
module.exports = {
  name: 'Zona de la salida y presión de recolectores',
  launch: { viewport: { width: 390, height: 844 }, geo: { latitude: 43.4, longitude: -2.7468, accuracy: 8 } },
  async run(t) {
    const E = (fn, arg) => t.page.evaluate(new Function('arg', 'return (async()=>{' + MOD + fn + '})()'), arg);
    await t.case('zona: el círculo cubre todos los puntos y tiene un radio mínimo', async () => {
      const r = await E(`
        const A = { lat: 43.3986, lon: -2.7468 }, B = { lat: 43.3986 + 0.002, lon: -2.7468 }, C = { lat: 43.3986 + 0.001, lon: -2.7468 + 0.002 };
        const c = z.circulo([A, B, C]), solo = z.circulo([A]), nada = z.circulo([]);
        return { c, solo, nada, cubre: [A, B, C].every(p => z.dist(c, p) <= c.r), dAB: Math.round(z.dist(A, B)) };`);
      t.ok('cubre los tres puntos y el radio es mayor que media distancia', r.cubre && r.c.r > r.dAB / 2 && r.c.n === 3, JSON.stringify(r.c));
      t.eq('un solo punto: radio mínimo de 40 m; sin puntos: nada', [r.solo.r, r.nada], [40, null]);
    });
    await t.case('zona de una salida: junta sus spots y los hallazgos (también los que no tienen spot) y no mezcla otras salidas', async () => {
      const r = await E(`
        const zonas = [{ id: 'a', lat: 43.40, lon: -2.75 }, { id: 'b', lat: 43.402, lon: -2.75 }, { id: 'lejos', lat: 43.5, lon: -2.9 }];
        const hs = [{ id: '1', salidaId: 's1', zonaId: 'a', lat: 43.40, lon: -2.75, especieId: 'x' }, { id: '2', salidaId: 's1', zonaId: null, lat: 43.401, lon: -2.7515, especieId: 'y' }, { id: '3', salidaId: 's2', zonaId: 'lejos', lat: 43.5, lon: -2.9, especieId: 'x' }];
        return { s1: z.zonaSalida({ id: 's1', zonaIds: ['a', 'b'] }, hs, zonas), s2: z.zonaSalida({ id: 's2', zonaIds: [] }, hs, zonas), vacia: z.zonaSalida({ id: 's9', zonaIds: [] }, hs, zonas) };`);
      t.ok('s1: 2 spots, 2 hallazgos, 2 especies y un radio de ~100–200 m', r.s1.spots === 2 && r.s1.hallazgos === 2 && r.s1.especies === 2 && r.s1.r > 100 && r.s1.r < 220, JSON.stringify(r.s1));
      t.ok('s2 es otra zona (a kilómetros) y una salida sin nada no tiene zona', r.s2.lat > 43.49 && r.vacia === null);
    });
    await t.case('spot por defecto: dentro de una salida elige el más cercano de ESA salida (hasta 600 m)', async () => {
      const r = await E(`
        const zonas = [{ id: 'a', lat: 43.400, lon: -2.75 }, { id: 'b', lat: 43.404, lon: -2.75 }, { id: 'otra', lat: 43.4025, lon: -2.75 }];
        const pos = n => ({ lat: n, lon: -2.75 });
        return { dentro: z.spotDefecto(pos(43.4023), zonas, { zonaIds: ['a', 'b'] }), lejosDeSalida: z.spotDefecto(pos(43.45), zonas, { zonaIds: ['a', 'b'] }),
          sinSalida150: z.spotDefecto(pos(43.4026), zonas, null), sinSalidaLejos: z.spotDefecto(pos(43.41), zonas, null), sinGPS: z.spotDefecto(null, zonas, { zonaIds: ['a'] }) };`);
      t.eq('el más cercano de la salida (b), no el de fuera (otra)', r.dentro, 'b');
      t.eq('muy lejos de la salida: ninguno; sin salida: el de <150 m; sin GPS: ninguno', [r.lejosDeSalida, r.sinSalida150, r.sinSalidaLejos, r.sinGPS], [null, 'otra', null, null]);
    });
    await t.case('modelo: la gente cuenta (lunes -30 %, jueves y viernes no, solo candidatas a comestibles, sin depender de la lluvia)', async () => {
      const r = await E(`
        const dias = {}, v = (e, f) => m.presion(e, dias, f), com = { candidataComestible: true };
        return { lunes: v(com, '2026-11-16').v, martes: v(com, '2026-11-17').v, jueves: v(com, '2026-11-19').v, viernes: v(com, '2026-11-20').v, noCom: v({}, '2026-11-16').v, dia: v(com, '2026-11-16').dia };`);
      t.ok('lunes: baja un 30 %', r.lunes === 0.7 && r.dia === 'lunes', JSON.stringify(r));
      t.ok('martes baja menos; jueves y viernes no bajan; las demás no bajan', r.martes > r.lunes && r.martes < 1 && r.jueves === 1 && r.viernes === 1 && r.noCom === 1);
    });
    await t.case('modelo: puntuar lo aplica y lo explica; el jueves puntúa más que el lunes con el mismo tiempo', async () => {
      const r = await E(`
        const dias = {}; for (let i = 1; i <= 30; i++) dias['2026-11-' + String(i).padStart(2, '0')] = { p: [7, 14, 15].includes(i) ? 14 : 3, tmed: 13, tmin: 8, tmax: 17 };
        const e = window.__MI.cat.byId('boletus-edulis'), nc = window.__MI.cat.byId('amanita-phalloides');
        const l = m.puntuar(e, dias, '2026-11-16'), j = m.puntuar(e, dias, '2026-11-19'), n1 = m.puntuar(nc, dias, '2026-11-16'), n2 = m.puntuar(nc, dias, '2026-11-19');
        return { l: l.crudo, j: j.crudo, expL: l.explicacion.filter(x => x.k === 'gente').map(x => x.t), expJ: j.explicacion.filter(x => x.k === 'gente').map(x => x.t), n1: n1.crudo, n2: n2.crudo, gl: l.x.gente.v };`);
      t.ok('con el mismo tiempo el jueves puntúa más que el lunes (comestible)', r.j > r.l, JSON.stringify(r));
      t.ok('explica «hay que contar con la gente» como hipótesis', r.expL.length === 1 && /gente/.test(r.expL[0]) && /hipótesis/.test(r.expL[0]) && !/comestible/.test(r.expL[0]) && /poca gente/.test(r.expJ[0]));
      t.ok('una no comestible puntúa igual lunes y jueves en cuanto a gente', r.gl === 0.7);
    });
    /* ---------- pantallas ---------- */
    await t.case('salida: se dibuja la zona (círculo) en el minimapa y la ficha dice el radio', async () => {
      await t.put('zonas', 'zz1', { nombre: 'Pinar A', estado: 'visitada', lat: 43.3986, lon: -2.7468 });
      await t.put('zonas', 'zz2', { nombre: 'Robledal B', estado: 'visitada', lat: 43.4004, lon: -2.7468 });
      await t.put('salidas', 'sz', { fecha: '2026-11-16', titulo: 'Zona', notas: '', zonaIds: ['zz1', 'zz2'], fotos: [], fotosCosecha: [], track: [], grabar: false, estado: 'terminada', creada: Date.now() });
      await t.put('hallazgos', 'hz1', { salidaId: 'sz', zonaId: null, lat: 43.3995, lon: -2.7480, precisionM: 5, ts: Date.now(), especieId: 'boletus-edulis', especieTxt: '', fotos: [], identificacion: 'provisional' });
      await t.go('#salida/sz'); await t.wait(700);
      t.eq('un círculo de zona en el minimapa', await t.N('#smap .zona-circ'), 1);
      t.ok('la pestaña Spots lo cuenta', /Zona de la salida/.test(await t.T('.tabp[data-p="spots"] .zona-i') || '') && /2 spots/.test(await t.T('.zona-i') || ''));
      await t.shot('zona-salida');
    });
    await t.case('mapa: la zona de la salida sale en el mapa principal y se puede ocultar con «Hallazgos»', async () => {
      await t.go('#mapa'); await t.wait(900);
      t.eq('un círculo de zona en el mapa', await t.N('#map .zona-circ'), 1);
      await t.shot('zona-mapa');
    });
    await t.case('hallazgo dentro de una salida en curso: el spot por defecto es el de la salida aunque haya otro más cerca', async () => {
      await t.put('salidas', 'sc', { fecha: '2026-11-16', titulo: 'En curso', notas: '', zonaIds: ['zz1'], fotos: [], fotosCosecha: [], track: [], grabar: false, estado: 'en_curso', creada: Date.now() });
      await t.go('#salida/sc'); await t.fixGPS(); await t.tap('#sd-mk', 600);
      const on = await t.page.evaluate(() => { const b = document.querySelector('#mk-zonas .opt.on'); return b ? b.textContent : null; });
      t.eq('viene elegido «Pinar A» (el de la salida), no «Robledal B»', on, 'Pinar A');
      await t.tap('#mk-x', 300).catch(() => { });
    });
    await t.case('nota de voz en la salida: el spot sale elegido, no «Ninguno»', async () => {
      await t.page.evaluate(() => window.__MI.S && document.querySelector('#sheet') && document.querySelector('#sheet').hidden === false && document.querySelector('#sheet').click());
      await t.go('#salida/sc'); await t.wait(400); await t.tap('#sd-vozq', 500);
      t.eq('spot por defecto de la nota', await t.page.inputValue('#dn-zona'), 'zz1');
    });
  }
};
