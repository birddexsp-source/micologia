/* Analizador de bosques: capa del inventario forestal, rodal al tocar, zonas calientes y bosque de cada spot. */
const fs = require('fs'), path = require('path');
module.exports = {
  name: 'Analizador de bosques (inventario forestal 2024)',
  launch: { viewport: { width: 390, height: 844 } },
  async run(t) {
    const J = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'docs/data/bosques.json'), 'utf8'));
    await t.case('datos: inventario oficial recortado, con fuente, clases y zonas calientes', async () => {
      t.ok('miles de rodales y fuente con licencia', J.r.length > 10000 && /Gobierno Vasco/.test(J.fuente) && /CC BY 4\.0/.test(J.fuente));
      t.eq('6 tipos de bosque, del mejor al eucalipto', J.clases.map(c => c.k), ['auto', 'fron', 'pino', 'coni', 'otra', 'euca']);
      t.ok('cada especie del inventario tiene tipo (eucaliptos → eucalipto)', J.especies.filter(s => /ucalipt/.test(s)).length >= 2);
      t.ok('25 zonas calientes con interés ≥ 60 y al menos 6 ha', J.calientes.length === 25 && J.calientes.every(z => z.s >= 60 && z.ha >= 6));
      t.ok('pesa menos de 2,5 MB', fs.statSync(path.join(__dirname, '..', '..', 'docs/data/bosques.json')).size < 2.5e6);
    });
    /* puntos reales de Bermeo comprobados contra el inventario (spots de Jon) */
    await t.put('zonas', 'z-euc', { nombre: 'Almika, Bermeo', estado: 'por_visitar', lat: 43.408192, lon: -2.731467, creada: 1 });
    await t.put('zonas', 'z-enc', { nombre: 'Tonelane, Bermeo', estado: 'visitada', lat: 43.398624, lon: -2.746813, creada: 2 });
    await t.put('zonas', 'z-pin', { nombre: 'Azabolak basoa, Bermeo', estado: 'por_visitar', lat: 43.440767, lon: -2.750325, creada: 3 });
    await t.go('#mapa'); await t.wait(600);
    await t.case('el módulo sabe qué árbol hay en un punto', async () => {
      const r = await t.page.evaluate(async () => { const b = window.__MI.bos; await b.cargar(); const f = (a, o) => { const r = b.cerca(a, o); return r && [r.c.k, r.sp[0].n]; };
        return { euc: f(43.408192, -2.731467), enc: f(43.398624, -2.746813), pin: f(43.440767, -2.750325), mar: f(43.46, -2.70) }; });
      t.eq('Almika: eucalipto globulus', r.euc, ['euca', 'Eucalipto globulus']);
      t.eq('Tonelane: encinar (autóctono)', r.enc, ['auto', 'Encina']);
      t.eq('Azabolak: pino radiata', r.pin, ['pino', 'Pino radiata']);
      t.eq('en el mar: nada', r.mar, null);
    });
    await t.case('botón del mapa: pone la capa y abre el analizador', async () => {
      await t.page.evaluate(() => window.__MI.map ? 0 : 0);
      await t.page.evaluate(() => { const m = document.querySelector('#map'); return m; });
      await t.page.evaluate(() => window.__MI.S && window.__MI.S.map && window.__MI.S.map.setView([43.405, -2.74], 14));
      await t.tap('#bosqbtn', 1500);
      t.ok('capa pintada (rodales en canvas) y botón activo', await t.has('#map canvas') && /on/.test(await t.page.getAttribute('#bosqbtn', 'class')));
      t.ok('analizador con reparto de lo que se ve', await t.has('#bq-h') && (await t.N('.bq-bar i')) >= 3);
      t.eq('5 zonas calientes cerca, ordenadas por distancia', await t.N('#bq-cal .bq-z'), 5);
      t.ok('avisa del spot en eucalipto', /Almika/.test(await t.T('#sheet .alerta') || ''));
      await t.shot('bosques-analizador');
      await t.tap('#bq-mas', 300); t.eq('«Ver las 25 zonas»', await t.N('#bq-cal .bq-z'), 25);
    });
    await t.case('zona caliente → mapa allí y ficha del rodal', async () => {
      await t.tap('#bq-cal .bq-z', 900);
      t.ok('rodal de bosque bueno con árboles, interés y setas de la guía', /Bosque autóctono|Plantación de frondosas/.test(await t.T('#sheet h2') || '') && (await t.N('#sheet .bq-sp span')) >= 1 && (await t.N('#sheet .ech')) >= 3);
      t.ok('cómo llegar al rodal', await t.page.evaluate(() => [...document.querySelectorAll('#sheet a')].some(a => /dir\/\?api=1/.test(a.href))));
      await t.shot('bosques-rodal');
    });
    await t.case('tocar una mancha de eucalipto: aviso y sin setas', async () => {
      await t.page.evaluate(() => { const S = window.__MI.S; S.map.setView([43.408192, -2.731467], 17, { animate: false }); });
      await t.wait(500);
      await t.page.evaluate(() => { const S = window.__MI.S; S.map.fire('click', { latlng: L.latLng(43.408192, -2.731467) }); }); await t.wait(500);
      t.ok('«Eucalipto» con aviso', /Eucalipto/.test(await t.T('#sheet h2') || '') && await t.has('#sheet .alerta'));
      t.eq('sin lista de setas', await t.N('#sheet .ech'), 0);
      await t.shot('bosques-eucalipto');
      await t.tap('#bq-spot', 800);
      const z = (await t.docs('zonas')).find(x => /analizador/.test(x.notas || ''));
      t.ok('«Guardar Quiero ir» crea un spot por visitar con su bosque en la nota', !!z && z.estado === 'por_visitar' && /Eucalipto/.test(z.notas));
    });
    await t.case('la ficha de cada spot dice en qué bosque está', async () => {
      await t.page.evaluate(() => window.__MI.abrirSpot ? window.__MI.abrirSpot('z-enc') : null);
      if (!(await t.has('#st-bosq'))) { await t.go('#salidas'); await t.wait(500); await t.tap('.spotr .item[data-spot="z-enc"]', 900); }
      await t.wait(800);
      t.ok('Tonelane: bosque autóctono · encina', /Bosque autóctono · Encina/.test(await t.T('#st-bosq') || ''), await t.T('#st-bosq'));
      await t.go('#salidas'); await t.wait(400); await t.tap('.spotr .item[data-spot="z-euc"]', 1200);
      t.ok('Almika: marcado en rojo como eucalipto', /Eucalipto/.test(await t.T('#st-bosq') || '') && /mal/.test(await t.page.getAttribute('#st-bosq', 'class')));
    });
    await t.case('quitar la capa', async () => {
      await t.go('#mapa'); await t.wait(400); await t.tap('#bosqbtn', 600); await t.tap('#bq-off', 400);
      t.ok('sin capa y botón apagado', !/on/.test(await t.page.getAttribute('#bosqbtn', 'class')));
    });
  }
};
