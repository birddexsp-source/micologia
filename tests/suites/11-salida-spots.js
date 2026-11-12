/* Salida con varios spots: añadir spots y especies a posteriori (sin GPS), como la salida del miércoles. */
module.exports = {
  name: 'Salida con varios spots (anotar a posteriori)',
  launch: { viewport: { width: 390, height: 844 } },
  async run(t) {
    const ini = new Date('2026-11-11T14:30:00Z').getTime();
    let sid, za, zb;
    await t.case('datos: una salida terminada con 2 spots', async () => {
      za = 'za1'; zb = 'zb1';
      await t.put('zonas', za, { nombre: 'Boletus 1', estado: 'visitada', lat: 43.3986, lon: -2.7468 });
      await t.put('zonas', zb, { nombre: 'Boletus 2', estado: 'por_visitar', lat: 43.4007, lon: -2.7447 });
      await t.put('zonas', 'zc1', { nombre: 'Boletus 3', estado: 'por_visitar', lat: 43.4024, lon: -2.7421 });
      sid = 's11'; await t.put('salidas', sid, { fecha: '2026-11-11', titulo: 'Boletus · 4 spots', notas: '', zonaIds: [za], fotos: [], fotosCosecha: [], track: [], grabar: false, estado: 'terminada', totalTxt: '', zonaMejorId: '', creada: ini, fin: ini + 9000000 });
      await t.go('#salida/' + sid);
      t.ok('sección de spots con el spot', /Spots de la salida[\s\S]*Boletus 1[\s\S]*Sin especies anotadas/i.test(await t.T('#v-salida') || ''));
      t.eq('estadística de zonas = 1', await t.T('#v-salida .stats div:nth-child(2) b'), '1');
    });
    await t.case('añadir un spot a la salida lo marca como visitado', async () => {
      await t.tap('#sd-addspot', 300);
      t.ok('ofrece los spots que faltan', /Boletus 2[\s\S]*Boletus 3/.test(await t.T('#sheet') || '') && !/Boletus 1/.test(await t.T('#sheet') || ''));
      await t.tap('#sheet [data-za="' + zb + '"]', 500);
      t.eq('salida con 2 spots', (await t.docs('salidas'))[0].zonaIds, [za, zb]);
      t.eq('el spot pasa a visitado', (await t.docs('zonas')).find(z => z.id === zb).estado, 'visitada');
    });
    await t.case('«＋ Especie» en un spot: hallazgo sin GPS, en el sitio y con la hora de la salida', async () => {
      await t.tap('[data-sa="' + zb + '"]', 500);
      t.ok('muestra la fecha de la salida', /11\/11\/2026 15:30/.test(await t.T('#mk-pos') || ''), await t.T('#mk-pos'));
      t.ok('spot ya elegido', await t.has('#mk-zonas button.on'));
      await t.page.fill('#sp-q', 'rebozuelo'); await t.wait(120); await t.tap('#sp-sugs button');
      await t.page.fill('#mk-cant', '3'); await t.tap('#mk-ok', 600);
      const h = (await t.docs('hallazgos'))[0];
      t.eq('ligado a la salida', h.salidaId, sid); t.eq('al spot', h.zonaId, zb);
      t.ok('en las coordenadas del spot', Math.abs(h.lat - 43.4007) < 1e-6 && Math.abs(h.lon + 2.7447) < 1e-6);
      t.eq('a la hora de la salida', h.ts, ini); t.eq('sin marcar como ajustado a mano', h.ajustadoAMano, false);
      await t.wait(300);
      t.ok('el spot lista la especie', /Boletus 2[\s\S]*Cantharellus/i.test(await t.T('#v-salida') || ''));
      await t.shot('captura-11-salida-spots');
    });
    await t.case('salida terminada: no se mezcla con la salida en curso', async () => {
      t.eq('ninguna en curso', (await t.docs('salidas')).filter(s => s.estado === 'en_curso').length, 0);
    });
  }
};
