/* Mapa v9: chinchetas de spot con nombre y nº de especies, filtros rápidos, resumen del spot (especies, aviso de tóxicas,
   meses, visitas) y resumen del hallazgo. Datos sintéticos. */
module.exports = {
  name: 'Mapa: spots con resumen y filtros rápidos',
  launch: { viewport: { width: 390, height: 844 } },
  async run(t) {
    const d = (s, h) => { const x = new Date(s + 'T00:00:00'); x.setHours(h); return x.getTime(); };
    const H = (id, z, s, e, f, h, extra = {}) => t.put('hallazgos', id, { salidaId: s, zonaId: z, lat: 43.1 + Math.random() * 1e-4, lon: -2.8, precisionM: 5, ts: d(f, h), especieId: e, especieTxt: e ? '' : 'seta parda', cantidad: '', estadoSeta: '', sustrato: '', notas: '', fotos: [], identificacion: e ? 'provisional' : 'sin_identificar', confirmadoPor: '', recogida: false, audios: [], transcripciones: {}, ...extra });
    await t.case('datos: 2 spots, 1 salida, 4 hallazgos', async () => {
      await t.put('zonas', 'za', { nombre: 'Hayedo A', lat: 43.1, lon: -2.8, estado: 'visitada', notas: 'Entrar por la pista', fotos: [], audios: [], transcripciones: { x: 'Sale mucho boleto' } });
      await t.put('zonas', 'zb', { nombre: 'Pinar B', lat: 43.11, lon: -2.79, estado: 'por_visitar', notas: '', fotos: [], audios: [], transcripciones: {} });
      await t.put('salidas', 'sa', { fecha: '2026-11-11', titulo: 'Vuelta de prueba', zonaIds: ['za'], estado: 'terminada', creada: d('2026-11-11', 15), fin: d('2026-11-11', 18), fotos: [], fotosCosecha: [], track: [], totalTxt: '', notas: '' });
      await H('h1', 'za', 'sa', 'boletus-edulis', '2026-11-11', 16, { cantidad: '3', notas: 'Bajo un haya grande' });
      await H('h2', 'za', 'sa', 'boletus-edulis', '2025-10-20', 11);
      await H('h3', 'za', 'sa', 'amanita-phalloides', '2026-11-11', 17);
      await H('h4', 'za', null, null, '2026-11-11', 17);
      await t.go('#salidas'); await t.go('#mapa'); await t.wait(400);
      t.eq('2 chinchetas de spot', await t.N('#map .spot'), 2);
      t.ok('con su nombre', /Hayedo A/.test(await t.T('#map .spot:not(.por) .lbl') || '') && /Pinar B/.test(await t.T('#map .spot.por .lbl') || ''));
      t.eq('nº de especies distintas en la chincheta (boleto, cicuta, sin identificar)', await t.T('#map .spot:not(.por) .spm b'), '3');
      t.ok('el spot por visitar va sin número', !(await t.has('#map .spot.por .spm b')));
      t.eq('4 burbujas de hallazgo', await t.N('#map .pin'), 4);
      t.ok('iconos de las herramientas son SVG (no caracteres sueltos)', await t.page.evaluate(() => ['#locate', '#layerbtn', '#spotbtn', '#filterbtn'].every(s => document.querySelector(s + ' svg'))));
    });
    await t.case('filtros rápidos: Spots, Quiero ir, Hallazgos, Todo', async () => {
      await t.tap('#mchips [data-capa="spots"]', 300);
      t.ok('Spots: sin hallazgos', (await t.N('#map .pin')) === 0 && (await t.N('#map .spot')) === 2);
      await t.tap('#mchips [data-capa="porir"]', 300);
      t.ok('Quiero ir: solo el pinar', (await t.N('#map .spot')) === 1 && await t.has('#map .spot.por'));
      await t.tap('#mchips [data-capa="hallazgos"]', 300);
      t.ok('Hallazgos: sin spots', (await t.N('#map .spot')) === 0 && (await t.N('#map .pin')) === 4);
      await t.tap('#mchips [data-capa="todo"]', 300);
      t.ok('Todo otra vez', (await t.N('#map .spot')) === 2 && (await t.N('#map .pin')) === 4);
      t.eq('un solo filtro marcado', await t.N('#mchips .on'), 1);
    });
    await t.case('tocar un spot: resumen sin formulario', async () => {
      await t.page.evaluate(() => document.querySelector('#map .spot:not(.por)').dispatchEvent(new MouseEvent('click', { bubbles: true })));
      await t.wait(700);
      const txt = await t.T('#sheet') || '';
      t.ok('título del spot', /Hayedo A/.test(txt));
      t.ok('no es un formulario (sin campo de nombre)', !(await t.has('#sheet #st-nom')) && !(await t.has('#sheet input')));
      t.eq('3 tarjetas de especie', await t.N('#sheet .spc'), 3);
      t.ok('la más repetida primero, con ×2', /×2/.test(await t.T('#sheet .spc:first-child em') || ''));
      t.ok('años en los que salió', /2025–26/.test(await t.T('#sheet .spc:first-child small') || ''));
      t.ok('aviso: aquí también hay una mortal', await t.has('#sheet .alerta') && /cicuta/i.test(await t.T('#sheet .alerta') || ''));
      t.ok('tarjeta mortal marcada como tal', /mortal/.test(await t.T('#sheet .spc[data-e="amanita-phalloides"] small') || ''));
      t.eq('barras de los 12 meses', await t.N('#sheet .mbar>div'), 12);
      t.ok('con datos en octubre y noviembre', await t.page.evaluate(() => { const b = [...document.querySelectorAll('#sheet .mbar u')]; return b[9].classList.contains('h') && b[10].classList.contains('h') && !b[0].classList.contains('h'); }));
      t.ok('mejor mes: noviembre', /Mejor mes[^.]*noviembre/.test(txt));
      t.ok('visita enlazada a la salida', await t.has('#sheet a.vrow[href="#salida/sa"]'));
      t.ok('notas y transcripción', /Entrar por la pista/.test(txt) && /Sale mucho boleto/.test(txt));
      t.ok('Cómo llegar y Marcar aquí', await t.has('#sheet a[href*="maps/dir"]') && await t.has('#sheet #st-marcar'));
      t.ok('la chincheta queda resaltada', await t.has('#map .spot.sel'));
      t.ok('y visible por encima de la hoja', await t.page.evaluate(() => { const p = document.querySelector('#map .spot.sel').getBoundingClientRect(), s = document.querySelector('#sheet .sh').getBoundingClientRect(); return p.bottom <= s.top && p.top >= 90; }));
    });
    await t.case('desde el resumen: ficha de la especie, editar y volver', async () => {
      await t.tap('#sheet .spc[data-e="boletus-edulis"]', 500);
      t.ok('abre la ficha', /Boletus edulis/.test(await t.T('#sheet') || '') && await t.has('#sheet .fh'));
      await t.page.evaluate(() => window.__MI.verSpot('za')); await t.wait(500);
      await t.tap('#st-edit', 500);
      t.ok('el lápiz abre el formulario', await t.has('#sheet #st-nom') && /Editar spot/.test(await t.T('#sheet h2') || ''));
      await t.tap('#st-x', 500);
      t.ok('cancelar vuelve al resumen', await t.has('#sheet .spcs') && !(await t.has('#map .pin.drag')));
      await t.tap('#st-marcar', 600);
      t.ok('Marcar aquí: hallazgo con el spot elegido', await t.has('#mk-zonas button.on') && /Hayedo A/.test(await t.T('#mk-zonas button.on') || ''));
      await t.tap('#mk-x', 300);
    });
    await t.case('spot «Quiero ir» sin hallazgos', async () => {
      await t.page.evaluate(() => window.__MI.verSpot('zb')); await t.wait(500);
      t.ok('dice que aún no has ido', /Aún no has ido/.test(await t.T('#sheet') || ''));
      t.ok('sin tarjetas ni barras', !(await t.has('#sheet .spc')) && !(await t.has('#sheet .mbar')));
    });
    await t.case('tocar un hallazgo: resumen con foto de referencia', async () => {
      await t.page.evaluate(() => window.__MI.verHallazgo('h1')); await t.wait(500);
      const txt = await t.T('#sheet') || '';
      t.ok('nombre, spot y cantidad', /Hayedo A/.test(txt) && /Cantidad\s*3/i.test(txt));
      t.ok('foto de referencia marcada como tal', /Foto de referencia/.test(txt));
      t.ok('aviso de no comer sin experto', /no certifica/.test(txt));
      t.ok('sin formulario', !(await t.has('#sheet input')));
      await t.tap('#hv-edit', 400);
      t.ok('Editar abre el formulario del hallazgo', await t.has('#sheet #hd-ok'));
      await t.page.evaluate(() => window.__MI.verHallazgo('h4')); await t.wait(400);
      t.ok('hallazgo sin especie: «seta parda»', /seta parda/.test(await t.T('#sheet h2') || ''));
    });
    await t.case('lista de la salida abre el resumen del hallazgo', async () => {
      await t.go('#salida/sa'); await t.wait(500);
      await t.tap('#v-salida .item[data-h]', 500);
      t.ok('resumen (no formulario)', await t.has('#sheet #hv-edit') && !(await t.has('#sheet #hd-ok')));
      await t.go('#mapa'); t.ok('al cambiar de pestaña se cierra la hoja', !(await t.visible('#sheet .sh')));
    });
    await t.case('cerrar el resumen: barrita, tocar el mapa, ×, arrastrar', async () => {
      const abierto = () => t.visible('#sheet .sh');
      await t.page.evaluate(() => window.__MI.verSpot('za')); await t.wait(400);
      await t.tap('#sheet .grab', 300); t.ok('tocar la barrita cierra', !(await abierto()));
      await t.page.evaluate(() => window.__MI.verSpot('za')); await t.wait(400);
      await t.page.evaluate(() => window.__MI.S.map.fire('click', { latlng: L.latLng(43.2, -2.7) })); await t.wait(300);
      t.ok('tocar el mapa cierra', !(await abierto()) && !(await t.has('#map .spot.sel')));
      await t.page.evaluate(() => window.__MI.verSpot('za')); await t.wait(400);
      await t.tap('#sv-x', 300); t.ok('× cierra', !(await abierto()));
      await t.page.evaluate(() => window.__MI.verSpot('za')); await t.wait(400);
      const b = await t.page.$('#sheet .grab'), r = await b.boundingBox();
      await t.page.evaluate(([x, y]) => { const el = document.querySelector('#sheet .grab'), mk = yy => [new Touch({ identifier: 1, target: el, clientX: x, clientY: yy })];
        el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: mk(y), changedTouches: mk(y) }));
        el.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: mk(y + 160), changedTouches: mk(y + 160) }));
        el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: mk(y + 160) })); }, [r.x + 5, r.y + 2]);
      await t.wait(300); t.ok('arrastrar hacia abajo cierra', !(await abierto()));
      await t.tap('#fab', 400); await t.tap('#sheet .grab', 200);
      t.ok('la hoja de marcar no se cierra sin querer', await abierto()); await t.tap('#mk-x', 300);
    });
    await t.case('desde casa: «Añadir especie» lo pone en el sitio del spot, no donde estás', async () => {
      await t.put('zonas', 'zc', { nombre: 'Lejano C', lat: 43.2, lon: -2.6, estado: 'visitada', notas: '', fotos: [], audios: [], transcripciones: {} });
      await t.page.evaluate(() => window.__MI.verSpot('zc')); await t.wait(500);
      t.ok('el botón dice «Añadir especie»', /Añadir especie/.test(await t.T('#st-marcar') || ''));
      await t.tap('#st-marcar', 600); await t.page.fill('#sp-q', 'níscalo'); await t.wait(120); await t.tap('#sp-sugs button'); await t.tap('#mk-ok', 500);
      const h = (await t.docs('hallazgos')).find(x => x.zonaId === 'zc');
      t.ok('hallazgo en las coordenadas del spot', h && Math.abs(h.lat - 43.2) < 1e-6 && Math.abs(h.lon + 2.6) < 1e-6, h && h.lat + ',' + h.lon);
      t.ok('cerca del spot sigue diciendo «Marcar aquí»', await t.page.evaluate(async () => { await window.__MI.verSpot('za'); await new Promise(r => setTimeout(r, 300)); return /Marcar aquí/.test(document.querySelector('#st-marcar').textContent); }));
    });
    await t.case('360 px: resúmenes sin desborde', async () => {
      await t.page.setViewportSize({ width: 360, height: 640 });
      for (const [f, id] of [['verSpot', 'za'], ['verSpot', 'zb'], ['verHallazgo', 'h1']]) {
        await t.page.evaluate(([f, id]) => window.__MI[f](id), [f, id]); await t.wait(500);
        t.ok(f + ' ' + id + ' sin scroll horizontal', await t.page.evaluate(() => { const s = document.querySelector('#sheet .sh'); return s.scrollWidth <= s.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; }));
      }
      t.ok('los filtros rápidos no tapan las herramientas', await t.page.evaluate(() => document.querySelector('#mchips').getBoundingClientRect().right <= document.querySelector('.maptools').getBoundingClientRect().left + 1));
      await t.shot('captura-12-mapa');
    });
  }
};
