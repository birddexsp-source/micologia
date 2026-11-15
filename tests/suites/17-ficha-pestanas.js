/* Ficha unificada: cabecera, resumen rápido, pestañas y tarjetas con el mismo formato; sin contenido repetido. */
module.exports = {
  name: 'Ficha con pestañas y tarjetas',
  launch: { viewport: { width: 390, height: 844 } },
  async run(t) {
    const abrir = id => t.page.evaluate(i => window.__MI.abrirFicha(i), id).then(() => t.wait(350));
    const vis = () => t.page.evaluate(() => [...document.querySelectorAll('#sheet .fp')].filter(p => !p.hidden).map(p => p.dataset.fp));
    await t.case('estructura: cabecera, resumen de 3 datos y barra de pestañas; solo se ve un panel', async () => {
      await abrir('boletus-edulis');
      t.ok('cabecera con nombre, etiquetas y «lo primero que hay que mirar»', await t.has('#sheet .fh h2') && await t.has('#sheet .clave') && await t.has('#sheet .chips .tag'));
      t.eq('resumen rápido: Dónde, Cuándo y Comer', await t.page.evaluate(() => [...document.querySelectorAll('#sheet .rs small')].map(x => x.textContent.toLowerCase())), ['dónde', 'cuándo', 'comer']);
      const r = await t.page.evaluate(() => [...document.querySelectorAll('#sheet .rs b')].map(x => x.textContent));
      t.ok('los tres tienen valor (no vacíos)', r.length === 3 && r.every(x => x.trim().length > 1), r.join(' | '));
      t.eq('pestañas', await t.page.evaluate(() => [...document.querySelectorAll('#sheet .ft')].map(x => x.dataset.ft)), ['ident', 'conf', 'hab', 'cuando', 'comer', 'mas']);
      t.eq('al abrir solo se ve «Identificar»', await vis(), ['ident']);
      t.ok('la barra de pestañas se queda fija al bajar', await t.page.evaluate(() => getComputedStyle(document.querySelector('#ftabs')).position === 'sticky'));
    });
    await t.case('cada pestaña enseña lo suyo y solo lo suyo', async () => {
      const dentro = (k, sel) => t.page.evaluate(([k, sel]) => !!document.querySelector('#sheet .fp[data-fp="' + k + '"] ' + sel), [k, sel]);
      const ir = async k => { await t.page.click('#sheet .ft[data-ft="' + k + '"]'); await t.wait(250); };
      t.ok('Identificar: qué mirar y el botón de las partes', await dentro('ident', '.qm') && await dentro('ident', '[data-g]'));
      await ir('conf'); t.eq('solo Confusiones', await vis(), ['conf']); t.ok('con foto contra foto', await dentro('conf', '.cmp'));
      await ir('hab'); t.ok('Hábitat: «mira bajo…» y chips', await dentro('hab', '.hb-donde') && await dentro('hab', '.habs .hab'));
      await ir('cuando'); t.ok('Cuándo: meses y tiempo que necesita, con botón al Plan', await dentro('cuando', '.bars') && await dentro('cuando', '.cs') && await dentro('cuando', 'a[href^="#plan/"]'));
      await ir('comer'); t.ok('Recoger y comer: comestibilidad y cómo recogerla', await dentro('comer', '.com') && await dentro('comer', '.recog'));
      await ir('mas'); t.ok('Más: curiosidades, fuentes y créditos', await dentro('mas', '.curi') && /Fuentes/.test(await t.T('#sheet .fp[data-fp="mas"]') || '') && /Créditos/.test(await t.T('#sheet .fp[data-fp="mas"]') || ''));
      t.eq('la pestaña activa es «Más»', await t.page.evaluate(() => document.querySelector('#sheet .ft.on').dataset.ft), 'mas');
    });
    await t.case('fotos con flechas: visor de una foto cada vez, tocar un número y cambiar de foto', async () => {
      await abrir('amanita-phalloides');
      const q = f => t.page.evaluate(f);
      t.ok('el visor va lo primero en «Identificar»', await q(() => document.querySelector('#sheet .fp[data-fp="ident"] .fc').classList.contains('fc-vz')));
      const n = await q(() => ({ fotos: document.querySelectorAll('#sheet .vz-s').length, tabs: document.querySelectorAll('#sheet .vz-t').length, on: [...document.querySelectorAll('#sheet .vz-s')].map(f => f.querySelectorAll('.apl li.on').length), cr: document.querySelectorAll('#sheet .vz-cr').length, ojo: document.querySelectorAll('#sheet .vz .a-ojo').length }));
      t.ok('una pestaña por foto y una explicación visible por foto', n.fotos >= 2 && n.tabs === n.fotos && n.on.every(x => x === 1), JSON.stringify(n));
      t.ok('autor y licencia sobre cada foto; aviso de peligro una sola vez', n.cr === n.fotos && n.ojo === 1);
      const txt = () => q(() => document.querySelector('#sheet .vz-s[data-k="0"] .apl li.on b').textContent);
      const t1 = await txt();
      await t.page.click('#sheet .vz-s[data-k="0"] .ap[data-vp="1"] .ap-n'); await t.wait(200);
      const t2 = await txt();
      t.ok('tocar el número 2 enseña su explicación y lo resalta', t2 !== t1 && await q(() => document.querySelector('#sheet .vz-s[data-k="0"] .ap[data-vp="1"]').classList.contains('on')));
      await t.page.click('#sheet .vz-s[data-k="0"] [data-vn="-1"]'); await t.wait(200);
      t.eq('‹ vuelve al anterior', await txt(), t1);
      await t.page.click('#sheet .vz-t[data-vs="1"]'); await t.wait(900);
      const r = await q(() => { const c = document.querySelector('#sheet .vz-car'); return { i: Math.round(c.scrollLeft / c.clientWidth), on: document.querySelector('#sheet .vz-t.on').dataset.vs }; });
      t.ok('la pestaña de la foto 2 lleva a la foto 2', r.i === 1 && r.on === '1', JSON.stringify(r));
      t.ok('la ficha sigue abierta (el visor no dispara otros botones)', await t.has('#sheet .fh h2'));
    });
    await t.case('tocar un dato del resumen salta a su pestaña', async () => {
      await abrir('boletus-edulis');
      await t.page.click('#sheet .rs[data-ft="hab"]'); await t.wait(300);
      t.eq('«Dónde» abre Hábitat', await vis(), ['hab']);
      await t.page.click('#sheet .rs[data-ft="cuando"]'); await t.wait(300); t.eq('«Cuándo» abre Cuándo', await vis(), ['cuando']);
      await t.page.click('#sheet .rs[data-ft="comer"]'); await t.wait(300); t.eq('«Comer» abre Recoger y comer', await vis(), ['comer']);
    });
    await t.case('sin repeticiones: cada cosa sale una sola vez', async () => {
      await t.page.evaluate(() => { window.__MI.abrirFicha('amanita-phalloides'); window.__MI.fichaTab('todo'); }); await t.wait(300);
      const n = await t.page.evaluate(() => ({ aviso: document.querySelectorAll('#sheet .warn').length, antes: document.querySelectorAll('#sheet #fi-antes').length, fuentesH: [...document.querySelectorAll('#sheet .fc-h h3')].filter(h => /^Fuentes$/.test(h.textContent)).length, nograndes: document.querySelectorAll('#sheet .sec').length, noautoriza: (document.querySelector('#sheet').textContent.match(/no te autoriza/gi) || []).length }));
      t.eq('un solo aviso general', n.aviso, 1); t.ok('como mucho un botón «Antes de comer»', n.antes <= 1); t.eq('una sola sección «Fuentes»', n.fuentesH, 1);
      t.eq('ya no queda el estilo antiguo de títulos sueltos', n.nograndes, 0);
      t.eq('el mensaje «no te autoriza…» no se repite', n.noautoriza, 0);
    });
    await t.case('todas las tarjetas comparten formato: icono + título', async () => {
      const r = await t.page.evaluate(() => { window.__MI.abrirFicha('lactarius-deliciosus'); window.__MI.fichaTab('todo'); const fc = [...document.querySelectorAll('#sheet .fc')]; const mal = fc.filter(c => !(c.querySelector('.fc-h i svg') || c.classList.contains('conf')) || (!c.classList.contains('conf') && !c.querySelector('.fc-h h3'))).length; return { n: fc.length, mal, cajas: document.querySelectorAll('#sheet .fc .fc').length }; });
      t.ok('hay varias tarjetas y todas tienen icono y título', r.n >= 6 && r.mal === 0, JSON.stringify(r)); t.eq('no hay cajas dentro de cajas', r.cajas, 0);
    });
    await t.case('una especie sin confusiones no muestra esa pestaña; sin desbordes a 360 px', async () => {
      const ids = await t.page.evaluate(() => window.__MI.cat.todas().filter(e => !(e.confusiones || []).length).map(e => e.id).slice(0, 1));
      if (ids.length) { await abrir(ids[0]); t.ok('sin pestaña «Confusiones»', !(await t.has('#sheet .ft[data-ft="conf"]'))); } else t.ok('todas tienen confusiones', true);
      await t.page.setViewportSize({ width: 360, height: 640 }); await t.wait(200);
      const o = await t.page.evaluate(() => { const bad = []; for (const id of ['boletus-edulis', 'amanita-phalloides', 'cantharellus-cibarius', 'trametes-versicolor']) { window.__MI.abrirFicha(id); window.__MI.fichaTab('todo'); const s = document.querySelector('#sheet .sh'); if (s.scrollWidth > s.clientWidth + 1) bad.push(id); } return bad; });
      t.eq('sin desborde horizontal con todas las pestañas abiertas', o, []);
      await t.page.setViewportSize({ width: 390, height: 844 });
    });
  }
};
