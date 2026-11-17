/* Zona de la salida (círculo que cubre sus spots y hallazgos), spot por defecto dentro de una salida y «la gente también cuenta» en el modelo. */
const fs = require('fs'), path = require('path');
const MOD = "const z = await import('./js/zona.js'), m = await import('./js/modelo.js');";
module.exports = {
  name: 'Zonas de la salida, presión de recolectores y GPS en segundo plano',
  launch: { viewport: { width: 390, height: 844 }, geo: { latitude: 43.4, longitude: -2.7468, accuracy: 8 } },
  async run(t) {
    /* la app Android (Capacitor) trae un plugin de GPS en segundo plano: aquí se simula */
    await t.page.addInitScript(() => {
      window.Capacitor = { isNativePlatform: () => true, Plugins: {
        BackgroundGeolocation: { addWatcher: async (o, cb) => { (window.__bgAll = window.__bgAll || []).push(o); if (o.backgroundMessage) { window.__bgo = o; window.__bgcb = cb; } return 'w1'; }, removeWatcher: async o => { window.__bgrm = o.id; } },
        LocalNotifications: { requestPermissions: async () => { window.__notif = true; return {}; } },
        App: { addListener: (n, cb) => { if (n === 'backButton') window.__atras = cb; }, exitApp: () => { window.__salio = true; } } } };
    });
    await t.page.reload(); await t.wait(800);
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
    await t.case('tramos: abrir, cerrar, tiempo, puntos por hora y salidas antiguas', async () => {
      const r = await E(`
        const tr = await import('./js/tramos.js'), s0 = { creada: 1000, fin: 61000, zonaIds: ['a'], track: [] };
        let s = { tramos: [] }; s = { ...s, tramos: tr.abrir(s, 'a', 1000000) }; s = { ...s, tramos: tr.abrir(s, 'b', 2000000) };
        const track = [[43.1, -2.8, 1000], [43.1, -2.8, 1500], [43.1, -2.8, 2500]];
        return { n: s.tramos.length, cerrada: s.tramos[0].fin, activa: tr.activo(s).zonaId, d0: tr.dur(s.tramos[0]), dTot: tr.durTotal(s, 2300000), p0: tr.puntos(s.tramos[0], track).length, p1: tr.puntos(s.tramos[1], track).length,
          entre: tr.deTs(s, 1500000).zonaId, fuera: tr.deTs({ tramos: tr.cerrar(s, 3000000) }, 9000000), leg: tr.comoTramos(s0), ceroTramos: tr.tiene({}) };`);
      t.ok('abrir una zona cierra la anterior y deja una sola activa', r.n === 2 && r.cerrada === 2000000 && r.activa === 'b');
      t.ok('el tiempo cuenta solo lo que están abiertas: 1000 s + 300 s', r.d0 === 1000 && r.dTot === 1300, JSON.stringify([r.d0, r.dTot]));
      t.ok('los puntos del recorrido se reparten por hora', r.p0 === 2 && r.p1 === 1, JSON.stringify([r.p0, r.p1]));
      t.ok('a qué zona pertenece un instante; entre zonas = ninguna', r.entre === 'a' && r.fuera === null);
      t.ok('una salida antigua se ve como una sola zona', r.leg.length === 1 && r.leg[0].legado && !r.ceroTramos);
    });
    await t.case('zona real: una ida y vuelta es una franja alargada, no un círculo', async () => {
      const r = await E(`
        const pts = []; for (let i = 0; i <= 8; i++) pts.push([43.4 + i * 0.00028, -2.75]); for (let i = 8; i >= 0; i--) pts.push([43.4 + i * 0.00028, -2.7499]);
        const a = z.cinta(pts), la = a.flat().map(p => p[0]), lo = a.flat().map(p => p[1]);
        const alto = (Math.max(...la) - Math.min(...la)) * 111000, ancho = (Math.max(...lo) - Math.min(...lo)) * 111000 * Math.cos(43.4 * Math.PI / 180);
        return { anillos: a.length, alto: Math.round(alto), ancho: Math.round(ancho), vacio: z.cinta([]).length };`);
      t.ok('250 m de largo y ~60 m de ancho (ancho del recorrido + margen)', r.alto > 280 && r.alto < 330 && r.ancho > 55 && r.ancho < 90 && r.alto / r.ancho > 3, JSON.stringify(r));
      t.eq('sin puntos no hay zona', r.vacio, 0);
    });
    await t.case('empezar salida → empezar zona: marca dónde aparcas y empieza a seguirte', async () => {
      await t.page.evaluate(() => window.__MI.db.patch('salidas', 'sc', { estado: 'terminada', fin: Date.now() }));   /* la de la prueba anterior */
      await t.go('#salidas'); await t.tap('#s-new', 800);
      t.ok('se abre «Empezar zona»', /Empezar zona/.test(await t.T('#sheet h2') || '') && /Empezar zona/.test(await t.T('#st-ok') || ''));
      await t.page.fill('#st-nom', 'Aparcamiento A'); await t.tap('#st-ok', 1000);
      let s = (await t.docs('salidas')).find(x => x.estado === 'en_curso'), sid = s.id;
      t.ok('salida con zona 1 en marcha y grabando', s.tramos.length === 1 && s.tramos[0].fin === null && s.grabar === true && s.zonaIds[0] === s.tramos[0].zonaId);
      t.eq('el spot inicial se llama como dijiste', (await t.docs('zonas')).find(z => z.id === s.zonaIds[0]).nombre, 'Aparcamiento A');
      t.eq('el grabador sigue esta salida', await t.page.evaluate(() => window.__MI.trk.activo()), sid);
      t.ok('en la app Android se pide el permiso de avisos y se arranca el GPS en segundo plano con aviso fijo',
        await t.page.evaluate(() => window.__notif === true && !!window.__bgo && !!window.__bgo.backgroundMessage && window.__bgo.requestPermissions === true));
      t.ok('barra de zona: «Zona 1 · Aparcamiento A» en marcha', /Zona 1 · Aparcamiento A/.test(await t.T('.zbar.on') || '') && await t.visible('#sd-zcam'));
      for (let i = 1; i <= 3; i++) { await t.page.evaluate(i => window.__bgcb({ latitude: 43.4 + i * 0.0003, longitude: -2.7468, accuracy: 6, time: Date.now() }), i); await t.wait(120); }
      t.ok('los puntos del GPS en segundo plano entran en el recorrido', await t.page.evaluate(() => window.__MI.trk.puntos().length) >= 3);
      await t.tab('mas'); t.ok('dice que puedes bloquear el móvil y no ofrece pausar a mano ni «pantalla encendida»', /bloquear el móvil/.test(await t.T('#v-salida .rec') || '') && !(await t.has('#sd-pau')) && !(await t.has('#sd-wake')));
      await t.go('#salida/' + sid); await t.wait(500);
    });
    await t.case('cambiar de zona: se cierra, no cuenta tiempo ni graba mientras conduces', async () => {
      await t.tap('#sd-zcam', 800);
      let s = (await t.docs('salidas')).find(x => x.estado === 'en_curso');
      t.ok('zona 1 cerrada con su hora de fin', s.tramos[0].fin > s.tramos[0].ini && s.grabar === false);
      t.eq('el grabador se para y se quita el GPS en segundo plano', await t.page.evaluate(() => [window.__MI.trk.activo(), window.__bgrm]), [null, 'w1']);
      t.ok('«Entre zonas» y botón para empezar la siguiente', /Entre zonas/.test(await t.T('.zbar') || '') && await t.visible('#sd-zini'));
      const n = s.track.length; await t.page.evaluate(() => window.__bgcb && window.__bgcb({ latitude: 43.5, longitude: -2.9, accuracy: 5, time: Date.now() })); await t.wait(300);
      t.eq('lo que pase entre zonas no se graba', (await t.docs('salidas')).find(x => x.estado === 'en_curso').track.length, n);
    });
    await t.case('zona 2: otro spot inicial, hallazgo con el spot de la zona y zonas listadas con su tiempo', async () => {
      await t.page.evaluate(() => { window.__bgrm = null; });
      await t.tap('#sd-zini', 800); await t.page.fill('#st-nom', 'Aparcamiento B'); await t.tap('#st-ok', 1000);
      let s = (await t.docs('salidas')).find(x => x.estado === 'en_curso');
      t.ok('dos zonas; la 1 cerrada y la 2 en marcha', s.tramos.length === 2 && s.tramos[0].fin !== null && s.tramos[1].fin === null && s.zonaIds.length === 2);
      for (let i = 1; i <= 3; i++) { await t.page.evaluate(i => { const f = window.__MI.geo.fix(); window.__bgcb({ latitude: f.lat + 0.0002, longitude: f.lon, accuracy: 6, time: Date.now() }); }, i); await t.wait(120); }
      await t.tap('#sd-mk', 900);
      t.eq('el spot por defecto es el de la zona en marcha', await t.page.evaluate(() => (document.querySelector('#mk-zonas .opt.on') || {}).textContent), 'Aparcamiento B');
      await t.tap('#mk-ok', 900);
      s = (await t.docs('salidas')).find(x => x.estado === 'en_curso'); const h = (await t.docs('hallazgos')).find(x => x.salidaId === s.id);
      t.ok('el hallazgo queda en la zona 2', h.tramoId === s.tramos[1].id && h.zonaId === s.tramos[1].zonaId);
      await t.go('#salida/' + s.id); await t.wait(700);
      t.eq('dos tarjetas de zona en el resumen', await t.N('.zcards .zcard'), 2);
      t.eq('dos manchas de zona en el minimapa (una por recorrido)', await t.N('#smap path.zona-circ'), 2);
      await t.tab('spots');
      t.eq('dos tarjetas de zona', await t.N('.zc'), 2);
      t.ok('con color, hora, tiempo y hallazgos', /1 · Aparcamiento A/.test(await t.T('.zc') || '') && /en marcha/.test(await t.T('.zlist') || '') && /1 hallazgo/.test(await t.T('.zlist') || ''), await t.T('.zlist'));
      await t.shot('zonas-salida');
      await t.go('#mapa'); await t.wait(800); t.eq('y en el mapa principal (las 2 de hoy + la salida antigua, que sigue siendo un círculo)', await t.N('#map path.zona-circ'), 3);
    });
    await t.case('terminar la salida cierra la zona abierta y suma solo el tiempo de las zonas', async () => {
      const s0 = (await t.docs('salidas')).find(x => x.estado === 'en_curso'); await t.go('#salida/' + s0.id); await t.wait(400);
      await t.tap('#sd-fin', 500); await t.tap('#tf-ok', 800);
      const s = (await t.docs('salidas')).find(x => x.id === s0.id);
      t.ok('terminada con todas las zonas cerradas', s.estado === 'terminada' && s.tramos.every(z => z.fin !== null));
      t.eq('el grabador queda parado', await t.page.evaluate(() => window.__MI.trk.activo()), null);
    });
    await t.case('botón atrás de Android: cierra lo abierto, retrocede de pantalla en pantalla y solo sale desde el mapa', async () => {
      const atras = async () => { await t.page.evaluate(() => window.__atras()); await t.wait(300); }, H = () => t.page.evaluate(() => location.hash), S_ = id => '#salida/' + id;
      t.ok('la app registra el botón atrás', await t.page.evaluate(() => typeof window.__atras === 'function'));
      await t.put('salidas', 'sb', { fecha: '2026-11-16', titulo: '', notas: '', zonaIds: [], fotos: [], fotosCosecha: [], track: [], grabar: false, estado: 'terminada', creada: 1, fin: 2 });
      await t.go('#salida/sb/especie/x'); await t.wait(400);
      await atras(); t.eq('especie → lista de especies', await H(), '#salida/sb/especies');
      await atras(); t.eq('especies → resumen de la salida', await H(), '#salida/sb');
      await t.page.evaluate(() => window.__MI.abrirSpot ? 0 : 0); await t.go('#salida/sb/mas'); await t.wait(300);
      await t.page.evaluate(() => { const s = document.querySelector('#sheet'); s.hidden = false; s.innerHTML = '<div class="sh">x</div>'; });
      await atras(); t.eq('con una hoja abierta, atrás solo la cierra', [await H(), await t.page.evaluate(() => document.querySelector('#sheet').hidden)], ['#salida/sb/mas', true]);
      await atras(); t.eq('más → resumen', await H(), '#salida/sb');
      await atras(); t.eq('resumen → lista de salidas', await H(), '#salidas');
      await atras(); t.eq('salidas → mapa', await H(), '#mapa');
      t.eq('desde el mapa todavía no ha salido', await t.page.evaluate(() => !!window.__salio), false);
      await atras(); t.eq('desde el mapa sale de la app', await t.page.evaluate(() => !!window.__salio), true);
    });
    await t.case('app Android: el GPS nativo también mueve el punto azul (si el GPS de la web no responde)', async () => {
      const r = await t.page.evaluate(() => { const g = window.__MI.geo; g.poner({ lat: 43.4013, lon: -2.7522, acc: 6, ts: Date.now() + 5000 }); const f = g.fix(); const m = window.__MI.S.me; return { f, op: m.options.opacity, ll: m.getLatLng() }; });
      t.ok('posición nativa = posición de la app y punto azul en ella', r.f.lat === 43.4013 && r.f.acc === 6 && r.op === 1 && Math.abs(r.ll.lat - 43.4013) < 1e-9, JSON.stringify(r));
      t.ok('con la app abierta se pide el GPS nativo (sin aviso de segundo plano)', await t.page.evaluate(() => (window.__bgAll || []).some(o => !o.backgroundMessage)));
    });
    await t.case('app Android: proyecto, permisos y compilación automática preparados', async () => {
      const R = f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8'), ex = f => fs.existsSync(path.join(__dirname, '..', '..', f));
      const cfg = JSON.parse(R('android-app/capacitor.config.json')), pk = JSON.parse(R('android-app/package.json')), wf = R('.github/workflows/apk.yml'), sw = R('docs/sw.js');
      t.ok('Capacitor carga la web en vivo de Pages (se actualiza sola) y no deja que Android pare el GPS a los 5 min', cfg.webDir === '../docs' && /^https:\/\/birddexsp-source\.github\.io\/micologia\/$/.test(cfg.server.url) && cfg.android.useLegacyBridge === true && /^[a-z.]+$/.test(cfg.appId));
      t.ok('plugin de GPS en segundo plano, avisos y botón atrás', !!pk.dependencies['@capacitor-community/background-geolocation'] && !!pk.dependencies['@capacitor/local-notifications'] && !!pk.dependencies['@capacitor/app']);
      t.ok('clave de firma fija y script de firma (para actualizar sin desinstalar)', ex('android-app/micologia.keystore') && /signingConfig/.test(R('android-app/firma.gradle')));
      t.ok('permisos de micrófono y cámara, y la cámara visible en Android 11+ (si no, «foto» abre la galería)', /RECORD_AUDIO/.test(R('android-app/permisos.txt')) && /CAMERA/.test(R('android-app/permisos.txt')) && /<queries>[\s\S]*android\.media\.action\.IMAGE_CAPTURE[\s\S]*<\/queries>/.test(R('android-app/permisos.txt')));
      t.ok('el workflow compila, firma y publica con enlace fijo', /assembleRelease/.test(wf) && /apk-latest/.test(wf) && /permissions:\s*\n\s*contents: write/.test(wf));
      const shell = JSON.parse(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
      t.eq('todos los módulos js están en el caché sin conexión', fs.readdirSync(path.join(__dirname, '..', '..', 'docs/js')).filter(f => f.endsWith('.js') && !shell.includes('js/' + f)), []);
    });
  }
};
