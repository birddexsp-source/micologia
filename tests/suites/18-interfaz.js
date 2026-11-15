/* Mejora de la interfaz (v31): comprueba fase a fase lo que se cambió. */
module.exports = {
  name: 'Interfaz unificada (fases 1–5)',
  launch: { viewport: { width: 390, height: 844 } },
  async run(t) {
    const p = t.page;
    await t.case('datos de ejemplo', async () => {
      await t.put('zonas', 'iz1', { nombre: 'Pinar', lat: 43.39, lon: -2.74, estado: 'visitada', notas: '', fotos: [], audios: [], transcripciones: {} });
      await t.put('zonas', 'iz2', { nombre: 'Robledal', lat: 43.40, lon: -2.73, estado: 'por_visitar', notas: '', fotos: [], audios: [], transcripciones: {} });
      const y = new Date().getFullYear();
      await t.put('salidas', 'is1', { fecha: y + '-11-08', titulo: 'Vuelta', zonaIds: ['iz1'], estado: 'terminada', creada: Date.now() - 9e6, fin: Date.now() - 5e6, fotos: [], fotosCosecha: [], track: [], totalTxt: '', notas: '' });
      await t.put('salidas', 'is2', { fecha: (y - 1) + '-10-20', titulo: 'Del año pasado', zonaIds: ['iz1'], estado: 'terminada', creada: Date.now() - 4e10, fin: Date.now() - 4e10 + 9e6, fotos: [], fotosCosecha: [], track: [], totalTxt: '', notas: '' });
      for (const [id, e] of [['ih1', 'boletus-edulis'], ['ih2', 'boletus-edulis'], ['ih3', 'lactarius-deliciosus']]) await t.put('hallazgos', id, { salidaId: 'is1', zonaId: 'iz1', lat: 43.39, lon: -2.74, precisionM: 5, ts: Date.now() - 8e6, especieId: e, especieTxt: '', cantidad: '', estadoSeta: '', sustrato: '', notas: '', fotos: [], identificacion: 'provisional', confirmadoPor: '', recogida: false, audios: [], transcripciones: {} });
      t.ok('cargados', (await t.docs('hallazgos')).length === 3);
    });
    await t.case('Fase 1 · una sola letra y títulos iguales', async () => {
      await t.go('#salidas'); await t.wait(300);
      const r = await p.evaluate(() => { const f = s => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; }; return { sec: f('.sec').fontFamily, grp: f('.grp').fontFamily, mono: getComputedStyle(document.documentElement).getPropertyValue('--mono') }; });
      t.ok('los títulos de sección ya no usan letra monoespaciada', !/monospace|Menlo|SFMono/i.test(r.sec) && !/monospace|Menlo|SFMono/i.test(r.grp), r.sec);
      t.ok('la variable común es la letra del sistema', /system-ui|apple-system/i.test(r.mono));
      await t.go('#ajustes'); await t.wait(300);
      await t.go('#salida/is1'); await t.wait(400);
      t.ok('el título editable de la salida sigue sin caja (estilo propio)', await p.evaluate(() => { const c = getComputedStyle(document.querySelector('#sd-tit')); return c.backgroundColor === 'rgba(0, 0, 0, 0)' && parseFloat(c.fontSize) >= 22; }));
      await t.go('#ajustes'); await t.wait(300);
      t.eq('las etiquetas de formulario van en minúscula normal', await p.evaluate(() => getComputedStyle(document.querySelector('label.l')).textTransform), 'none');
      t.ok('el contador de sección es una píldora', await p.evaluate(() => { document.location.hash = '#salidas'; return new Promise(r => setTimeout(() => r(getComputedStyle(document.querySelector('.sec small')).borderRadius), 400)); }).then(x => parseFloat(x) > 20));
    });
    await t.case('Fase 2 · Setas: buscador arriba y fijo; al buscar desaparecen los bloques de aprender', async () => {
      await t.go('#setas'); await t.wait(500);
      const r = await p.evaluate(() => { const v = document.querySelector('#v-setas'), sb = v.querySelector('.sbar'), iw = v.querySelector('#intro-w'); return { antes: !!(sb.compareDocumentPosition(iw) & Node.DOCUMENT_POSITION_FOLLOWING), sticky: getComputedStyle(sb).position, top: sb.getBoundingClientRect().top - v.getBoundingClientRect().top }; });
      t.ok('el buscador va antes que «Hoy aprendes» y la colección', r.antes);
      t.ok('se queda fijo arriba y se ve sin bajar', r.sticky === 'sticky' && r.top < 30, JSON.stringify(r));
      await p.evaluate(() => { const v = document.querySelector('#v-setas'); v.scrollTop = 900; }); await t.wait(200);
      t.ok('al bajar, el buscador sigue visible', await p.evaluate(() => { const v = document.querySelector('#v-setas'), q = document.querySelector('#q').getBoundingClientRect(); return q.top >= v.getBoundingClientRect().top - 1 && q.top < v.getBoundingClientRect().top + 40; }));
      await p.evaluate(() => { document.querySelector('#v-setas').scrollTop = 0; });
      await p.fill('#q', 'níscalo'); await t.wait(250);
      t.ok('al escribir se ocultan los bloques de aprender', !(await t.visible('#intro-w')));
      t.ok('y salen los resultados', (await t.N('#slist .item')) >= 1);
      await p.fill('#q', ''); await t.wait(250);
      t.ok('al borrar vuelven', await t.visible('#intro-w'));
      t.ok('accesos en una fila (partes, libro, IA)', await p.evaluate(() => { const b = [...document.querySelectorAll('.learn2 .lc')]; return b.length === 3 && new Set(b.map(x => Math.round(x.getBoundingClientRect().top))).size === 1; }));
    });
    await t.case('Fase 3 · Mapa: filtros que caben y leyenda', async () => {
      await t.go('#mapa'); await t.wait(400);
      t.ok('los 4 filtros caben sin cortarse a 390 px', await p.evaluate(() => { const m = document.querySelector('.mchips'); return m.scrollWidth <= m.clientWidth + 1; }));
      t.ok('la leyenda empieza cerrada', !(await t.visible('#mleg')));
      await t.tap('#legbtn', 250);
      const l = await p.evaluate(() => ({ n: document.querySelectorAll('#mleg .ml-r').length, txt: document.querySelector('#mleg').textContent }));
      t.ok('al tocar ⓘ se abre con spots y colores de hallazgo', await t.visible('#mleg') && l.n >= 7 && /Spot visitado/.test(l.txt) && /quiero ir/.test(l.txt) && /Mortal/.test(l.txt), JSON.stringify(l));
      t.ok('el botón queda marcado', await p.evaluate(() => document.querySelector('#legbtn').classList.contains('on')));
      t.ok('no tapa los filtros', await p.evaluate(() => { const a = document.querySelector('#mleg').getBoundingClientRect(), b = document.querySelector('.mchips').getBoundingClientRect(); return a.top >= b.bottom - 1; }));
      await t.tap('#mleg', 200);
      t.ok('se cierra tocándola', !(await t.visible('#mleg')) && !(await p.evaluate(() => document.querySelector('#legbtn').classList.contains('on'))));
      await t.tap('#legbtn', 200); await p.evaluate(() => window.__MI.abrirSpot('iz1')); await t.wait(300);
      t.ok('se cierra sola al abrir una hoja (spot, marcar…)', !(await t.visible('#mleg')));
      await p.evaluate(() => { const s = document.querySelector('#sheet'); s.hidden = true; s.innerHTML = ''; });
    });
    await t.case('Fase 4 · Plan: selectores en fila, guía en una línea, gráfico en tarjeta', async () => {
      await p.evaluate(() => { const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }; const dias = {}; for (let k = -92; k < 16; k++) dias[d(k)] = { p: 4, tmax: 17, tmin: 9, tmed: 13 }; localStorage.setItem('mi.clima.43.4,-2.7', JSON.stringify({ t: Date.now(), dias })); localStorage.setItem('mi.plan', JSON.stringify({ obj: 'general', zona: 'bermeo' })); });
      await t.go('#plan'); await p.waitForSelector('#pl-res .pl-bars', { timeout: 8000 }); await t.wait(300);
      const r = await p.evaluate(() => { const a = document.querySelector('#pl-obj').getBoundingClientRect(), b = document.querySelector('#pl-lug').getBoundingClientRect(), g = document.querySelector('#pl-donde').getBoundingClientRect(); return { fila: Math.abs(a.top - b.top) < 2 && b.left > a.right, guia: g.height }; });
      t.ok('«a por qué salgo» y «dónde» en la misma fila', r.fila);
      t.ok('la guía de dónde mirar ocupa una sola línea', r.guia < 56, String(r.guia));
      t.ok('el gráfico va en su tarjeta «Día a día»', await t.has('.pl-chart .pl-bars') && /Día a día/.test(await t.T('.pl-chart') || ''));
      t.ok('el mejor día va antes que el gráfico', await p.evaluate(() => !!(document.querySelector('.pl-top').compareDocumentPosition(document.querySelector('.pl-chart')) & Node.DOCUMENT_POSITION_FOLLOWING)));
    });
    await t.case('Fase 5 · Salidas con resumen; Ajustes con panel de estado', async () => {
      await t.go('#salidas'); await t.wait(400);
      const n = await p.evaluate(() => [...document.querySelectorAll('.sal-res b')].map(b => +b.textContent));
      t.eq('resumen: 2 salidas · 3 hallazgos · 2 especies · 2 spots', n, [2, 3, 2, 2]);
      const y = String(new Date().getFullYear()), m = await p.evaluate(() => [...document.querySelectorAll('.item.sal small')].map(x => x.textContent));
      t.ok('no repite el año en curso, pero sí el de años anteriores', !m.some(x => x.includes(y)) && m.some(x => x.includes(String(+y - 1))), JSON.stringify(m));
      await t.go('#ajustes'); await t.wait(400);
      t.ok('panel de estado: sincronización + 3 casillas', await t.has('.aj-panel .aj-st') && (await t.N('.aj-panel .aj-t')) === 3);
      t.ok('iconos de línea, sin emojis', await p.evaluate(() => [...document.querySelectorAll('.aj-i')].every(x => x.querySelector('svg') && !/[\u{1F300}-\u{1FAFF}✨]/u.test(x.textContent))));
      await p.evaluate(() => { document.querySelector('#v-ajustes').scrollTop = 0; });
      await t.tap('[data-aj="aj-off"]', 700);
      t.ok('tocar «Mapa sin red» lleva a su bloque', await p.evaluate(() => { const v = document.querySelector('#v-ajustes').getBoundingClientRect(), b = document.querySelector('#aj-off').getBoundingClientRect(); return b.top >= v.top - 2 && b.top < v.top + 120; }));
    });
    await t.case('todas las pantallas a 360 px sin desbordes', async () => {
      await p.setViewportSize({ width: 360, height: 640 }); await t.wait(200);
      const mal = [];
      for (const h of ['#mapa', '#salidas', '#setas', '#mes', '#plan', '#ajustes']) { await t.go(h); await t.wait(450); const o = await p.evaluate(h => { const v = document.querySelector('#v-' + h.slice(1)); return v.scrollWidth > v.clientWidth + 1; }, h); if (o) mal.push(h); }
      t.eq('ninguna se sale de lado', mal, []);
      await p.setViewportSize({ width: 390, height: 844 });
    });
  }
};
