/* «¿Cuál es?»: comprobar lo que sugiere la IA con la ficha paso a paso y las diferencias entre candidatas. */
module.exports = {
  name: '«¿Cuál es?»: comprobar las candidatas de la IA',
  launch: { viewport: { width: 390, height: 844 } },
  async run(t) {
    await t.put('hallazgos', 'hx', { salidaId: '', lat: 43.4, lon: -2.75, ts: Date.now(), especieId: '', especieTxt: '', identificacion: 'sin_identificar', fotos: [],
      iaSugerencias: [{ id: 'amanita-pantherina-muscaria', n: 'Amanita pantherina', c: 62 }, { id: 'amanita-rubescens', n: 'Amanita rubescens', c: 30 }, { id: '', n: 'Amanita inventada', c: 8 }] });
    await t.go('#mapa'); await t.wait(400);
    await t.case('desde un hallazgo: «Comprobar cuál es» abre las candidatas', async () => {
      await t.page.evaluate(() => window.__MI.verHallazgo('hx')); await t.wait(500);
      t.ok('botón en las sugerencias de la IA', await t.has('#sheet button[data-hc=""]'));
      await t.tap('#sheet button[data-hc=""]', 700);
      t.eq('dos candidatas del catálogo (la inventada no) + «Diferencias»', await t.N('#cuales .cq-t'), 3);
      t.ok('cada una con su % de la IA', /IA 62 %/.test(await t.T('#cuales .cq-t') || ''));
    });
    await t.case('una candidata: aviso de tóxica, lo esencial y los pasos en orden (arriba, debajo, pie, base, corte, olor)', async () => {
      t.ok('aviso de tóxica arriba', /TÓXICA/.test(await t.T('#cuales .cq-pel') || ''));
      t.ok('«Lo esencial» con la clave', /verrugas/i.test(await t.T('#cuales .clave') || ''));
      const pasos = await t.page.evaluate(() => [...document.querySelectorAll('#cuales .cq-ph b')].map(b => b.textContent));
      t.ok('pasos en el orden del monte', pasos.length >= 3 && pasos[0] === 'Mira el sombrero' && pasos.indexOf('Dale la vuelta: ¿láminas, poros o pinchos?') === 1, pasos.join(' | '));
      t.ok('cómo no confundirla con la otra candidata', /Para no confundirla con/i.test(await t.T('#cuales .cq-body') || ''));
      t.ok('fotos con los rasgos señalados', await t.has('#cuales [data-vz]'));
    });
    await t.case('diferencias lado a lado y detalle al tocar una fila', async () => {
      await t.tap('#cuales [data-ck="-1"]', 500);
      t.ok('tabla con una columna por candidata', (await t.N('#cuales .cq-fila.cab b')) === 2 && (await t.N('#cuales .cq-fd')) >= 3);
      await t.page.evaluate(() => { const s = document.querySelector('#cuales .cq-fd summary'); s.scrollIntoView({ block: 'center' }); s.click(); }); await t.wait(300);
      const det = await t.page.evaluate(() => { const d = document.querySelector('#cuales .cq-fd'); return [d.open, d.querySelectorAll('.cq-det p').length]; });
      t.eq('al tocar una fila sale el detalle de cada una', det, [true, 2]);
      t.eq('sin desbordar la pantalla', await t.page.evaluate(() => document.querySelector('#cuales').scrollWidth), 390);
      await t.shot('comparar-diferencias');
    });
    await t.case('«Es esta»: la anota en el hallazgo como provisional', async () => {
      await t.tap('#cuales [data-ck="1"]', 400); await t.shot('comparar-especie');
      await t.tap('#cuales [data-cfi]', 500); t.ok('«Ficha completa» dentro del comprobador', await t.has('#cuales .ftabs'));
      await t.tap('#cuales [data-cfi]', 400); await t.tap('#cuales [data-cel]', 800);
      const h = (await t.docs('hallazgos')).find(x => x.id === 'hx');
      t.ok('especie y provisional', h.especieId === 'amanita-rubescens' && h.identificacion === 'provisional');
      t.ok('el hallazgo se refresca con la especie', !(await t.has('#cuales')) && /rojiza|rubescens/i.test(await t.T('#sheet h2') || ''));
    });
    await t.case('el botón atrás de Android cierra primero el comprobador', async () => {
      await t.tap('#sheet button[data-hc=""]', 600); t.ok('abierto', await t.has('#cuales'));
      t.eq('atrás → cierra el comprobador', await t.page.evaluate(() => window.__MI.atras()), 'comparar');
      t.ok('sigue el hallazgo debajo', !(await t.has('#cuales')) && await t.has('#sheet h2'));
    });
  }
};
