/* Guía de hábitats para principiantes: texto sin jerga, desde la ficha y desde el Plan, y cobertura de todos los hábitats del catálogo. */
module.exports = {
  name: 'Guía de hábitats (dónde mirar, para principiantes)',
  launch: { viewport: { width: 390, height: 844 } },
  async run(t) {
    await t.case('cada hábitat del catálogo tiene guía completa y sin jerga', async () => {
      const r = await t.page.evaluate(async () => {
        const h = await import('./js/habitat.js'), es = window.__MI.cat.todas(), usados = [...new Set(es.flatMap(e => e.habitats || []))];
        const sin = usados.filter(k => !h.H[k]), JERGA = /caducifoli|aciculifoli|micorr[ií]c|sapr[oó]tr|ectomicorr|planifoli|esclerofil|perennifoli|simbion|ecosistema|sustrato/i;
        const malos = Object.entries(h.H).filter(([k, v]) => JERGA.test([v.nombre, v.que, ...v.reconoce, ...v.mirar, v.bizkaia, v.ojo].join(' '))).map(x => x[0]);
        const vacios = Object.entries(h.H).filter(([k, v]) => !v.nombre || !v.que || v.reconoce.length < 1 || v.mirar.length < 1).map(x => x[0]);
        const sinGrupo = Object.entries(h.H).filter(([k, v]) => !h.GRUPOS.some(g => g.id === v.grupo)).map(x => x[0]);
        const sinDonde = es.filter(e => !h.dondeSimple(e)).map(e => e.id);
        const gj = Object.values(h.GREMIO).filter(g => JERGA.test(g.n + ' ' + g.d)).length;
        return { n: usados.length, sin, malos, vacios, sinGrupo, sinDonde, gj };
      });
      t.eq('todos los hábitats que usan las fichas están en la guía', r.sin, []);
      t.eq('ningún texto usa jerga (caducifolio, micorrícica, saprótrofa…)', r.malos, []);
      t.eq('todos tienen nombre, qué es, cómo se reconoce y dónde mirar', r.vacios, []);
      t.eq('todos pertenecen a un grupo de la guía general', r.sinGrupo, []);
      t.eq('las 128 fichas tienen su frase «Mira…»', r.sinDonde, []);
      t.eq('los tipos de seta se explican sin jerga', r.gj, 0);
    });
    await t.case('ficha: «Mira bajo…» y chips tocables que abren la guía del sitio y vuelven', async () => {
      await t.page.evaluate(() => window.__MI.abrirFicha('boletus-aereus')); await t.wait(400);
      await t.page.click('#sheet .ft[data-ft="hab"]'); await t.wait(250);
      const d = await t.T('#sheet .hb-donde');
      t.ok('frase en palabras sencillas sobre dónde mirar', /^Mira /.test(d || '') && /bajo|en /.test(d), d);
      t.ok('los chips son botones con el nombre sencillo', (await t.N('#sheet .habs button.hab')) >= 2 && /Toca un sitio/.test(await t.T('#sheet') || ''));
      const id = await t.page.evaluate(() => document.querySelector('#sheet .habs button.hab').dataset.h);
      await t.page.click('#sheet .habs button.hab'); await t.wait(300);
      const g = await t.T('#sheet');
      t.ok('se abre la guía del hábitat: qué es, cómo lo reconoces, dónde mirar', /Cómo lo reconoces/i.test(g) && /Dónde mirar/i.test(g) && (await t.N('#sheet .hb-l')) >= 2, id);
      t.ok('lista las setas que salen ahí, con foto y etiqueta', (await t.N('#sheet .hb-sp')) >= 3 && await t.has('#sheet .hb-sp img.ph') && await t.has('#sheet .hb-sp .tag'));
      t.ok('las tóxicas y mortales van aparte y nunca en la lista principal', await t.page.evaluate(() => { const s = document.querySelector('#sheet'); const principal = s.querySelector('.hb-ls'); return !principal || ![...principal.querySelectorAll('.tag')].some(x => /Mortal|Tóxica/.test(x.textContent)); }));
      t.ok('avisa de que salir en un sitio no significa que sea comestible', /no significa que se pueda comer/.test(g));
      await t.page.click('#hb-b'); await t.wait(300);
      t.ok('«Volver» regresa a la ficha de la seta, en la misma pestaña (Hábitat)', /Dónde mirar/i.test(await t.T('#sheet') || '') && await t.page.evaluate(() => document.querySelector('#sheet .ft.on').dataset.ft) === 'hab');
      await t.page.evaluate(() => window.__MI.abrirHabitat('pinar')); await t.wait(300);
      await t.page.click('#sheet .hb-sp'); await t.wait(400);
      t.ok('tocar una seta de la lista abre su ficha', await t.has('#sheet .hero') && await t.has('#ftabs'));
    });
    await t.case('Plan: botón «¿Dónde busco?», guía general y chips de hábitat en cada tarjeta', async () => {
      await t.page.route(/open-meteo\.com/, r => r.abort());
      await t.page.evaluate(() => { const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }; const dias = {}; for (let k = -92; k < 16; k++) dias[d(k)] = { p: 4, tmax: 17, tmin: 9, tmed: 13 }; localStorage.setItem('mi.clima.43.4,-2.7', JSON.stringify({ t: Date.now(), dias })); localStorage.setItem('mi.plan', JSON.stringify({ obj: 'general', zona: 'bermeo' })); });
      await t.go('#plan'); await t.page.waitForSelector('#pl-res .pl-bars', { timeout: 8000 }); await t.wait(400);
      t.ok('hay un botón visible «¿No sabes dónde mirar?»', /¿No sabes dónde mirar\?/.test(await t.T('#pl-donde') || ''));
      const tj = await t.page.evaluate(() => { const k = document.querySelector('.pl-sp'); return k ? { donde: /Dónde mirar:/i.test(k.textContent), chips: k.querySelectorAll('[data-hab]').length, gr: !!k.querySelector('.pl-sp-g') && !/Micorr|Saprótr/i.test(k.querySelector('.pl-sp-g').textContent) } : null; });
      t.ok('cada tarjeta dice dónde mirar con palabras sencillas y trae chips de hábitat', tj && tj.donde && tj.chips >= 1 && tj.gr, JSON.stringify(tj));
      t.ok('sin jerga en el Plan: ni «micorrícica» ni «saprótrofa»', !/micorr[ií]c|sapr[oó]tr/i.test(await t.T('#v-plan') || '') && !/micorr[ií]c|sapr[oó]tr/i.test(await t.page.evaluate(() => document.querySelector('#pl-obj').textContent)));
      await t.page.click('.pl-sp [data-hab]'); await t.wait(300);
      t.ok('tocar el chip abre la guía de ese sitio sin salir del Plan', /Cómo lo reconoces/i.test(await t.T('#sheet') || '') && /plan/.test(await t.page.evaluate(() => location.hash)));
      await t.page.click('#hb-x'); await t.wait(200);
      t.ok('se cierra', await t.page.evaluate(() => document.querySelector('#sheet').hidden));
      await t.page.click('#pl-donde'); await t.wait(300);
      const g = await t.T('#sheet');
      t.ok('«¿Dónde busco setas?»: reconocer el árbol, grupos de sitios y consejos', /Reconocer el árbol en 10 segundos/i.test(g) && /Agujas en vez de hojas/i.test(g) && /Consejos para salir/i.test(g) && (await t.N('#sheet .hb-gr .hab')) === 20);
      await t.page.click('#sheet .hb-gr .hab'); await t.wait(300);
      t.ok('desde la guía general se entra en un sitio y se vuelve', /Cómo lo reconoces/i.test(await t.T('#sheet') || '') && await t.has('#hb-b'));
      await t.page.click('#hb-b'); await t.wait(300);
      t.ok('«Volver» regresa a la guía general', /Reconocer el árbol/i.test(await t.T('#sheet') || ''));
      t.ok('a 360 px no se desborda', await (async () => { await t.page.setViewportSize({ width: 360, height: 640 }); await t.wait(300); return t.page.evaluate(() => { const s = document.querySelector('#sheet .sh'); return s.scrollWidth <= s.clientWidth + 1; }); })());
      await t.page.setViewportSize({ width: 390, height: 844 });
    });
  }
};
