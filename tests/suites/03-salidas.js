module.exports = {
  name: 'Salidas: empezar, hallazgos enlazados, zonas y terminar',
  async run(t) {
    let sid;
    await t.case('empezar salida: fecha automática y chip «En curso»', async () => {
      await t.go('#salidas'); t.ok('botón Empezar salida', await t.visible('#s-new'));
      await t.tap('#s-new', 500);
      const ss = await t.docs('salidas'); t.eq('1 salida', ss.length, 1); sid = ss[0].id;
      t.eq('estado en curso', ss[0].estado, 'en_curso');
      const hoy = await t.page.evaluate(() => { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); });
      t.eq('fecha automática = hoy', ss[0].fecha, hoy);
      t.ok('navega al detalle', /#salida\//.test(await t.page.evaluate(() => location.hash)));
      t.ok('chip visible', await t.visible('#chip') && /En curso · 0/.test(await t.T('#chip')), await t.T('#chip'));
      await t.go('#salidas'); t.ok('ya no ofrece empezar otra', !(await t.has('#s-new')));
    });
    await t.case('los hallazgos se enlazan solos a la salida', async () => {
      await t.go('#mapa');
      await t.marcarRapido({ zona: 'Pinar A', cant: '2' });
      await t.marcarRapido({ zonaExistente: true });
      await t.marcarRapido({ zona: 'Hayedo B', esp: 'senderuela' });
      const hs = await t.docs('hallazgos'); t.eq('3 hallazgos', hs.length, 3);
      t.ok('todos con salidaId', hs.every(h => h.salidaId === sid));
      t.ok('chip En curso · 3', /En curso · 3/.test(await t.T('#chip') || ''), await t.T('#chip'));
      const s = (await t.docs('salidas'))[0]; t.eq('zonas de la salida', s.zonaIds.length, 2);
    });
    await t.case('detalle: contadores, mejor zona y minimapa', async () => {
      await t.tap('#chip', 600);
      const stats = await t.page.evaluate(() => [...document.querySelectorAll('#v-salida .stats b')].map(b => b.textContent));
      t.eq('hallazgos · zonas · por identificar', stats, ['3', '2', '3']);
      t.ok('mejor zona automática: Pinar A', /Automático: Pinar A/.test(await t.T('#sd-mej') || ''), await t.T('#sd-mej'));
      t.ok('minimapa montado con 3 marcadores', await t.has('#smap.leaflet-container') && await t.N('#smap .pin i') === 3, 'pins: ' + await t.N('#smap .pin i'));
      t.eq('3 filas de hallazgos', await t.N('#v-salida .item[data-h]'), 3);
      await t.shot('captura-03-salida');
    });
    await t.case('terminar salida: resumen, total y estado', async () => {
      await t.tap('#sd-fin', 400);
      t.ok('resumen con zonas', /Pinar A: 2/.test(await t.T('#sheet') || '') && /Dónde más: Pinar A/.test(await t.T('#sheet') || ''), await t.T('#sheet'));
      await t.page.fill('#tf-tot', '≈2 kg'); await t.tap('#tf-ok', 500);
      const s = (await t.docs('salidas'))[0];
      t.eq('terminada', s.estado, 'terminada'); t.eq('total', s.totalTxt, '≈2 kg');
      t.eq('mejor zona guardada', (await t.docs('zonas')).find(z => z.id === s.zonaMejorId).nombre, 'Pinar A');
      t.ok('chip oculto', !(await t.visible('#chip')));
      await t.go('#salidas'); t.ok('la lista muestra el total', /≈2 kg/.test(await t.T('#v-salidas') || ''));
    });
    await t.case('editar título, total y mejor zona a mano', async () => {
      await t.go('#salida/' + sid);
      await t.page.fill('#sd-tit', 'Salida de prueba'); await t.page.evaluate(() => document.querySelector('#sd-tit').blur()); await t.wait(300);
      t.eq('título guardado', (await t.docs('salidas'))[0].titulo, 'Salida de prueba');
      const hay = (await t.docs('zonas')).find(z => z.nombre === 'Hayedo B');
      await t.page.selectOption('#sd-mej', hay.id); await t.wait(300);
      t.eq('mejor zona manual', (await t.docs('salidas'))[0].zonaMejorId, hay.id);
    });
    await t.case('filtrar en el mapa por salida', async () => {
      await t.go('#mapa'); await t.wait(400); t.eq('3 pines sin filtro', await t.N('#map .pin i'), 3);
      await t.page.evaluate(() => { window.__MI.S.filtro = { salida: 'no-existe', especie: '' }; }); await t.page.evaluate(() => window.__MI.db.set('zonas', 'tmp', { nombre: 'x', lat: 0, lon: 0 })); await t.wait(400);
      t.eq('0 pines con filtro vacío', await t.N('#map .pin i'), 0);
      await t.page.evaluate(() => { window.__MI.S.filtro = { salida: '', especie: '' }; }); await t.page.evaluate(() => window.__MI.db.remove('zonas', 'tmp')); await t.wait(400);
      t.eq('3 pines al quitar el filtro', await t.N('#map .pin i'), 3);
    });
    await t.case('reabrir y borrar salida conserva los hallazgos', async () => {
      await t.go('#salida/' + sid); await t.tap('#sd-reab', 400);
      t.eq('vuelve a en curso', (await t.docs('salidas'))[0].estado, 'en_curso');
      await t.tap('#sd-del', 200); await t.tap('#sd-del', 500);
      t.eq('salida borrada', (await t.docs('salidas')).length, 0);
      const hs = await t.docs('hallazgos'); t.eq('hallazgos intactos', hs.length, 3); t.ok('desenlazados', hs.every(h => h.salidaId === null));
    });
  }
};
