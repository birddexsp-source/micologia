module.exports = {
  name: 'Catálogo: búsqueda, semáforo, ficha y seguridad',
  async run(t) {
    await t.go('#setas');
    await t.case('lista completa y aviso fijo', async () => {
      t.eq('25 fichas', await t.N('#slist .item'), 25);
      t.ok('aviso de seguridad siempre visible', /Ninguna seta se come por lo que diga la app/.test(await t.T('#v-setas .warn') || ''));
      t.ok('primero las más peligrosas', /Mortal/.test(await t.T('#slist .item') || ''));
      await t.shot('captura-04-setas');
    });
    await t.case('búsqueda por nombre común, científico y sin tildes', async () => {
      const q = async s => { await t.page.fill('#q', s); await t.wait(150); return t.N('#slist .item'); };
      t.eq('«cicuta»', await q('cicuta'), 1); t.ok('es Amanita phalloides', /phalloides/.test(await t.T('#slist .item') || ''));
      t.eq('«rebozuelo»', await q('rebozuelo'), 1); t.eq('«ziza» (euskera)', await q('ziza'), 1);
      t.eq('«niscalo» sin tilde', await q('niscalo'), 1); t.eq('«níscalo» con tilde', await q('níscalo'), 1);
      t.eq('«boletus»', await q('boletus'), 2); t.eq('«zzzz»', await q('zzzz'), 0);
      t.ok('mensaje de vacío', /Nada con ese nombre/.test(await t.T('#slist') || ''));
      await q('');
    });
    await t.case('filtro por clase (semáforo)', async () => {
      await t.tap('#cl button[data-c="mortal"]'); t.eq('mortales', await t.N('#slist .item'), 6);
      await t.tap('#cl button[data-c="toxica"]'); t.eq('tóxicas', await t.N('#slist .item'), 9);
      await t.tap('#cl button[data-c="no_comestible"]'); t.eq('no comestibles', await t.N('#slist .item'), 1);
      await t.tap('#cl button[data-c="sin_datos"]'); t.eq('sin datos (candidatas)', await t.N('#slist .item'), 9);
      t.ok('no existe «comestible buena» en la app hasta verificar', !(await t.has('#cl button[data-c="comestible_buena"]')));
      await t.tap('#cl button[data-c=""]'); t.eq('todas', await t.N('#slist .item'), 25);
    });
    await t.case('ficha de una mortal: síndrome, latencia, confusiones, fuentes', async () => {
      await t.page.fill('#q', 'cicuta'); await t.wait(150); await t.tap('#slist .item', 300);
      const s = await t.T('#sheet');
      t.ok('clase Mortal', /Mortal/.test(s)); t.ok('nivel borrador visible', /Borrador/.test(s));
      t.ok('aviso en la ficha', /Ninguna seta se come/.test(s)); t.ok('síndrome faloidiano y latencia', /Faloidiano/.test(s) && /6–24 h/.test(s));
      t.ok('par de confusión con Russula y Agaricus', /Russula/.test(s) && /Agaricus/.test(s));
      t.ok('urgencias 112', /112/.test(s)); t.ok('fuentes listadas', /Aranzadi/.test(s));
      t.ok('sin botón «Antes de comer» en una mortal', !(await t.has('#fi-antes')));
      await t.shot('captura-05-ficha');
      await t.page.evaluate(() => document.querySelector('#sheet').click()); await t.wait(200);
    });
    await t.case('confusiones enlazadas entre fichas (recíprocas)', async () => {
      await t.page.fill('#q', 'Lepiota'); await t.wait(150); await t.tap('#slist .item', 300);
      await t.tap('#sheet .item[data-e="macrolepiota-procera"]', 300);
      t.ok('abre la ficha del parasol', /Macrolepiota procera/.test(await t.T('#sheet h2') || ''));
      t.ok('el parasol enlaza de vuelta a la Lepiota', await t.has('#sheet .item[data-e="lepiota-brunneoincarnata"]'));
      t.ok('las candidatas se tratan como sin datos', /Sin datos/.test(await t.T('#sheet') || ''));
    });
    await t.case('«Antes de comer» solo en candidatas y con 6 comprobaciones', async () => {
      t.ok('botón presente', await t.visible('#fi-antes')); await t.tap('#fi-antes', 300);
      t.eq('6 casillas', await t.N('#sheet .check input'), 6);
      t.ok('si falta alguno, no se come', /no se come/.test(await t.T('#sheet') || ''));
      t.ok('la app no certifica', /nunca certifica/.test(await t.T('#sheet') || ''));
    });
  }
};
