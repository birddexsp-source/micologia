module.exports = {
  name: 'Pantallas móviles 360×640 sin desbordes',
  launch: { viewport: { width: 360, height: 640 } },
  async run(t) {
    const desborde = () => t.page.evaluate(() => {
      const d = document.documentElement, v = [...document.querySelectorAll('.view:not([hidden]), #sheet .sh')];
      return { doc: d.scrollWidth - innerWidth, vistas: v.map(e => e.scrollWidth - e.clientWidth).filter(x => x > 1) };
    });
    const limpio = async (nombre) => { const d = await desborde(); t.ok(nombre + ': sin scroll horizontal', d.doc <= 1 && d.vistas.length === 0, JSON.stringify(d)); };
    await t.case('mapa: el botón no choca con la barra inferior', async () => {
      await limpio('mapa');
      const r = await t.page.evaluate(() => { const f = document.querySelector('#fab').getBoundingClientRect(), n = document.querySelector('.nav').getBoundingClientRect(); return [f.bottom, n.top]; });
      t.ok('«Marcar aquí» queda por encima de la barra', r[0] <= r[1], JSON.stringify(r));
    });
    await t.case('datos de ejemplo y todas las pantallas', async () => {
      await t.go('#salidas'); await t.tap('#s-new', 400); await t.go('#mapa');
      await t.marcarRapido({ zona: 'Zona con un nombre bastante largo para probar el desborde', esp: 'cicuta', cant: '≈200 g' });
      await t.marcarRapido({ zonaExistente: true, esp: 'rebozuelo' });
      for (const h of ['#salidas', '#setas', '#mes', '#ajustes']) { await t.go(h); await limpio(h); await t.shot('captura-m-' + h.slice(1)); }
      await t.go('#salidas'); await t.tap('#v-salidas a.item', 500); await limpio('detalle de salida'); await t.shot('captura-m-detalle');
    });
    await t.case('hojas: marcar, hallazgo, ficha y antes de comer', async () => {
      await t.go('#mapa'); await t.fixGPS(); await t.tap('#fab', 400); await limpio('hoja marcar'); await t.shot('captura-m-marcar');
      t.ok('la hoja no tapa toda la pantalla', await t.page.evaluate(() => document.querySelector('#sheet .sh').getBoundingClientRect().height < innerHeight * 0.75));
      await t.tap('#mk-x', 200);
      const h = (await t.docs('hallazgos')).find(x => x.especieId === 'cantharellus-cibarius');
      await t.page.evaluate(id => window.__MI.abrirHallazgo(id), h.id); await t.wait(300); await limpio('hoja hallazgo');
      await t.tap('#hd-antes', 300); await limpio('antes de comer'); await t.page.evaluate(() => { document.querySelector('#sheet').hidden = true; });
      await t.page.evaluate(() => window.__MI.abrirFicha('boletus-edulis')); await t.wait(300); await limpio('ficha');
    });
    await t.case('terminar salida con fotos de lo recogido', async () => {
      await t.page.evaluate(() => { document.querySelector('#sheet').hidden = true; });
      const s = (await t.docs('salidas'))[0]; await t.go('#salida/' + s.id); await t.wait(400);
      t.ok('detalle con tarjetas de grabación', await t.has('#v-salida .rec'));
      await t.tap('#sd-fin', 400); await limpio('terminar salida'); await t.shot('captura-m-terminar');
      t.ok('el botón Terminar es alcanzable (la hoja se desplaza)', await t.page.evaluate(() => { const sh = document.querySelector('#sheet .sh'); return sh.scrollHeight >= sh.clientHeight && !!document.querySelector('#tf-ok'); }));
    });
  }
};
