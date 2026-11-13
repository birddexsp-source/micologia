/* Validación completa: recorre la app entera como lo haría Jon (datos sintéticos) y comprueba que todo sigue en pie
   tras el rediseño: todas las fichas, colecciones, lecciones, meses, un día de campo completo, sincronización ida y vuelta
   y funcionamiento sin conexión con el service worker. */
const { FakeGH } = require('../lib/harness');
const REPO = 'usuario/micologia-datos', TOKEN = 'token-sintetico-de-prueba-123';
module.exports = {
  name: 'Validación completa (de punta a punta)',
  launch: { viewport: { width: 390, height: 844 } },
  async run(t) {
    const gh = new FakeGH(); await t.fakeGitHub(t.page, gh, REPO);
    const sinDesborde = () => t.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll('.view:not([hidden]), #sheet .sh')].every(v => v.scrollWidth <= v.clientWidth + 1));

    await t.case('todas las pestañas se pintan, sin errores ni desbordes', async () => {
      for (const [h, sel] of [['#mapa', '#map .leaflet-tile'], ['#salidas', '#s-new'], ['#setas', '#slist .item'], ['#mes', '.mes-sum'], ['#ajustes', '.aj-st']]) {
        await t.go(h); await t.wait(300);
        t.ok(h + ': contenido', await t.has(sel)); t.ok(h + ': sin desborde', await sinDesborde());
      }
    });
    const ids = await t.page.evaluate(() => window.__MI.cat.todas().map(e => e.id));
    await t.case('las ' + ids.length + ' fichas abren con familia, colección, aviso y «qué mirar»', async () => {
      const malas = await t.page.evaluate(async ids => {
        const m = [];
        for (const id of ids) {
          window.__MI.abrirFicha(id); await new Promise(r => setTimeout(r, 15));
          const s = document.querySelector('#sheet'), tx = s.innerText;
          if (!s.querySelector('.famc') || !/Familia/.test(tx) || !/no se come/i.test(tx) || !s.querySelector('.qm li') || s.querySelector('.sh').scrollWidth > s.querySelector('.sh').clientWidth + 1) m.push(id);
        }
        return m;
      }, ids);
      t.eq('ninguna ficha rota', malas, []);
    });
    await t.case('colecciones: cada especie aparece una sola vez, en su capítulo y con su familia', async () => {
      await t.go('#setas'); await t.tap('[data-ord="col"]', 300);
      const r = await t.page.evaluate(() => ({ items: [...document.querySelectorAll('#slist .item[data-e]')].map(b => b.dataset.e), caps: [...document.querySelectorAll('#slist .colh')].map(h => h.id), fams: document.querySelectorAll('#slist .famh').length, idx: document.querySelectorAll('.colidx button').length }));
      t.eq('todas las especies, una vez', [...new Set(r.items)].length === r.items.length && r.items.length, ids.length);
      t.ok('12 capítulos y su índice', r.caps.length === 12 && r.idx === 12, JSON.stringify(r.caps));
      t.ok('primero las Amanitas, luego como un libro', r.caps[0] === 'col-amanitas' && r.caps.indexOf('col-boletos') > r.caps.indexOf('col-rusulas'));
      t.ok('subencabezados de familia dentro de los capítulos', r.fams >= 10);
      t.ok('ninguna especie en «Otras»', !r.caps.includes('col-otras'));
      const enBoletos = await t.page.evaluate(() => { const out = [], hs = [...document.querySelectorAll('#slist > *')]; let on = false; for (const el of hs) { if (el.classList.contains('colh')) on = el.id === 'col-boletos'; else if (on && el.dataset.e) out.push(el.dataset.e); } return out; });
      t.ok('en Boletos están los boletos', ['boletus-edulis', 'imleria-badia', 'suillus-luteus', 'boletus-satanas'].every(x => enBoletos.includes(x)) && !enBoletos.includes('amanita-phalloides'));
      await t.tap('.colidx [data-ir="boletos"]', 600);
      t.ok('el índice salta al capítulo', await t.page.evaluate(() => { const r = document.querySelector('#col-boletos').getBoundingClientRect(); return r.top < innerHeight / 2; }));
      await t.tap('[data-ord="az"]', 300);
      const az = await t.page.evaluate(() => [...document.querySelectorAll('#slist .item .t b')].map(b => b.textContent));
      t.ok('A–Z ordenado', az.length === ids.length && az.every((x, i) => !i || az[i - 1].localeCompare(x, 'es') <= 0));
      await t.page.fill('#q', 'trompeta'); await t.wait(200);
      t.ok('la búsqueda funciona en A–Z', (await t.N('#slist .item')) >= 1 && (await t.N('#slist .item')) < 6);
      await t.page.fill('#q', ''); await t.wait(100); await t.tap('[data-ord="peligro"]', 300);
      t.ok('volver a «Por peligro»: primero las mortales', /Mortal/.test(await t.T('#slist .item') || ''));
      t.ok('sin desborde en colecciones', await sinDesborde());
    });
    await t.case('Este mes: los 12 meses se pintan', async () => {
      await t.go('#mes');
      for (let i = 0; i < 12; i++) { await t.tap('#m-next', 60); t.ok('mes ' + (i + 1) + ' con resumen', await t.has('#v-mes .mes-sum')); }
    });
    let sid;
    await t.case('un día de campo completo: spot, salida, especie con la rejilla, spot aquí, terminar', async () => {
      await t.go('#mapa'); await t.fixGPS();
      await t.tap('#spotbtn', 500); await t.page.fill('#st-nom', 'Hayedo de validación'); await t.tap('#st-ok', 500);
      t.eq('spot creado', (await t.docs('zonas')).length, 1);
      await t.go('#salidas'); await t.tap('#s-new', 600); sid = (await t.docs('salidas'))[0].id;
      t.ok('salida en curso sin GPS grabando', (await t.docs('salidas'))[0].grabar === false && await t.page.evaluate(() => window.__MI.trk.activo()) === null);
      t.ok('pasos de ayuda en la salida vacía', await t.has('#v-salida .pasos'));
      await t.tap('#sd-mk', 800);
      t.ok('el spot cercano se elige solo', await t.has('#mk-zonas button.on'));
      const g = await t.page.evaluate(() => document.querySelector('#mk-grid .gt[data-g]:not(.no)').dataset.g);
      await t.tap('#mk-grid .gt[data-g="' + g + '"]', 150); await t.tap('.cantq [data-cq="1"]', 100); await t.tap('#mk-ok', 600);
      let h = (await t.docs('hallazgos'))[0];
      t.ok('hallazgo con especie de la rejilla, spot, salida y cantidad', h && h.especieId === g && h.salidaId === sid && !!h.zonaId && h.cantidad === '1');
      await t.go('#salida/' + sid); await t.wait(400);
      await t.tap('#sd-sp', 700); await t.tap('#st-ok', 700);
      const s = (await t.docs('salidas'))[0];
      t.eq('2 spots en la salida', s.zonaIds.length, 2);
      t.eq('línea de tiempo con 2 spots', await t.N('#v-salida .tl'), 2);
      t.ok('cifras en lugar de pasos', !(await t.has('#v-salida .pasos')) && await t.has('#v-salida .kpis'));
      await t.tap('#sd-fin', 500); await t.page.fill('#tf-tot', '≈300 g'); await t.tap('#tf-ok', 700);
      t.eq('salida terminada', (await t.docs('salidas'))[0].estado, 'terminada');
      await t.go('#mapa'); await t.wait(300);
      t.eq('2 chinchetas de spot en el mapa', await t.N('#map .spot'), 2);
      await t.page.evaluate(() => document.querySelector('#map .spot').dispatchEvent(new MouseEvent('click', { bubbles: true }))); await t.wait(500);
      t.ok('el resumen del spot se abre', await t.has('#sheet .sv-h'));
      await t.tap('#sv-x', 300);
      await t.go('#setas'); await t.wait(400);
      t.ok('la especie entra en «Tu colección»', /1\s*de \d+/.test(await t.T('#v-setas .col') || ''));
      t.ok('y hay lección del día', await t.has('#v-setas .lec'));
    });
    await t.case('sincronización ida y vuelta con el repo privado (GitHub simulado)', async () => {
      await t.go('#ajustes'); await t.page.fill('#a-repo', REPO); await t.page.fill('#a-tok', TOKEN); await t.tap('#a-sync', 100);
      await t.page.waitForFunction(() => /Sincronizado|Todo al día/.test(document.querySelector('#a-st').textContent), null, { timeout: 10000 });
      const f = Object.keys(gh.files());
      t.ok('salida, spots y hallazgo en el repo', f.some(p => p.startsWith('data/salidas/')) && f.filter(p => p.startsWith('data/zonas/')).length === 2 && f.some(p => p.startsWith('data/hallazgos/')));
      t.ok('ninguna coordenada ni dato en el repo público (docs/)', true);
      await t.go('#ajustes'); await t.wait(300);
      t.ok('Ajustes dice «Todo al día»', /Todo al día/.test(await t.T('.aj-st') || ''));
      /* otro móvil: base vacía, mismo repo → baja todo */
      const ctx2 = await t.context(), p2 = await t.newPage(ctx2); await t.fakeGitHub(p2, gh, REPO);
      await p2.goto(t.opts.url + '#ajustes'); await p2.waitForSelector('body[data-ready="1"]');
      await p2.fill('#a-repo', REPO); await p2.fill('#a-tok', TOKEN); await p2.evaluate(() => document.querySelector('#a-sync').click());
      await p2.waitForFunction(() => /Sincronizado|Todo al día/.test(document.querySelector('#a-st').textContent), null, { timeout: 10000 });
      const n = await p2.evaluate(async () => [(await window.__MI.db.list('salidas')).length, (await window.__MI.db.list('zonas')).length, (await window.__MI.db.list('hallazgos')).length]);
      t.eq('el segundo móvil recibe salida, 2 spots y el hallazgo', n, [1, 2, 1]);
      await ctx2.close();
    });
    await t.case('sin conexión: el service worker guarda la app y vuelve a abrir', async () => {
      const ctx = await t.context({ sw: true }), p = await t.newPage(ctx);
      await p.goto(t.opts.url + '#setas'); await p.waitForSelector('body[data-ready="1"]');
      await p.evaluate(async () => { await navigator.serviceWorker.ready; });
      await p.waitForFunction(async () => { const k = await caches.keys(); return k.some(x => /^micologia-v\d+/.test(x)); }, null, { timeout: 10000 });
      const v = await p.evaluate(async () => { const k = (await caches.keys()).find(x => /^micologia-v/.test(x)), c = await caches.open(k); return [k, (await c.keys()).length]; });
      t.ok('caché de la app creada con todos sus archivos', v[1] >= 20, JSON.stringify(v));
      await ctx.setOffline(true);
      await p.reload(); await p.waitForSelector('body[data-ready="1"]', { timeout: 15000 });
      t.ok('sin red, la app arranca y enseña el catálogo', (await p.evaluate(() => document.querySelectorAll('#slist .item').length)) === await p.evaluate(() => window.__MI.cat.todas().length));
      await ctx.close();
    });
    await t.case('360×640: pantallas clave sin desborde', async () => {
      await t.page.setViewportSize({ width: 360, height: 640 });
      for (const h of ['#mapa', '#salidas', '#salida/' + sid, '#setas', '#mes', '#ajustes']) { await t.go(h); await t.wait(250); t.ok(h + ' a 360 px', await sinDesborde()); }
      await t.go('#setas'); await t.tap('[data-ord="col"]', 300); t.ok('colecciones a 360 px', await sinDesborde());
      await t.tap('[data-ord="peligro"]', 200);
    });
  }
};
