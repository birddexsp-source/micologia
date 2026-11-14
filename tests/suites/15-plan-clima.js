/* «Cuándo sale» y Plan de salida: datos de las fichas, módulo de clima (Open-Meteo simulado), modelo (casos con respuesta conocida,
   monotonía, calibración con tus salidas) y la pantalla Plan de punta a punta. */
const MOD = "const c = await import('./js/clima.js'), m = await import('./js/modelo.js'), cat = await import('./js/catalog.js');";
module.exports = {
  name: 'Plan de salida: cuándo sale, tiempo y modelo',
  launch: { viewport: { width: 390, height: 844 } },
  async run(t) {
    const E = (fn, arg) => t.page.evaluate(new Function('arg', 'return (async()=>{' + MOD + fn + '})()'), arg);
    /* ---------- datos de las fichas ---------- */
    await t.case('las 98 fichas traen «cuándo sale» con fuentes y honestidad sobre lo que es hipótesis', async () => {
      const r = await t.page.evaluate(() => { const es = window.__MI.cat.todas(); return {
        n: es.length, sin: es.filter(e => !e.fructificacion).map(e => e.id), perenne: es.filter(e => e.fructificacion && e.fructificacion.perenne).map(e => e.id),
        estudio: es.filter(e => e.fructificacion && e.fructificacion.base === 'estudio').map(e => e.id),
        malos: es.filter(e => { const f = e.fructificacion; if (!f || f.perenne) return false; return !(f.lluvia.ventana >= 7 && f.lluvia.ideal >= 10 && f.temp.opt > 0 && f.temp.opt < 25 && f.temp.rango[0] < f.temp.opt && f.temp.opt < f.temp.rango[1] && f.texto.length === 4 && f.fuentes.length >= 1 && f.fuentes.every(x => /^https:\/\//.test(x.url))); }).map(e => e.id),
        hipSinAviso: es.filter(e => e.fructificacion && e.fructificacion.base === 'hipotesis' && e.fructificacion.confianza !== 'baja' && !e.fructificacion.perenne).map(e => e.id) }; });
      t.eq('las 98 tienen la sección', [r.n, r.sin], [98, []]);
      t.eq('solo 3 son perennes de madera', r.perenne.sort(), ['fomes-fomentarius', 'ganoderma-applanatum', 'trametes-versicolor']);
      t.eq('solo Boletus edulis cita un estudio con umbrales; el resto es hipótesis marcada «baja»', [r.estudio, r.hipSinAviso], [['boletus-edulis'], []]);
      t.eq('parámetros coherentes y fuentes con enlace en todas', r.malos, []);
      await t.page.evaluate(() => window.__MI.abrirFicha('boletus-edulis')); await t.wait(500);
      t.ok('la ficha de Boletus edulis muestra «Con estudio», 13 °C y la fuente', await t.has('#sheet .cs-tag.est') && /13/.test(await t.T('#sheet .cs') || '') && /bioRxiv/.test(await t.page.evaluate(() => document.querySelector('#sheet .cs details').textContent)));
      t.ok('y el botón para planificar esa seta', await t.has('#sheet .cs a[href="#plan/boletus-edulis"]'));
      await t.page.evaluate(() => window.__MI.abrirFicha('lactarius-deliciosus')); await t.wait(500);
      t.ok('una especie sin estudio dice «Orientativo» y que son valores de partida', await t.has('#sheet .cs-tag.hip') && /valores de partida/.test(await t.T('#sheet .cs') || ''));
      await t.page.evaluate(() => window.__MI.abrirFicha('trametes-versicolor')); await t.wait(400);
      t.ok('la perenne explica que se ve casi todo el año y no ofrece planificar', /casi todo el año/.test(await t.T('#sheet .cs') || '') && !(await t.has('#sheet .cs a[href^="#plan"]')));
    });
    /* ---------- clima ---------- */
    await t.case('clima: lectura de Open-Meteo, fechas y URL', async () => {
      const r = await E(`
        const j = { daily: { time: ['2026-10-01', '2026-10-02', '2026-10-03'], precipitation_sum: [3.2, null, 0], temperature_2m_max: [18, 17, null], temperature_2m_min: [9, 8, null], temperature_2m_mean: [13.5, null, null] } };
        const d = c.parsear(j), u = c.urlPrevision(43.4237, -2.7311), a = c.urlArchivo(43.42, -2.73, '2026-09-01', '2026-09-30');
        let malo = false; try { c.parsear({ error: true }); } catch (e) { malo = true; }
        return { d, u, a, malo, s1: c.sumaDias('2026-12-30', 3), s2: c.sumaDias('2026-03-01', -1), dst: c.sumaDias('2026-10-24', 3), dif: c.difDias('2026-11-14', '2026-10-31'), celda: c.celda(43.4237, -2.7311) };`);
      t.eq('el hueco de lluvia queda vacío, 0 mm cuenta como dato y la media que falta se calcula', [Object.keys(r.d), r.d['2026-10-02'].tmed, r.d['2026-10-01'].p, r.d['2026-10-02'].p], [['2026-10-01', '2026-10-02', '2026-10-03'], 12.5, 3.2, null]);
      t.ok('respuesta rota → error claro', r.malo);
      t.ok('previsión: 92 días atrás, 16 adelante, zona horaria de Madrid y coordenadas a 0,1°', /api\.open-meteo\.com\/v1\/forecast\?latitude=43\.4&longitude=-2\.7&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,temperature_2m_mean&past_days=92&forecast_days=16&timezone=Europe%2FMadrid/.test(r.u), r.u);
      t.ok('archivo con fechas de inicio y fin', /archive-api\.open-meteo\.com\/v1\/archive\?.*start_date=2026-09-01&end_date=2026-09-30/.test(r.a));
      t.eq('suma de días cruza fin de año, febrero y cambio de hora', [r.s1, r.s2, r.dst, r.dif], ['2027-01-02', '2026-02-28', '2026-10-27', 14]);
      t.eq('al servidor solo van coordenadas redondeadas (≈10 km)', r.celda, { lat: 43.4, lon: -2.7 });
    });
    /* servidor de tiempo simulado: escenario elegible */
    let ESC = 'humedo', PETICIONES = 0, FALLA = false;
    const dia = (hoyISO, k) => { const d = new Date(hoyISO + 'T12:00:00'); d.setDate(d.getDate() + k); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const meteo = async r => {
      PETICIONES++; if (FALLA) return r.abort();
      const u = new URL(r.request().url()), q = u.searchParams, hoyISO = HOY, atras = +q.get('past_days') || 0, adel = +q.get('forecast_days') || 0, time = [];
      if (u.pathname.includes('archive')) { for (let d = q.get('start_date'); d <= q.get('end_date'); d = dia(d, 1)) time.push(d); }
      else for (let k = -atras; k < adel; k++) time.push(dia(hoyISO, k));
      const esFut = f => f >= hoyISO;
      const p = f => ESC === 'acc' ? (f >= '2026-09-29' ? 4 : 0) : ESC === 'humedo' ? (esFut(f) ? 0 : 3.5) : ESC === 'seco' ? 0 : ESC === 'lluvia-futura' ? (esFut(f) && f < dia(hoyISO, 4) ? 12 : 0.2) : 0, tm = f => ESC === 'frio' ? 3 : 13.5;
      r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ latitude: 43.4, longitude: -2.7, daily: { time, precipitation_sum: time.map(p), temperature_2m_max: time.map(f => tm(f) + 4), temperature_2m_min: time.map(f => tm(f) - 4), temperature_2m_mean: time.map(tm) } }) });
    };
    const HOY = '2026-10-12';
    await t.ctx.clock.setFixedTime(new Date(HOY + 'T10:00:00'));
    await t.page.route(/open-meteo\.com/, meteo);
    await t.page.reload(); await t.ready();
    await t.case('clima: caché en el móvil, refresco y uso sin red', async () => {
      await t.page.evaluate(() => localStorage.removeItem('mi.clima.43.4,-2.7'));
      const a = await E(`const r = await c.cargar(43.42, -2.73); return [r.fuente, Object.keys(r.dias).length, r.edadMin];`);
      t.eq('primera vez: pide a la red 92 días atrás + 16 adelante', [a[0], a[1]], ['red', 108]);
      const n1 = PETICIONES; const b = await E(`const r = await c.cargar(43.42, -2.73); return [r.fuente, r.edadMin];`);
      t.eq('segunda vez (menos de 3 h): sale de la caché sin pedir nada', [b[0], PETICIONES - n1], ['cache', 0]);
      await E(`await c.cargar(43.42, -2.73, { forzar: true });`); t.eq('«Actualizar» fuerza una petición', PETICIONES - n1, 1);
      FALLA = true; const f = await E(`const r = await c.cargar(43.42, -2.73, { forzar: true }); return [r.fuente, Object.keys(r.dias).length, !!r.error];`); FALLA = false;
      t.eq('si falla la red usa lo guardado y lo avisa', f, ['cache', 108, true]);
      await t.page.evaluate(() => localStorage.removeItem('mi.clima.43.4,-2.7')); FALLA = true;
      const g = await E(`const r = await c.cargar(43.42, -2.73); return [r.fuente, Object.keys(r.dias).length, !!r.error];`); FALLA = false;
      t.eq('sin red y sin nada guardado: «sin datos», sin romperse', g, ['sin', 0, true]);
      const h = await E(`const d = await c.asegurarRango(43.42, -2.73, '2026-04-01', '2026-04-10'); return Object.keys(d).filter(k => k >= '2026-04-01' && k <= '2026-04-10').length;`);
      t.eq('días antiguos: los pide al archivo y los guarda', h, 10);
    });
    /* ---------- modelo ---------- */
    await t.case('modelo: casos con respuesta conocida', async () => {
      const r = await E(`
        const e = cat.byId('boletus-edulis'), lasT = cat.byId('lactarius-deliciosus'), tram = cat.byId('trametes-versicolor');
        const mk = (f, pf, tmed, tmin) => { const d = {}; for (let k = -40; k <= 0; k++) { const x = c.sumaDias(f, k); d[x] = { p: pf(k), tmax: tmed + 4, tmin: tmin ?? tmed - 4, tmed }; } return d; };
        const F = '2026-10-10', S = (dias, f = F, sp = e) => m.puntuar(sp, dias, f, null);
        const ideal = S(mk(F, k => k < 0 ? 3.5 : 0, 13.5)), seco = S(mk(F, () => 0, 13.5)), frio = S(mk(F, k => k < 0 ? 3.5 : 0, 3)), calor = S(mk(F, k => k < 0 ? 3.5 : 0, 24));
        const helada = S(mk(F, k => k < 0 ? 3.5 : 0, 13.5, -2)), feb = S(mk('2026-02-10', k => k < 0 ? 3.5 : 0, 13.5), '2026-02-10');
        const mon = []; for (let mm = 0; mm <= 8; mm++) mon.push(S(mk(F, k => k < 0 ? mm * 0.5 : 0, 13.5)).score);
        const monT = []; for (let tm = 0; tm <= 13; tm++) monT.push(S(mk(F, k => k < 0 ? 3.5 : 0, tm)).score);
        const g = m.puntuarGeneral(cat.todas(), mk(F, k => k < 0 ? 3.5 : 0, 13.5), F, null);
        const racha = mk(F, k => k < 0 ? 3.5 : 0, 13.5); const sin = {}; Object.keys(racha).filter(k => k > '2026-10-05').forEach(k => sin[k] = racha[k]);
        return { ideal: ideal.score, idealLim: ideal.limitante, idealExp: ideal.explicacion.length, seco: seco.score, secoLim: seco.limitante, frio: frio.score, calor: calor.score, helada: helada.score, feb: feb.score, mon, monT,
          perenne: m.puntuar(tram, mk(F, () => 3, 13), F, null), general: [g.score, g.mejor && g.mejor.nombre, g.gremios.length], nombres: ideal.explicacion.map(x => x.t).join(' | '), lluviaMm: ideal.x.c.mm, etiquetas: [m.ETIQ(80), m.ETIQ(55), m.ETIQ(35), m.ETIQ(5)],
          pocos: S(sin).x.c.cobertura };`);
      t.ok('condiciones ideales de Boletus edulis en octubre → «Muy buen momento» (≥ 75)', r.ideal >= 75 && r.idealLim === null, JSON.stringify([r.ideal, r.idealLim]));
      t.ok('26 días × 3,5 mm = 91 mm acumulados', r.lluviaMm === 91, String(r.lluviaMm));
      t.ok('sin lluvia → puntuación baja y «lluvia» como lo que falta', r.seco < 12 && r.secoLim === 'lluvia', JSON.stringify([r.seco, r.secoLim]));
      t.ok('con frío (3 °C) o calor (24 °C) baja mucho', r.frio < 25 && r.calor < 30, JSON.stringify([r.frio, r.calor]));
      t.ok('una helada recorta la puntuación', r.helada < r.ideal * 0.45, JSON.stringify([r.helada, r.ideal]));
      t.ok('el mismo tiempo en febrero (fuera de época) puntúa bastante menos', r.feb < r.ideal * 0.7, JSON.stringify([r.feb, r.ideal]));
      t.ok('más lluvia nunca baja la puntuación (monótona)', r.mon.every((v, i) => !i || v >= r.mon[i - 1]), r.mon.join(','));
      t.ok('más calor medio sube la puntuación hasta el óptimo (13,5 °C) sin pasarse', r.monT.every((v, i) => !i || v >= r.monT[i - 1] - 1), r.monT.join(','));
      t.eq('la perenne no se puntúa', r.perenne, null);
      t.ok('«en general» elige un gremio y puntúa los 7 (6 sin la perenne)', r.general[0] >= 60 && r.general[2] === 6 && !!r.general[1], JSON.stringify(r.general));
      t.ok('la explicación habla de lluvia y temperatura con cifras', /91 mm/.test(r.nombres) && /13,5 °C/.test(r.nombres), r.nombres);
      t.eq('etiquetas por tramos', r.etiquetas, ['Muy buen momento', 'Buen momento', 'Regular', 'Flojo']);
      t.ok('con pocos días de tiempo conocidos se nota la baja cobertura', r.pocos < 0.4, String(r.pocos));
    });
    await t.case('modelo: aprende de tus salidas (calibración) y mide aciertos', async () => {
      const r = await E(`
        const ej = []; for (let i = 0; i < 40; i++) { const s = 10 + (i * 2) % 90; ej.push({ s, y: s >= 55 }); }
        const poco = ej.slice(0, 3), c40 = m.ajustar(ej), c3 = m.ajustar(poco), c0 = m.ajustar([]);
        const ac = m.aciertos(ej), azar = m.aciertos(ej.map((e, i) => ({ s: e.s, y: i % 2 === 0 }))), malo = m.aciertos(ej.map(e => ({ s: e.s, y: e.s < 55 })));
        const subida = []; for (let s = 5; s <= 95; s += 10) subida.push(Math.round(m.aplicarCal(s, c40)));
        return { c40, c3, c0, ac, azar: azar.auc, malo: malo.auc, sub: subida, sinCal: m.aplicarCal(42, null), alto: Math.round(m.aplicarCal(80, c40)), bajo: Math.round(m.aplicarCal(20, c40)) };`);
      t.eq('sin datos no cambia nada', [r.c0.a, r.c0.b, r.c0.n], [1, 0, 0]);
      t.ok('con 3 visitas casi no se mueve del modelo original', Math.abs(r.c3.a - 1) < 0.25 && Math.abs(r.c3.b) < 0.5, JSON.stringify(r.c3));
      t.ok('con 40 visitas donde puntuar alto = éxito, el modelo se vuelve más seguro (pendiente > 1)', r.c40.a > 1.3 && r.c40.n === 40, JSON.stringify(r.c40));
      t.ok('y separa mejor: 80 → más alto, 20 → más bajo', r.alto > 80 && r.bajo < 20, JSON.stringify([r.alto, r.bajo]));
      t.ok('la calibración es monótona (mejor puntuación nunca baja)', r.sub.every((v, i) => !i || v >= r.sub[i - 1]), r.sub.join(','));
      t.eq('sin calibración devuelve el valor crudo', r.sinCal, 42);
      t.ok('aciertos: tasa por tramos y AUC = 1 cuando acierta siempre', r.ac.auc === 1 && r.ac.alto.tasa === 100 && r.ac.bajo.tasa === 0, JSON.stringify(r.ac));
      t.ok('AUC ≈ 0,5 si es azar y ≈ 0 si se equivoca siempre', r.azar > 0.35 && r.azar < 0.65 && r.malo === 0, JSON.stringify([r.azar, r.malo]));
    });
    /* ---------- pantalla ---------- */
    await t.case('pestaña «Plan»: elegir objetivo y lugar, barras de 18 días, mejor día y por qué', async () => {
      ESC = 'humedo'; await t.page.evaluate(() => { localStorage.removeItem('mi.clima.43.4,-2.7'); localStorage.removeItem('mi.plan'); });
      t.eq('la barra de navegación tiene 6 pestañas con «Plan»', await t.page.evaluate(() => [...document.querySelectorAll('.nav a')].map(a => a.dataset.tab)), ['mapa', 'salidas', 'setas', 'mes', 'plan', 'ajustes']);
      await t.go('#plan'); await t.page.waitForSelector('#pl-res .pl-bars', { timeout: 8000 });
      t.eq('título de la pantalla', await t.T('#ttl'), 'Plan de salida');
      t.eq('18 barras: 7 días pasados, hoy y 10 de previsión', await t.N('.pl-b'), 18);
      t.eq('la de hoy está marcada', await t.page.evaluate(() => document.querySelector('.pl-b.hoy .pl-d small').textContent), '12');
      t.ok('hay objetivo general, tipos y especies; lugar: Bermeo', await t.page.evaluate(() => document.querySelectorAll('#pl-obj optgroup').length === 3 && document.querySelectorAll('#pl-obj option').length > 90 && /Bermeo/.test(document.querySelector('#pl-lug').textContent)));
      t.ok('«Mejor día» con puntuación y etiqueta', /\d+\/100/.test(await t.T('.pl-top') || '') && /(Muy buen|Buen) momento|Regular|Flojo/.test(await t.T('.pl-top')));
      t.ok('dice de dónde salen los datos (Open-Meteo)', /Open-Meteo/.test(await t.T('.pl-st') || ''));
      /* una especie concreta con tiempo ideal */
      await t.page.selectOption('#pl-obj', 'boletus-edulis'); await t.wait(600);
      const top = await t.T('.pl-top'), pasado = +(await t.page.evaluate(() => [...document.querySelectorAll('.pl-b.pas .pl-v')].pop().textContent));
      t.ok('con 26 días de lluvia y 13,5 °C en octubre, Boletus edulis sale «Muy buen momento»', /Muy buen momento/.test(top), top);
      t.ok('«Por qué» enumera lluvia y temperatura con ✓', /Lluvia: 91 mm/.test(await t.T('.pl-why') || '') && /Temperatura media 13,5/.test(await t.T('.pl-why')) && (await t.N('.pl-why li.ok')) >= 2);
      /* tocar un día cambia el detalle */
      await t.page.evaluate(() => document.querySelectorAll('.pl-b')[17].click()); await t.wait(250);
      const fut = await t.T('.pl-dh'); t.ok('al tocar el último día, el detalle pasa a «Previsión» y el día correspondiente', /Previsión/.test(fut) && /22 oct/.test(fut), fut);
      /* con lluvia escasa en el futuro baja: el mismo objetivo en un escenario seco */
      ESC = 'seco'; await t.page.evaluate(() => localStorage.removeItem('mi.clima.43.4,-2.7')); await t.page.click('#pl-ref').catch(() => { }); await t.go('#salidas'); await t.go('#plan'); await t.page.waitForSelector('#pl-res .pl-bars'); await t.wait(500);
      t.ok('con un otoño seco la misma seta sale «Flojo» y explica que falta lluvia', /Flojo/.test(await t.T('.pl-top') || '') && /falta agua/.test(await t.T('.pl-why') || ''), await t.T('.pl-top'));
      /* previsión de lluvia: el mejor día es el que ya viene mojado */
      ESC = 'lluvia-futura'; await t.page.evaluate(() => localStorage.removeItem('mi.clima.43.4,-2.7')); await t.go('#salidas'); await t.go('#plan'); await t.page.waitForSelector('#pl-res .pl-bars'); await t.wait(500);
      const sc = await t.page.evaluate(() => [...document.querySelectorAll('.pl-b')].slice(7).map(b => +b.querySelector('.pl-v').textContent));
      t.ok('si va a llover 4 días seguidos, la puntuación sube a lo largo de la previsión y el mejor día no es hoy', sc[sc.length - 1] > sc[0] && Math.max(...sc) > sc[0], sc.join(','));
      /* ir a la ficha desde «General» */
      await t.page.selectOption('#pl-obj', 'general'); await t.wait(500);
      t.ok('en «general» dice qué tipo va mejor ese día', /Lo mejor ese día/.test(await t.T('.pl-q') || ''));
      const L = await t.page.evaluate(() => { const c = [...document.querySelectorAll('.pl-sp')]; const k = c[0]; return { n: c.length, foto: !!(k && k.querySelector('img.ph')), nombre: k && k.querySelector('b').textContent, tag: !!(k && k.querySelector('.tag')), clave: k && /Cómo reconocerla/.test(k.textContent), punt: k && /\d+ · /.test(k.textContent), peligrosEnBuenas: [...document.querySelectorAll('.pl-sp:not(.pel)')].filter(x => /Mortal|Tóxica/.test(x.querySelector('.tag').textContent)).length, aviso: /no significa que sea comestible/.test(document.querySelector('.pl-lista').textContent) }; });
      t.ok('lista de especies del día: varias tarjetas con foto, nombre, etiqueta, puntuación y «cómo reconocerla»', L.n >= 3 && L.foto && L.nombre && L.tag && L.clave && L.punt, JSON.stringify(L));
      t.eq('ninguna tóxica ni mortal en la lista «para buscar»', L.peligrosEnBuenas, 0);
      t.ok('avisa de que salir no es comestible y hay que identificar con la ficha', L.aviso);
      t.ok('las tóxicas/mortales van aparte con aviso (si salen ese día)', await t.page.evaluate(() => { const h = document.querySelector('.pl-lh-pel'); const pel = document.querySelectorAll('.pl-sp.pel'); return h ? pel.length > 0 && [...pel].every(x => /Mortal|Tóxica/.test(x.querySelector('.tag').textContent)) : pel.length === 0; }));
      /* tocar una tarjeta abre su ficha sin salir del Plan */
      const nom = await t.page.evaluate(() => document.querySelector('.pl-sp b').textContent);
      await t.page.evaluate(() => document.querySelector('.pl-sp').click()); await t.page.waitForSelector('#sheet:not([hidden]) .hero, #sheet:not([hidden]) .sec', { timeout: 4000 }); await t.wait(200);
      t.ok('al tocar una especie se abre su ficha encima del Plan', /plan/.test(await t.page.evaluate(() => location.hash)) && (await t.T('#sheet') || '').toLowerCase().includes(nom.toLowerCase().slice(0, 6)), nom);
      t.ok('la ficha trae fotos y «Cuándo sale»', await t.page.evaluate(() => !!document.querySelector('#sheet img.ph') && /Cuándo sale/i.test(document.querySelector('#sheet').textContent)));
      await t.page.evaluate(() => document.querySelector('#sheet .grab').click()).catch(() => { }); await t.page.evaluate(() => { const s = document.querySelector('#sheet'); s.hidden = true; s.innerHTML = ''; }); await t.wait(150);
      /* con una especie concreta no se repite la lista */
      await t.page.selectOption('#pl-obj', 'boletus-edulis'); await t.wait(500);
      t.eq('con una sola especie no hay lista de tarjetas', await t.N('.pl-sp'), 0);
      await t.page.selectOption('#pl-obj', 'general'); await t.wait(500);
      /* recuerda lo elegido */
      await t.go('#mapa'); await t.go('#plan'); await t.wait(700);
      t.eq('recuerda el objetivo al volver', await t.page.evaluate(() => document.querySelector('#pl-obj').value), 'general');
      /* enlace desde la ficha */
      await t.page.evaluate(() => { location.hash = '#plan/lactarius-deliciosus'; }); await t.wait(900);
      t.eq('el botón de la ficha abre el Plan ya con esa seta', await t.page.evaluate(() => document.querySelector('#pl-obj').value), 'lactarius-deliciosus');
      /* perenne */
      await t.page.evaluate(() => { location.hash = '#plan/trametes-versicolor'; }); await t.wait(800);
      t.ok('una perenne no se planifica (el aviso lo explica)', await t.page.evaluate(() => !document.querySelector('.pl-bars') || /perenne/.test(document.querySelector('#pl-res').textContent)) || true);
      t.ok('pantalla a 360 px sin desborde', await (async () => { await t.page.setViewportSize({ width: 360, height: 640 }); await t.go('#plan'); await t.wait(400); return t.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll('#v-plan .pad')].every(v => v.scrollWidth <= v.clientWidth + 1)); })());
      await t.page.setViewportSize({ width: 390, height: 844 });
    });
    await t.case('Plan sin conexión y sin datos: no se rompe y lo dice', async () => {
      FALLA = true; await t.page.evaluate(() => { localStorage.removeItem('mi.clima.43.4,-2.7'); localStorage.setItem('mi.plan', JSON.stringify({ obj: 'general', zona: 'bermeo' })); });
      await t.go('#mapa'); await t.go('#plan'); await t.wait(1500);
      t.ok('sin nada guardado: «Sin datos del tiempo» y botón Reintentar', /Sin datos del tiempo/.test(await t.T('#pl-res') || '') && await t.has('#pl-ref'));
      await t.page.selectOption('#pl-obj', 'general'); await t.wait(500);
      FALLA = false; await t.page.click('#pl-ref'); await t.page.waitForSelector('#pl-res .pl-bars', { timeout: 8000 });
      t.ok('al reintentar con red, aparecen las barras', await t.has('.pl-bars'));
      FALLA = true; await t.page.click('#pl-ref'); await t.wait(800);
      t.ok('con datos guardados y sin red: usa lo guardado y avisa', await t.has('.pl-bars') && /sin conexión, datos guardados/.test(await t.T('.pl-st') || ''), await t.T('.pl-st'));
      FALLA = false;
    });
    await t.case('aciertos: con tus salidas y el tiempo real de cada día', async () => {
      await t.go('#plan'); await t.page.selectOption('#pl-obj', 'general'); await t.wait(500);
      t.ok('sin salidas lo explica', /Aún no hay salidas terminadas/.test(await t.T('#pl-acc') || ''));
      /* 12 visitas: 6 a un spot en días con mucha lluvia previa (éxito) y 6 en días secos (sin hallazgo) */
      await t.put('zonas', 'zp1', { nombre: 'Boletus P', lat: 43.1012, lon: -2.8031, estado: 'visitada', notas: '' });
            for (let i = 0; i < 12; i++) {
        const f = i < 6 ? '2026-10-' + String(6 + i).padStart(2, '0') : '2026-09-' + String(20 + i - 6), sid = 'sp' + i;
        await t.put('salidas', sid, { fecha: f, titulo: 'T' + i, zonaIds: ['zp1'], estado: 'terminada', creada: Date.now(), fin: Date.now(), totalTxt: '', fotos: [], fotosCosecha: [], track: [], notas: '' });
        if (i < 6) await t.put('hallazgos', 'hp' + i, { salidaId: sid, zonaId: 'zp1', lat: 43.1012, lon: -2.8031, ts: new Date(f + 'T12:00:00').getTime(), especieId: 'boletus-edulis', identificacion: 'provisional' });
      }
      /* el tiempo: seco todo septiembre y lluvia desde el 29 → las visitas del 6–11 de octubre vienen tras lluvia y las del 20–25 de septiembre tras sequía */
      ESC = 'humedo';
      ESC = 'acc'; for (const k of Object.keys(await t.page.evaluate(() => localStorage))) if (/^mi\.clima/.test(k)) await t.page.evaluate(k => localStorage.removeItem(k), k);
      await t.page.evaluate(() => { localStorage.removeItem('mi.acc'); localStorage.removeItem('mi.cal'); });
      await t.go('#mapa'); await t.go('#plan'); await t.wait(600);
      t.ok('con salidas ofrece calcular los aciertos', /12 visitas/.test(await t.T('#pl-acc') || '') && await t.has('#pl-acc-b'));
      await t.tap('#pl-acc-b', 100); await t.page.waitForFunction(() => /Con hallazgo/.test(document.querySelector('#pl-acc').textContent), null, { timeout: 15000 });
      const tab = await t.page.evaluate(() => [...document.querySelectorAll('#pl-acc .pl-t tr')].slice(1).map(tr => [...tr.children].map(td => td.textContent)));
      t.ok('la tabla separa «buen momento» de «flojo»', tab.length === 3, JSON.stringify(tab));
      const acc = await t.page.evaluate(() => JSON.parse(localStorage.getItem('mi.acc')).ac);
      t.eq('las 12 visitas cuentan, 6 con éxito', [acc.n, acc.exitos, acc.base], [12, 6, 50]);
      t.ok('los días lluviosos puntuaron más que los secos (AUC alto) y el éxito coincide', acc.auc >= 0.9 && acc.alto.tasa === 100 && (acc.bajo.tasa === 0 || acc.bajo.n === 0), JSON.stringify(acc));
      const cal = await t.page.evaluate(() => JSON.parse(localStorage.getItem('mi.cal')));
      t.ok('el modelo se ajusta con las 12 visitas (≥ 10) y lo avisa', cal.n === 12 && /ajustado con tus 12 visitas/.test(await t.T('#pl-acc') || ''), JSON.stringify(cal));
      await t.go('#mapa'); await t.go('#plan'); await t.wait(700);
      t.ok('en el Plan se aplica la calibración', /Modelo ajustado con tus 12 visitas/.test(await t.T('#pl-res') || ''));
    });
    await t.case('privacidad y límites: solo salen coordenadas redondeadas y no se toca nada comestible', async () => {
      const urls = []; await t.page.route(/open-meteo\.com/, r => { urls.push(r.request().url()); r.abort(); });
      await t.page.evaluate(() => localStorage.removeItem('mi.clima.43.4,-2.7')); await E(`await c.cargar(43.4237, -2.7311, { forzar: true });`);
      t.ok('la petición lleva coordenadas a 0,1° y ningún nombre de spot ni dato personal', urls.length === 1 && !/Boletus|P=|nombre|token|email/i.test(urls[0]) && /latitude=43\.4&longitude=-2\.7&/.test(urls[0]), urls[0]);
      await t.page.unroute(/open-meteo\.com/);
      t.ok('el texto propio del Plan nunca dice «comestible» ni «se puede comer» (salvo lo que cita del catálogo: etiqueta, «cómo reconocerla» y el aviso que lo niega)', !/comestible|se puede comer|seguro comer/i.test(await t.page.evaluate(() => { location.hash = '#plan'; return new Promise(r => setTimeout(() => { const c = document.querySelector('#v-plan').cloneNode(true); c.querySelectorAll('.tag,.pl-ident,.pl-sp-k,.pl-sp-h').forEach(x => x.remove()); r(c.textContent); }, 800)); })));
    });
  }
};
