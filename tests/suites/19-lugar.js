/* Nombre automático del sitio (topónimos del IGN, sin conexión): casos reales de Bermeo, spots nuevos, hallazgos y renombrar los viejos. */
module.exports = {
  name: 'Nombre del sitio automático (topónimos)',
  launch: { viewport: { width: 390, height: 844 } },
  async run(t) {
    const p = t.page;
    await t.case('casos reales de Bermeo (mismos que AveDex)', async () => {
      const r = await p.evaluate(async () => { const L = await import('./js/lugar.js'); await L.cargar(); return [[43.4196, -2.7218], [43.4270, -2.7330], [43.4560, -2.7530], [43.4090, -2.7160], [43.4370, -2.6970], [40.4, -3.7]].map(([a, b]) => { const x = L.nombrar(a, b); return x ? x.etiqueta : null; }); });
      t.eq('municipio, paraje, cabo, barrio, nada cerca y fuera de zona', r, ['Bermeo', 'Peña de Oro, Bermeo', 'Cabo Matxitxako, Bermeo', 'Demiku, Bermeo', 'Cerca de Bermeo', null]);
      const d = await p.evaluate(async () => { const L = await import('./js/lugar.js'); return [L.nombreSpot(43.409, -2.716, ['Demiku, Bermeo']), L.nombreSpot(43.409, -2.716, ['Demiku, Bermeo', 'demiku, bermeo 2'])]; });
      t.eq('sin repetir nombres', d, ['Demiku, Bermeo 2', 'Demiku, Bermeo 3']);
    });
    await t.case('spot nuevo: nombre puesto solo y que sigue al punto hasta que lo tocas', async () => {
      await t.setGeo(43.4090, -2.7160); await t.reload(); await t.fixGPS();
      await t.go('#mapa'); await t.tap('#spotbtn', 500);
      t.eq('nombre automático', await p.inputValue('#st-nom'), 'Demiku, Bermeo');
      t.ok('se ve el lugar en la cabecera', /📍 Demiku, Bermeo/.test(await t.T('#st-pos') || ''));
      await p.evaluate(() => { window.__MI.S.tmp.setLatLng([43.4270, -2.7330]); window.__MI.S.tmp.fire('dragend'); }); await t.wait(150);
      t.eq('al mover el punto cambia el nombre', await p.inputValue('#st-nom'), 'Peña de Oro, Bermeo');
      await p.fill('#st-nom', 'Mi sitio'); await p.dispatchEvent('#st-nom', 'input');
      await p.evaluate(() => { window.__MI.S.tmp.setLatLng([43.4090, -2.7160]); window.__MI.S.tmp.fire('dragend'); }); await t.wait(150);
      t.eq('si lo has escrito tú, se respeta', await p.inputValue('#st-nom'), 'Mi sitio');
      t.ok('y te sugiere el del lugar con un botón', await t.visible('#st-sug') && /Demiku, Bermeo/.test(await t.T('#st-sug')));
      await t.tap('#st-sug', 150); t.eq('al tocarlo lo pone', await p.inputValue('#st-nom'), 'Demiku, Bermeo');
      await t.tap('#st-ok', 500);
      t.ok('guardado con ese nombre', (await t.docs('zonas')).some(z => z.nombre === 'Demiku, Bermeo'));
    });
    await t.case('marcar un hallazgo: el sitio en la cabecera, spot nuevo con nombre y el lugar guardado', async () => {
      await t.go('#mapa'); await t.tap('#fab', 500);
      t.ok('cabecera con el lugar', /Demiku, Bermeo · ±\d+ m/.test(await t.T('#mk-pos') || ''), await t.T('#mk-pos'));
      if (await t.has('#mk-zonas button[data-z].on')) await t.tap('#mk-zonas button[data-z].on', 150);
      await t.tap('#mk-nz', 200);
      t.eq('el spot nuevo viene con nombre, sin repetir', await p.inputValue('#mk-znom'), 'Demiku, Bermeo 2');
      await t.tap('#mk-zok', 300); await t.tap('#mk-ok', 500);
      const h = (await t.docs('hallazgos')).pop();
      t.eq('el hallazgo guarda el lugar', h.lugar, 'Demiku, Bermeo');
    });
    await t.case('sin conexión sigue funcionando', async () => {
      await t.ctx.setOffline(true);
      const r = await p.evaluate(async () => { const L = await import('./js/lugar.js'); return (L.nombrar(43.4560, -2.7530) || {}).etiqueta; });
      t.eq('nombra sin red', r, 'Cabo Matxitxako, Bermeo');
      await t.ctx.setOffline(false);
    });
    await t.case('Ajustes: poner a los spots viejos el nombre de su lugar', async () => {
      await t.put('zonas', 'b1', { nombre: 'Boletus 1', lat: 43.4270, lon: -2.7330, estado: 'visitada', notas: '' });
      await t.put('zonas', 'b2', { nombre: 'Boletus 2', lat: 43.4271, lon: -2.7331, estado: 'visitada', notas: '' });
      await t.go('#ajustes'); await t.wait(400);
      await p.evaluate(() => { document.querySelector('#v-ajustes details.det').open = true; });
      await t.tap('#a-lugar', 200);
      t.ok('primero enseña qué va a cambiar', /Boletus 1 → Peña de Oro, Bermeo/.test(await t.T('#a-lugar') || '') && /Boletus 2 → Peña de Oro, Bermeo 2/.test(await t.T('#a-lugar') || ''), await t.T('#a-lugar'));
      t.ok('y no cambia nada todavía', (await t.docs('zonas')).some(z => z.nombre === 'Boletus 1'));
      await t.tap('#a-lugar', 600);
      const n = (await t.docs('zonas')).map(z => z.nombre);
      t.ok('al confirmar, renombrados sin duplicados', n.includes('Peña de Oro, Bermeo') && n.includes('Peña de Oro, Bermeo 2') && !n.includes('Boletus 1'), JSON.stringify(n));
      t.ok('y quedan para sincronizar', await p.evaluate(() => window.__MI.db.dirtyCount() > 0));
      t.ok('crédito del IGN en Ajustes', /Nomenclátor Geográfico Básico de España © IGN/.test(await t.T('.aj-legal') || ''));
    });
  }
};
