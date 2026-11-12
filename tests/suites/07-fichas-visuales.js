module.exports = {
  name: 'Fichas visuales: fotos, qué mirar, guía y este mes',
  launch: { viewport: { width: 390, height: 844 } },
  async run(t) {
    await t.case('lista de setas: avatares con foto y grupos por clase', async () => {
      await t.go('#setas'); await t.wait(300);
      t.ok('hay un avatar de foto por especie', (await t.N('#slist .item .phw.av img.ph')) === 56);
      t.ok('las fotos de la lista se piden a 250 px', t.photoReqs.some(u => /\/250px-/.test(u)));
      t.ok('los encabezados agrupan por clase', (await t.N('#slist .grp')) >= 4);
      t.ok('las candidatas llevan el chip «Candidata · sin confirmar»', (await t.N('#slist .tag.cand')) === 31);
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
    await t.case('ficha tipo libro: hábitat con iconos, esporada, cómo recogerla y curiosidades', async () => {
      await t.page.evaluate(() => window.__MI.abrirFicha('boletus-aereus')); await t.wait(400);
      t.ok('nombres en castellano y euskera', (await t.N('#sheet .nms .nm')) === 2 && /onddobeltz/i.test(await t.T('#sheet .nms') || ''));
      t.ok('hábitat con chips e iconos', (await t.N('#sheet .habs .hab i svg')) >= 2 && /Dónde crece/i.test(await t.T('#sheet') || ''));
      t.ok('«Cómo recogerla» con acción y enlace al libro', await t.has('#sheet .recog') && await t.has('#sheet .recog [data-l="recoger"]'));
      t.ok('curiosidades numeradas', (await t.N('#sheet .curi li')) >= 2);
      t.ok('la candidata no se presenta como comestible', /Candidata · sin confirmar/.test(await t.T('#sheet .chips') || ''));
      await t.shot('captura-07-ficha-libro');
      await t.page.evaluate(() => window.__MI.abrirFicha('boletus-pinophilus')); await t.wait(300);
      t.ok('esporada con muestra de color', await t.has('#sheet .esp .sw') && /pardo oliva/.test(await t.T('#sheet .esp') || ''));
      await t.page.evaluate(() => window.__MI.abrirFicha('amanita-phalloides')); await t.wait(300);
      t.ok('una mortal dice «No recoger»', /No recoger/.test(await t.T('#sheet .recog') || ''));
      await t.page.evaluate(() => window.__MI.abrirFicha('cantharellus-cibarius')); await t.wait(300);
      t.ok('el rebozuelo avisa de que se confunde con tóxicas', /Se confunde con tóxicas/.test(await t.T('#sheet .chips') || ''));
    });
    await t.case('el libro: índice, 7 capítulos con fuentes y navegación', async () => {
      await t.page.evaluate(() => window.__MI.abrirLibro('')); await t.wait(300);
      t.eq('7 capítulos en el índice', await t.N('#sheet .lib-card'), 7);
      await t.tap('#sheet .lib-card[data-l="recoger"]', 300);
      t.ok('capítulo «cómo recoger»: dibujo, pasos y tamaños', await t.has('#sheet svg.esq') && (await t.N('#sheet .lib-steps li')) >= 5 && /Tamaños mínimos/i.test(await t.T('#sheet') || ''));
      t.ok('cita fuentes con enlace', (await t.N('#sheet .cred a')) >= 2);
      await t.shot('captura-07-libro-recoger');
      await t.tap('#sheet [data-l="identificar"]', 300);
      t.ok('esporada paso a paso', /La esporada, paso a paso/i.test(await t.T('#sheet') || ''));
      for (const c of ['antes', 'mitos', 'casa', 'intox', 'normas']) { await t.page.evaluate(id => window.__MI.abrirLibro(id), c); await t.wait(150); t.ok('capítulo ' + c + ' tiene contenido y fuentes', (await t.T('#sheet') || '').length > 500 && /Fuentes de este capítulo/i.test(await t.T('#sheet') || '')); }
      t.ok('«normas» avisa de que no está verificado', /No lo he podido verificar/.test(await t.T('#sheet') || ''));
      await t.page.evaluate(() => window.__MI.abrirLibro('intox')); await t.wait(200);
      t.ok('intoxicación: 112 y urgencias', /112/.test(await t.T('#sheet') || '') && /urgencias/i.test(await t.T('#sheet') || ''));
      await t.shot('captura-07-libro-intox');
      await t.page.evaluate(() => window.__MI.abrirFicha('boletus-aereus')); await t.wait(300);
      await t.tap('#sheet .recog [data-l="recoger"]', 300);
      t.ok('desde la ficha: abre el capítulo y permite volver', /cómo recoger/i.test(await t.T('#sheet .lib-h') || '') && await t.has('#li-b'));
      await t.tap('#li-b', 300);
      t.ok('vuelve a la ficha', /Boletus aereus/.test(await t.T('#sheet h2') || ''));
    });
    await t.case('guía: se abre desde «qué mirar», resalta la parte y vuelve a la ficha', async () => {
      await t.page.evaluate(() => window.__MI.abrirFicha('amanita-phalloides')); await t.wait(300);
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
      t.ok('febrero: pocas setas, todas de madera y sin peligrosas', await t.has('#v-mes .item[data-e="pleurotus-ostreatus"]') && !(await t.has('#v-mes .dang')));
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
      t.ok('descarga 336 fotos (168 × 2 tamaños)', /Listo: 336 fotos/.test(await t.T('#a-fst') || ''), await t.T('#a-fst'));
      t.eq('336 peticiones a Commons', t.photoReqs.length, 336);
    });
  }
};
