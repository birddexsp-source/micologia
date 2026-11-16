/* Pantalla de la salida: resumen corto + pantallas de detalle (especies, registro, fotos, zona) y visor de fotos. */
module.exports = {
  name: 'Salida: resumen y detalle (especies, registro, fotos, zona)',
  launch: { viewport: { width: 390, height: 844 } },
  async run(t) {
    const T0 = new Date('2026-11-16T11:00:00').getTime(), min = n => T0 + n * 60000;
    /* fotos de prueba (colores distintos) guardadas como blobs de verdad */
    const foto = c => t.page.evaluate(async c => { const cv = document.createElement('canvas'); cv.width = cv.height = 240; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 240, 240); x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.arc(120, 120, 70, 0, 7); x.fill();
      const b = await new Promise(r => cv.toBlob(r, 'image/jpeg', .8)); return window.__MI.db.putBlob(b); }, c);
    const [f1, f2, f3, f4, f5, f6] = [await foto('#b5651d'), await foto('#8a2be2'), await foto('#2e8b57'), await foto('#c0392b'), await foto('#2980b9'), await foto('#d4ac0d')];
    await t.put('zonas', 'za', { nombre: 'Aparcamiento Altzurra', estado: 'visitada', lat: 43.39, lon: -2.755, creada: min(0) });
    await t.put('zonas', 'zb', { nombre: 'Pastitxu basoa', estado: 'visitada', lat: 43.4005, lon: -2.7494, creada: min(60) });
    await t.put('zonas', 'zc', { nombre: 'Tonelane', estado: 'visitada', lat: 43.3986, lon: -2.7468, creada: min(120) });
    const track = [[43.39, -2.755, Math.round(min(1) / 1000), 1], [43.3905, -2.7548, Math.round(min(8) / 1000)], [43.3912, -2.7541, Math.round(min(15) / 1000)], [43.3918, -2.7535, Math.round(min(25) / 1000)],
      [43.4005, -2.7494, Math.round(min(61) / 1000), 1], [43.4011, -2.7488, Math.round(min(70) / 1000)], [43.4016, -2.7481, Math.round(min(80) / 1000)]];
    await t.put('salidas', 'sd1', { fecha: '2026-11-16', titulo: '', notas: '', zonaIds: ['za', 'zb', 'zc'], fotos: [f6], fotosCosecha: [f5], track, grabar: false, estado: 'terminada', totalTxt: '≈1 kg', zonaMejorId: '', creada: min(0), fin: min(150),
      tramos: [{ id: 't1', zonaId: 'za', ini: min(0), fin: min(40) }, { id: 't2', zonaId: 'zb', ini: min(60), fin: min(95) }, { id: 't3', zonaId: 'zc', ini: min(120), fin: min(150) }],
      diario: [{ id: 'dn1', ts: min(30), tipo: 'sin_setas', zonaId: 'za', texto: 'Aquí no hay setas: lo han recogido', audios: [], transcripciones: {} }] });
    const H = (id, o) => t.put('hallazgos', id, { salidaId: 'sd1', precisionM: 5, especieTxt: '', identificacion: 'provisional', cantidad: '', fotos: [], ...o });
    await H('h1', { tramoId: 't1', zonaId: 'za', ts: min(10), lat: 43.3905, lon: -2.7548, especieId: 'amanita-phalloides', fotos: [f1, f2], cantidad: '3' });
    await H('h2', { tramoId: 't1', zonaId: 'za', ts: min(20), lat: 43.3912, lon: -2.7541, especieId: 'amanita-phalloides', fotos: [f3] });
    await H('h3', { tramoId: 't2', zonaId: 'zb', ts: min(65), lat: 43.4008, lon: -2.749, especieId: 'boletus-edulis', fotos: [f4], identificacion: 'confirmada' });
    await H('h4', { tramoId: 't2', zonaId: 'zb', ts: min(75), lat: 43.4013, lon: -2.7485, especieId: '', fotos: [], identificacion: 'sin_identificar', iaSugerencias: [] });
    await H('h5', { tramoId: 't3', zonaId: 'zc', ts: min(125), lat: 43.3986, lon: -2.7468, especieId: 'boletus-edulis', cantidad: '2' });
    await H('h6', { tramoId: 't3', zonaId: 'zc', ts: min(135), lat: 43.3988, lon: -2.7466, especieId: '', especieTxt: 'seta rara del pinar', identificacion: 'sin_identificar' });
    await t.go('#salida/sd1'); await t.wait(900);
    await t.shot('det-resumen');
    await t.case('resumen: corto, con especies, zonas y fotos, sin pestañas largas', async () => {
      t.ok('«Qué has visto» con una tarjeta por especie (amanita, boletus, sin identificar, seta rara)', (await t.N('.bl .spc')) === 4, String(await t.N('.bl .spc')));
      t.ok('la tarjeta usa TU foto de la seta', await t.page.evaluate(() => { const i = document.querySelector('.bl .spc .spf img'); return !!i && (i.dataset.blob || '').length > 3 && i.complete; }));
      t.ok('3 zonas como tarjetas', (await t.N('.zcards .zcard')) === 3);
      t.ok('tira de fotos con las de los hallazgos y las de lo recogido (4 de setas + 2 más)', (await t.N('.fstrip .fth')) === 6, String(await t.N('.fstrip .fth')));
      t.ok('ya no hay pestañas', !(await t.has('.tabs')));
      t.eq('entradas a Registro, Diario, Fotos y Más', await t.N('.navrow'), 4);
      t.ok('la pantalla es corta: cabe en ~3 pantallas', await t.page.evaluate(() => document.querySelector('#v-salida').scrollHeight < 844 * 3.2), String(await t.page.evaluate(() => document.querySelector('#v-salida').scrollHeight)));
    });
    await t.case('especies: cuadrícula y detalle de una especie con tus fotos', async () => {
      await t.tap('.bl-m[href$="/especies"]', 600);
      t.eq('4 especies en la cuadrícula', await t.N('.spgrid .spc'), 4);
      await t.shot('det-especies');
      await t.tap('.spgrid .spc', 700);   /* la más vista: Amanita phalloides ×2 */
      t.ok('detalle: nombre, 2 hallazgos y 3 fotos tuyas', /Amanita|cicuta/i.test(await t.T('.esp-h') || '') && (await t.N('.gcar .fth')) === 3 && (await t.N('.rg')) === 2, await t.T('.esp-h'));
      await t.shot('det-especie');
      await t.tap('.gcar .fth', 500);
      t.ok('visor a pantalla completa con las 3 fotos y su pie', await t.has('#visor') && (await t.N('#visor figure')) === 3 && /Amanita|cicuta/i.test(await t.T('#visor figcaption') || ''));
      await t.shot('det-visor');
      await t.page.evaluate(() => document.querySelector('#visor .vs-tr').scrollLeft = 2 * document.querySelector('#visor .vs-tr').clientWidth); await t.wait(300);
      t.eq('desliza hasta la 3.ª', await t.T('#vs-n'), '3 / 3');
      await t.tap('#visor [data-vh]', 700);
      t.ok('«Ver hallazgo» abre el hallazgo', !(await t.has('#visor')) && await t.has('#sheet'));
      await t.tap('#sheet .close, #sheet [data-close], #sv-x', 200).catch(() => { }); await t.page.evaluate(() => window.__MI && document.querySelector('#sheet') && (document.querySelector('#sheet').hidden = true));
    });
    await t.case('registro: hora a hora agrupado por zona', async () => {
      await t.go('#salida/sd1/registro'); await t.wait(600);
      t.eq('3 grupos (una por zona)', await t.N('.rgg'), 3);
      t.eq('6 hallazgos con miniatura', await t.N('.rg'), 6);
      await t.shot('det-registro');
    });
    await t.case('fotos: todas, con filtros por seta y visor', async () => {
      await t.go('#salida/sd1/fotos'); await t.wait(600);
      t.eq('6 fotos en total (4 de setas + salida + recogido)', await t.N('.fgrid .fth'), 6);
      await t.tap('[data-ff="setas"]', 400); t.eq('«Mis setas»: 4', await t.N('.fgrid .fth'), 4);
      await t.tap('[data-ff="recogido"]', 400); t.eq('«Lo recogido»: 1', await t.N('.fgrid .fth'), 1);
      await t.tap('[data-ff="sp:amanita-phalloides"]', 400); t.eq('por especie: 3', await t.N('.fgrid .fth'), 3);
      await t.shot('det-fotos');
      await t.tap('[data-ff="todas"]', 300); await t.tap('.fgrid .fth', 400);
      t.eq('el visor abre con todas', await t.N('#visor figure'), 6);
      await t.tap('.vs-x', 300); t.ok('se cierra', !(await t.has('#visor')));
    });
    await t.case('zona: mapa con la mancha de esa zona, tiempo y lo encontrado', async () => {
      await t.go('#salida/sd1/zona/t1'); await t.wait(900);
      t.eq('la mancha de la zona 1 en el mapa', await t.N('#smap path.zona-circ'), 1);
      t.ok('40 min y 2 hallazgos', /40 min/.test(await t.T('.stats') || '') && /Aparcamiento Altzurra/.test(await t.T('.sp-t') || ''));
      t.ok('solo lo de esa zona: 1 especie, 2 filas, fotos de la zona', (await t.N('.bl .spc')) === 1 && (await t.N('.rg')) === 2 && (await t.N('.fstrip .fth')) === 3);
      await t.shot('det-zona');
    });
    await t.case('salida antigua (sin zonas): se ve igual de bien, con sus spots', async () => {
      await t.put('salidas', 'sd0', { fecha: '2026-11-11', titulo: 'Boletus', notas: '', zonaIds: ['zc'], fotos: [], fotosCosecha: [], track: [], grabar: false, estado: 'terminada', totalTxt: '', zonaMejorId: '', creada: min(-9000), fin: min(-8900) });
      await t.put('hallazgos', 'h0', { salidaId: 'sd0', zonaId: 'zc', ts: min(-8950), lat: 43.3986, lon: -2.7468, especieId: 'boletus-edulis', especieTxt: '', identificacion: 'provisional', fotos: [f4] });
      await t.go('#salida/sd0'); await t.wait(700);
      t.ok('bloque «Spots» con su tarjeta y especie con tu foto', /Spots/.test(await t.page.evaluate(() => document.body.innerText)) && (await t.N('.zcard')) === 1 && (await t.N('.bl .spc')) === 1);
      await t.tap('.zcard', 700); t.ok('abre el spot como zona con su mapa', (await t.has('#smap')) && (await t.N('.rg')) === 1);
    });
    await t.case('Más y Diario siguen funcionando en su pantalla', async () => {
      await t.go('#salida/sd1/diario'); await t.wait(500); t.ok('nota del diario', await t.has('.dn') && /no hay setas/.test(await t.page.evaluate(() => document.querySelector('.dn textarea').value)));
      await t.go('#salida/sd1/mas'); await t.wait(500); t.ok('total recogido y recorrido', (await t.page.inputValue('#sd-tot')) === '≈1 kg' && await t.has('#sd-gpx'));
    });
  }
};
