module.exports = {
  name: 'Fichas visuales: fotos, qué mirar, guía y este mes',
  launch: { viewport: { width: 390, height: 844 } },
  async run(t) {
    await t.case('lista de setas: avatares con foto y grupos por clase', async () => {
      await t.go('#setas'); await t.wait(300);
      t.ok('hay un avatar de foto por especie', (await t.N('#slist .item .phw.av img.ph')) === 25);
      t.ok('las fotos de la lista se piden a 250 px', t.photoReqs.some(u => /\/250px-/.test(u)));
      t.ok('los encabezados agrupan por clase', (await t.N('#slist .grp')) >= 4);
      t.ok('las candidatas llevan el chip «Candidata · sin confirmar»', (await t.N('#slist .tag.cand')) === 9);
      t.ok('ninguna especie se presenta como «Comestible buena» ni «con condiciones»', !/Comestible (buena|con condiciones)/i.test(await t.T('#slist') || ''));
      await t.shot('captura-07-lista');
    });
    await t.case('ficha: fotos con autoría y licencia, regla clave y qué mirar', async () => {
      await t.page.evaluate(() => window.__MI.abrirFicha('amanita-phalloides')); await t.wait(400);
      t.eq('3 fotos en el carrusel', await t.N('#sheet .hero figure'), 3);
      t.eq('3 puntos indicadores', await t.N('#sheet #dots i'), 3);
      t.ok('las fotos grandes se piden a 960 px', t.photoReqs.some(u => /\/960px-/.test(u)));
      t.ok('crédito visible en la foto (autor y licencia)', /CC BY-SA/.test(await t.T('#sheet .hero figcaption') || ''));
      t.ok('las fotos piden CORS (se pueden guardar offline)', await t.page.evaluate(() => [...document.querySelectorAll('#sheet img.ph')].every(i => i.crossOrigin === 'anonymous')));
      t.ok('regla clave en rojo para una mortal', await t.has('#sheet .clave.pel'));
      t.ok('«qué mirar» con varios puntos y volva en saco', (await t.N('#sheet .qm li')) >= 5 && /volva/i.test(await t.T('#sheet .qm') || ''));
      t.ok('créditos de las fotos al final', /Créditos de las fotos/i.test(await t.T('#sheet') || '') && /Stu's Images/.test(await t.T('#sheet') || ''));
      t.ok('fuentes con Wikipedia', /Wikipedia \(inglés\)/.test(await t.T('#sheet') || ''));
      await t.shot('captura-07-ficha-mortal');
      /* hero scroll → punto activo */
      await t.page.evaluate(() => { const h = document.querySelector('#hero'); h.scrollTo({ left: h.clientWidth * 2, behavior: 'instant' }); }); await t.wait(300);
      t.eq('el punto activo sigue al carrusel', await t.page.evaluate(() => [...document.querySelectorAll('#dots i')].findIndex(i => i.classList.contains('on'))), 2);
    });
    await t.case('guía: se abre desde «qué mirar», resalta la parte y vuelve a la ficha', async () => {
      await t.tap('#sheet .qm .pt[data-g="volva"]', 400);
      t.ok('abre la guía', /Partes de una seta/.test(await t.T('#sheet h2') || ''));
      t.eq('8 partes en la leyenda con número', await t.N('#sheet .leg .lg .mk:not(.sm)'), 8);
      t.eq('8 marcas en el esquema', await t.N('#sheet svg.esq g.mk'), 8);
      t.ok('resalta «Volva»', /Volva/.test(await t.T('#sheet .lg.on') || ''));
      t.eq('4 tipos de himenio', await t.N('#sheet .tiles:not(.t3) .tile'), 4);
      t.eq('3 tipos de unión de láminas', await t.N('#sheet .tiles.t3 .tile'), 3);
      t.ok('glosario y consejos para recoger', (await t.N('#sheet dl.gl dt')) >= 8 && /base del pie/.test(await t.T('#sheet') || ''));
      await t.shot('captura-07-guia');
      await t.tap('#gu-b', 300);
      t.ok('vuelve a la ficha de la cicuta', /Amanita phalloides/.test(await t.T('#sheet h2') || ''));
    });
    await t.case('confusiones: foto contra foto y enlace a la otra ficha', async () => {
      await t.page.evaluate(() => window.__MI.abrirFicha('boletus-edulis')); await t.wait(300);
      t.ok('comparación con 2 fotos para una confusión del catálogo', (await t.N('#sheet .conf .cmp figure')) >= 4);
      t.ok('riesgo alto señalado', /Riesgo alto/.test(await t.T('#sheet') || ''));
      t.ok('candidata: chip propio y «Antes de comer»', await t.has('#sheet .tag.cand') && await t.has('#fi-antes'));
      await t.shot('captura-07-ficha-candidata');
      await t.tap('#sheet .lnk[data-e="boletus-satanas"]', 300);
      t.ok('abre Boletus satanas', /satanas/.test(await t.T('#sheet h2') || ''));
    });
    await t.case('este mes: peligrosas primero, por época y navegando meses', async () => {
      await t.page.evaluate(() => { document.querySelector('#sheet').hidden = true; });
      await t.go('#mes');
      await t.page.evaluate(() => { window.__MI.S.mes = 10; }); await t.go('#mapa'); await t.go('#mes');
      t.eq('título del mes', await t.T('.mesnav h2'), 'Octubre');
      t.ok('«Peligrosas que salen ahora» en octubre', /Peligrosas que salen ahora/.test(await t.T('#v-mes') || ''));
      t.ok('la cicuta está en el bloque de peligro', await t.has('#v-mes .dang .item[data-e="amanita-phalloides"]'));
      t.ok('el níscalo está en plena temporada/buena época', await t.has('#v-mes .item[data-e="lactarius-deliciosus"]'));
      t.ok('la perretxiko (primavera) no sale en octubre', !(await t.has('#v-mes .item[data-e="calocybe-gambosa"]')));
      t.ok('aviso: cuándo aparece, no si se come', /no si se puede comer/.test(await t.T('#v-mes') || ''));
      await t.shot('captura-07-mes-octubre');
      await t.tap('#m-prev', 100); await t.tap('#m-prev', 100); await t.tap('#m-prev', 100); await t.tap('#m-prev', 100); await t.tap('#m-prev', 100); await t.tap('#m-prev', 200);
      t.eq('seis meses atrás: abril', await t.T('.mesnav h2'), 'Abril');
      t.ok('en abril sale la colmenilla y la perretxiko', await t.has('#v-mes .item[data-e="morchella"]') && await t.has('#v-mes .item[data-e="calocybe-gambosa"]'));
      t.ok('en abril no sale la cicuta', !(await t.has('#v-mes .item[data-e="amanita-phalloides"]')));
      await t.tap('#m-next', 100); await t.tap('#m-next', 100); await t.tap('#m-next', 100); await t.tap('#m-next', 100); await t.tap('#m-next', 100); await t.tap('#m-next', 100); await t.tap('#m-next', 100);
      await t.tap('#m-next', 100); await t.tap('#m-next', 100); await t.tap('#m-next', 100);
      t.eq('de abril a febrero (10 meses) y se da la vuelta al año', await t.T('.mesnav h2'), 'Febrero');
      t.ok('febrero sin especies: mensaje claro', /Ninguna especie del catálogo tiene datos para este mes/.test(await t.T('#v-mes') || ''));
    });
    await t.case('ficha: barras de temporada con fuente y mes actual marcado', async () => {
      await t.page.evaluate(() => { window.__MI.S.mes = 10; window.__MI.abrirFicha('lactarius-deliciosus'); }); await t.wait(300);
      t.eq('12 barras', await t.N('#sheet .bars .b'), 12);
      t.eq('el mes actual está marcado', await t.N('#sheet .bars .b.cur'), 1);
      t.ok('la fuente se explica con N y zona', /N=44/.test(await t.T('#sheet') || '') && /costa cantábrica/.test(await t.T('#sheet') || ''));
      await t.page.evaluate(() => window.__MI.abrirFicha('lepiota-brunneoincarnata')); await t.wait(300);
      t.ok('una especie sin datos suficientes lo dice en vez de inventar', /Sin datos suficientes/i.test(await t.T('#sheet') || '') && !(await t.has('#sheet .bars')));
    });
    await t.case('ajustes: descargar fotos para usar sin cobertura', async () => {
      await t.page.evaluate(() => { document.querySelector('#sheet').hidden = true; }); await t.go('#ajustes'); t.photoReqs.length = 0;
      await t.tap('#a-fotos', 1500);
      for (let i = 0; i < 20 && !/Listo/.test(await t.T('#a-fst') || ''); i++) await t.wait(300);
      t.ok('descarga 150 fotos (75 × 2 tamaños)', /Listo: 150 fotos/.test(await t.T('#a-fst') || ''), await t.T('#a-fst'));
      t.eq('150 peticiones a Commons', t.photoReqs.length, 150);
    });
  }
};
