/* Rareza: lista por niveles (de lo fácil a lo difícil), ruta en «Tu colección», etiqueta en la ficha y en el Plan. */
module.exports = {
  name: 'Rareza (común · poco común · rara · legendaria)',
  launch: { viewport: { width: 390, height: 844 } },
  async run(t) {
    const p = t.page, q = f => p.evaluate(f);
    await t.case('Setas: por defecto ordenadas por rareza, en 4 niveles y sin perder ninguna', async () => {
      await t.go('#setas'); await t.wait(500);
      t.eq('el orden por defecto es «Por rareza»', await q(() => document.querySelector('#ord button.on').dataset.ord), 'rareza');
      const r = await q(() => ({ h: [...document.querySelectorAll('#slist .rzh')].map(x => x.id), n: document.querySelectorAll('#slist .item.sp').length, tot: window.__MI.cat.todas().length }));
      t.eq('cabeceras en orden', r.h, ['rz-comun', 'rz-poco', 'rz-raro', 'rz-legendario']);
      t.eq('están todas las especies', r.n, r.tot);
      const bien = await q(() => { const C = window.__MI.cat; let nivel = -1, ok = true, prev = Infinity;
        for (const x of document.querySelectorAll('#slist .rzh, #slist .item.sp')) { if (x.classList.contains('rzh')) { nivel++; prev = Infinity; continue; } const e = C.byId(x.dataset.e); if (C.ORDEN_RAREZA[nivel] !== e.rareza || e.rarezaDatos.cantabrico > prev) ok = false; prev = e.rarezaDatos.cantabrico; } return ok; });
      t.ok('cada seta en su nivel y, dentro, de la más vista a la menos', bien);
      t.ok('cada tarjeta lleva sus rombos de rareza', await q(() => [...document.querySelectorAll('#slist .item.sp')].every(x => x.querySelector('.rz .rz-p'))));
      await p.fill('#q', 'boletus'); await t.wait(300);
      t.ok('al buscar también se agrupa por rareza', (await t.N('#slist .rzh')) >= 1 && (await t.N('#slist .item.sp')) >= 2);
      await p.fill('#q', ''); await t.wait(300);
      await t.tap('[data-ord="peligro"]', 200); t.ok('se puede volver a «Por peligro»', !(await t.has('#slist .rzh')) && (await t.N('#slist .grp')) > 2);
      await t.tap('[data-ord="rareza"]', 200);
    });
    await t.case('Tu colección: ruta por rareza y siguiente a buscar', async () => {
      await t.put('hallazgos', 'rz1', { salidaId: '', zonaId: '', lat: 43.4, lon: -2.7, precisionM: 5, ts: Date.now(), especieId: 'trametes-versicolor', especieTxt: '', cantidad: '', estadoSeta: '', sustrato: '', notas: '', fotos: [], identificacion: 'provisional', confirmadoPor: '', recogida: false, audios: [], transcripciones: {} });
      await t.go('#mapa'); await t.go('#setas'); await t.wait(600);
      const f = await q(() => [...document.querySelectorAll('.rzr')].map(x => [x.dataset.rz, x.querySelector('em').textContent]));
      const tot = await q(() => { const T = window.__MI.cat.todas(); return ['comun', 'poco', 'raro', 'legendario'].map(k => T.filter(e => e.rareza === k).length); });
      t.eq('4 filas con lo que llevas de cada nivel', f, [['comun', '1/' + tot[0]], ['poco', '0/' + tot[1]], ['raro', '0/' + tot[2]], ['legendario', '0/' + tot[3]]]);
      const s = await q(() => { const b = document.querySelector('.rz-sig'); return b && { id: b.dataset.e, r: window.__MI.cat.byId(b.dataset.e).rareza }; });
      t.ok('la siguiente a buscar es común y no es una que ya tienes', s && s.r === 'comun' && s.id !== 'trametes-versicolor', JSON.stringify(s));
      t.ok('en la lista, el nivel común dice cuántas tienes', /✓ 1\//.test(await t.T('#rz-comun') || ''));
      await t.tap('.rzr[data-rz="legendario"]', 900);
      t.ok('tocar «Legendaria» lleva a su nivel en la lista', await q(() => { const v = document.querySelector('#v-setas').getBoundingClientRect(), h = document.querySelector('#rz-legendario').getBoundingClientRect(); return h.top > v.top + 150 && h.bottom < innerHeight - 60; }), await q(() => JSON.stringify(document.querySelector("#rz-legendario").getBoundingClientRect())));
      await t.tap('.rz-sig', 500); t.ok('tocar la siguiente abre su ficha', await t.has('#sheet .fh h2'));
      await p.evaluate(() => { const s = document.querySelector('#sheet'); s.hidden = true; s.innerHTML = ''; });
    });
    await t.case('Ficha: etiqueta en la cabecera que lleva a la explicación', async () => {
      await p.evaluate(() => window.__MI.abrirFicha('amanita-caesarea')); await t.wait(400);
      t.ok('etiqueta «Rara» en la cabecera', /Rara/.test(await t.T('#sheet .fh .rz') || ''));
      await t.tap('#sheet .fh .rz', 400);
      t.eq('abre la pestaña Hábitat', await q(() => document.querySelector('#sheet .ft.on').dataset.ft), 'hab');
      const c = await t.T('#sheet .fp[data-fp="hab"] .fc') || '';
      t.ok('primera tarjeta: nivel, escala, motivo y datos', /Lo fácil que es encontrarla/.test(c) && /Rara/.test(c) && /robledales y castañares cálidos/.test(c) && /iNaturalist/.test(c) && /costa cantábrica/.test(c));
      t.eq('la escala marca su nivel', await q(() => document.querySelectorAll('#sheet .rz-esc li.on').length), 1);
      await p.evaluate(() => { const s = document.querySelector('#sheet'); s.hidden = true; s.innerHTML = ''; });
    });
    await t.case('a 360 px la ruta y el selector de orden caben', async () => {
      await p.setViewportSize({ width: 360, height: 640 }); await t.go('#setas'); await t.wait(400);
      t.ok('sin desbordes', await q(() => { const v = document.querySelector('#v-setas'), o = document.querySelector('#ord'); return v.scrollWidth <= v.clientWidth + 1 && o.scrollWidth <= o.clientWidth + 1; }));
      t.ok('cada fila de la ruta en una línea', await q(() => [...document.querySelectorAll('.rzr')].every(x => x.getBoundingClientRect().height < 34)));
      await p.setViewportSize({ width: 390, height: 844 });
    });
  }
};
