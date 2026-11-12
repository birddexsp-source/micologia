const { PNG1 } = require('../lib/harness');
module.exports = {
  name: 'Marcar aquí: GPS, especie, zona, foto y sin conexión',
  launch: { sw: true },
  async run(t) {
    await t.case('2 toques: Marcar aquí → Guardar (sin especie)', async () => {
      await t.fixGPS(); await t.tap('#fab', 400);
      t.ok('se abre la hoja y el pin arrastrable', await t.visible('#sheet .sh') && await t.page.evaluate(() => !!window.__MI.S.tmp));
      t.ok('muestra coordenadas y precisión', /43\.10000, -2\.80000 · ±8 m/.test(await t.T('#mk-pos') || ''), await t.T('#mk-pos'));
      await t.shot('captura-02-marcar');
      await t.tap('#mk-ok', 400);
      const hs = await t.docs('hallazgos'); t.eq('1 hallazgo', hs.length, 1);
      const h = hs[0];
      t.ok('lat/lon guardadas', Math.abs(h.lat - 43.1) < 1e-6 && Math.abs(h.lon + 2.8) < 1e-6);
      t.eq('precisión', h.precisionM, 8); t.eq('«No sé» → sin_identificar', h.identificacion, 'sin_identificar'); t.eq('sin salida en curso', h.salidaId, null);
      t.eq('sin pin temporal tras guardar', await t.page.evaluate(() => window.__MI.S.tmp), null);
      t.eq('1 marcador en el mapa', await t.N('.pin i'), 1);
    });
    await t.case('elegir especie del catálogo → identificación provisional', async () => {
      await t.marcarRapido({ esp: 'cicuta', cant: '3' });
      const h = (await t.docs('hallazgos')).find(x => x.especieId);
      t.ok('especie guardada', !!h && h.especieId === 'amanita-phalloides');
      t.eq('provisional', h.identificacion, 'provisional'); t.eq('cantidad', h.cantidad, '3');
    });
    await t.case('arrastrar el punto lo ajusta a mano', async () => {
      await t.fixGPS(); await t.tap('#fab', 400);
      await t.page.evaluate(() => { const m = window.__MI.S.tmp; m.setLatLng([43.1004, -2.8006]); m.fire('dragend'); });
      t.ok('aparece «ajustado a mano»', /ajustado a mano/.test(await t.T('#mk-pos') || ''));
      await t.tap('#mk-ok', 400);
      const h = (await t.docs('hallazgos')).find(x => Math.abs(x.lat - 43.1004) < 1e-6);
      t.ok('guarda las coordenadas movidas', !!h && Math.abs(h.lon + 2.8006) < 1e-6 && h.ajustadoAMano === true);
    });
    await t.case('foto: se reduce y se guarda como blob', async () => {
      await t.fixGPS(); await t.tap('#fab', 400);
      const [fc] = await Promise.all([t.page.waitForEvent('filechooser'), t.page.evaluate(() => document.querySelector('#mk-foto').click())]);
      await fc.setFiles({ name: 'seta.png', mimeType: 'image/png', buffer: PNG1 });
      await t.page.waitForSelector('#mk-th img', { timeout: 5000 }); await t.wait(300);
      await t.tap('#mk-ok', 400);
      const h = (await t.docs('hallazgos')).find(x => (x.fotos || []).length);
      t.ok('hallazgo con 1 foto', !!h && h.fotos.length === 1);
      const info = await t.page.evaluate(id => { const b = window.__MI.db.B.get(id); return b ? { type: b.type, size: b.blob.size, dirty: b.dirty } : null; }, h.fotos[0]);
      t.ok('blob JPEG pendiente de sincronizar', !!info && info.type === 'image/jpeg' && info.dirty === true, JSON.stringify(info));
    });
    await t.case('zona al vuelo, reutilizable', async () => {
      await t.marcarRapido({ zona: 'Pinar de prueba' });
      const z = await t.docs('zonas'); t.eq('1 zona', z.length, 1); t.eq('nombre', z[0].nombre, 'Pinar de prueba');
      await t.marcarRapido({ zonaExistente: true });
      const hs = (await t.docs('hallazgos')).filter(h => h.zonaId === z[0].id); t.eq('2 hallazgos en esa zona', hs.length, 2);
    });
    await t.case('abrir un hallazgo, identificarlo y confirmarlo exige quién', async () => {
      const h = (await t.docs('hallazgos'))[0];
      await t.page.evaluate(id => window.__MI.abrirHallazgo(id), h.id); await t.wait(300);
      await t.tap('#hd-id button[data-i="confirmada"]'); await t.tap('#hd-ok', 300);
      t.ok('pide quién lo confirma', /Indica quién/.test(await t.T('#toast') || ''));
      t.eq('sigue sin confirmar', (await t.docs('hallazgos')).find(x => x.id === h.id).identificacion, h.identificacion);
      await t.page.fill('#hd-por', 'Sociedad de prueba'); await t.tap('#hd-ok', 400);
      const g = (await t.docs('hallazgos')).find(x => x.id === h.id);
      t.eq('confirmada', g.identificacion, 'confirmada'); t.eq('confirmadoPor', g.confirmadoPor, 'Sociedad de prueba');
    });
    await t.case('un candidato a comestible muestra «Antes de comer» y la lista', async () => {
      await t.marcarRapido({ esp: 'rebozuelo' });
      const h = (await t.docs('hallazgos')).find(x => x.especieId === 'cantharellus-cibarius');
      await t.page.evaluate(id => window.__MI.abrirHallazgo(id), h.id); await t.wait(300);
      t.ok('aviso: la app no certifica nada', /no certifica/.test(await t.T('#hd-aviso') || ''));
      await t.tap('#hd-antes', 300);
      t.eq('6 comprobaciones', await t.N('#sheet .check input'), 6);
      t.ok('«si falta alguno: no se come»', /no se come/.test(await t.T('#sheet') || ''));
      await t.tap('#sheet .btn.p', 200);
    });
    await t.case('sin conexión: la app arranca y se puede marcar', async () => {
      await t.page.evaluate(() => navigator.serviceWorker.ready); await t.reload(); await t.wait(500);
      t.ok('el SW controla la página', await t.page.evaluate(() => !!navigator.serviceWorker.controller));
      await t.ctx.setOffline(true); await t.reload();
      const antes = (await t.docs('hallazgos')).length;
      t.ok('arranca offline con los datos', antes >= 5, 'hallazgos: ' + antes);
      await t.marcarRapido(); t.eq('guarda offline', (await t.docs('hallazgos')).length, antes + 1);
      await t.reload(); t.eq('persiste tras recargar offline', (await t.docs('hallazgos')).length, antes + 1);
      await t.ctx.setOffline(false);
    });
    await t.case('sin GPS: se puede marcar moviendo el punto', async () => {
      const ctx = await t.context({ permissions: [] }); const p = await t.newPage(ctx); const old = t.page; t.page = p; t.ctx = ctx;
      await p.goto(t.opts.url + '#mapa'); await t.ready();
      await t.wait(600); await t.tap('#fab', 500);
      t.ok('avisa de que no hay GPS', /Sin GPS/.test(await t.T('#toast') || ''));
      t.ok('«ajustado a mano»', /ajustado a mano/.test(await t.T('#mk-pos') || ''));
      await t.tap('#mk-ok', 400);
      const h = (await t.docs('hallazgos'))[0]; t.ok('guarda sin precisión', !!h && h.precisionM === null && h.ajustadoAMano === true);
      await ctx.close(); t.page = old;
    });
  }
};
