/* Reconocer con IA: sin clave en el repo, abstención, ids inventados y pantalla con Gemini simulado. */
const fs = require('fs'), path = require('path');
const { PNG1 } = require('../lib/harness');
const DOCS = path.join(__dirname, '..', '..', 'docs');
const KEY = 'AIza' + 'x'.repeat(35);
const respuesta = o => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(o) }] } }] });
module.exports = {
  name: 'Reconocer con IA (Gemini simulado)',
  launch: { viewport: { width: 390, height: 844 } },
  async run(t) {
    await t.case('seguridad: ninguna clave de Google en docs/', async () => {
      const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(x => x.isDirectory() ? walk(path.join(d, x.name)) : [path.join(d, x.name)]);
      const bad = walk(DOCS).filter(f => !/\.(png|jpg|webp)$/.test(f)).filter(f => /AIza[\w-]{30,}|AQ\.[A-Za-z0-9_-]{30,}/.test(fs.readFileSync(f, 'utf8')));
      t.eq('sin claves AIza… en el repo público', bad, []);
      const s = fs.readFileSync(path.join(DOCS, 'js/ia.js'), 'utf8');
      t.ok('el prompt exige no inventar rasgos y abstenerse', /no inventes rasgos/i.test(s) && /no bastan/i.test(s));
      t.ok('el prompt no habla de comestibilidad', /No hables de si se puede comer/.test(s));
    });
    await t.case('limpiar: id inventado → fuera de la colección; no seta → sin candidatas', async () => {
      const r = await t.page.evaluate(() => {
        const { ia, cat } = window.__MI, E = cat.todas();
        const a = ia.limpiar({ esSeta: true, calidad: 'buena', faltaVer: '', candidatas: [{ id: 'no-existe', nombreCientifico: 'Boletus inventus', nombreComun: 'x', confianza: 90, rasgosVistos: 'y' }, { id: E[0].id, nombreCientifico: 'z', nombreComun: 'z', confianza: 150, rasgosVistos: '' }] }, E);
        const b = ia.limpiar({ esSeta: false, calidad: 'buena', faltaVer: '', candidatas: [{ id: E[0].id, nombreCientifico: 'z', nombreComun: 'z', confianza: 50, rasgosVistos: '' }] }, E);
        let c = ''; try { ia.limpiar({}, E); } catch (e) { c = 'error'; }
        return { id0: a.candidatas[0].id, id1: a.candidatas[1].id === E[0].id, conf: a.candidatas[1].confianza, b: b.candidatas.length, c };
      });
      t.eq('id inventado queda vacío', r.id0, ''); t.ok('id real se conserva', r.id1); t.eq('confianza acotada a 100', r.conf, 100);
      t.eq('no seta → 0 candidatas', r.b, 0); t.eq('respuesta rara → error', r.c, 'error');
      t.ok('forma de la clave', await t.page.evaluate(([k]) => window.__MI.ia.claveValida(k) && !window.__MI.ia.claveValida('hola') && window.__MI.ia.claveValida('AQ.' + 'x'.repeat(40)), [KEY]));
    });
    let llamadas = [], modo = 'ok', ids = [];
    await t.page.route('https://generativelanguage.googleapis.com/**', async r => {
      const rq = r.request(); llamadas.push({ key: rq.headers()['x-goog-api-key'], n: (rq.postDataJSON().contents[0].parts.length - 1), txt: rq.postDataJSON().contents[0].parts[0].text });
      const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
      if (rq.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
      if (modo === 'rota') return r.fulfill({ status: 200, contentType: 'application/json', headers: h, body: JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{esSeta: tru' }] } }] }) });
      if (modo === 'noseta') return r.fulfill({ status: 200, contentType: 'application/json', headers: h, body: JSON.stringify(respuesta({ esSeta: false, calidad: 'buena', candidatas: [], faltaVer: '' })) });
      if (modo === '500') return r.fulfill({ status: 503, contentType: 'application/json', body: '{}', headers: h });
      if (modo === 'clave') return r.fulfill({ status: 403, contentType: 'application/json', body: '{}', headers: h });
      const cands = modo === 'ok'
        ? [{ id: ids[0], nombreCientifico: 'x', nombreComun: 'x', confianza: 80, rasgosVistos: 'sombrero rojo con puntos blancos' }, { id: '', nombreCientifico: 'Amanita nueva', nombreComun: 'Rara', confianza: 30, rasgosVistos: '' }]
        : [];
      r.fulfill({ status: 200, contentType: 'application/json', headers: h, body: JSON.stringify(respuesta({ esSeta: true, calidad: 'regular', candidatas: cands, faltaVer: modo === 'ok' ? '' : 'La base del pie con la volva' })) });
    });
    await t.case('pantalla: sin clave pide la clave y la guarda solo en el móvil', async () => {
      await t.go('#setas'); ids = [await t.page.evaluate(() => window.__MI.cat.todas().find(e => e.clase === 'toxica').id)];
      await t.tap('#ia-open', 300);
      t.ok('pide la clave', /clave gratuita de Gemini/.test(await t.T('#sheet') || ''));
      await t.page.fill('#ia-k', 'hola'); await t.tap('#ia-ks'); t.ok('rechaza una clave mal formada', /no tiene la forma/.test(await t.T('#sheet') || ''));
      await t.page.fill('#ia-k', KEY); await t.tap('#ia-ks');
      t.ok('ya enseña las 4 ranuras', (await t.N('.ia-slot')) === 4);
      t.eq('clave en localStorage', await t.page.evaluate(() => window.__MI.ia.getKey()), KEY);
      t.eq('«Reconocer» apagado sin fotos', await t.page.evaluate(() => document.querySelector('#ia-go').disabled), true);
    });
    await t.case('reconocer con 2 fotos: candidata de la colección + una fuera + aviso de peligro', async () => {
      const png = { name: 'a.png', mimeType: 'image/png', buffer: Buffer.from(PNG1, 'base64') };
      await t.page.setInputFiles('.ia-slot[data-i="0"] input', png); await t.wait(200);
      await t.page.setInputFiles('.ia-slot[data-i="2"] input', png); await t.wait(200);
      await t.tap('#ia-go', 1500);
      t.eq('una llamada con 2 imágenes y la clave en cabecera', llamadas.map(l => [l.key, l.n]), [[KEY, 2]]);
      t.eq('1 candidata de tu colección (abre su ficha)', await t.N('#sheet button.ia-row[data-e]'), 1);
      t.ok('la otra sale «no está en tu colección»', /Amanita nueva[\s\S]*no está en tu colección/i.test(await t.T('#sheet') || ''));
      t.ok('aviso de tóxica entre candidatas', /tóxica o mortal/.test(await t.T('#sheet') || ''));
      t.ok('muestra porcentajes ordenados (el más probable arriba)', await t.page.evaluate(() => { const v = [...document.querySelectorAll('#sheet .ia-pc')].map(x => parseInt(x.textContent)); return v.length === 2 && v[0] >= v[1] && v[0] === 80 && document.querySelectorAll('#sheet .ia-bar').length === 2; }));
      t.ok('recuerda que es solo una pista', /Es una pista, no una identificación/.test(await t.T('#sheet') || ''));
      t.ok('nunca dice «comestible» como veredicto', !/es comestible|se puede comer/i.test(await t.T('#sheet .ia-res') || ''));
      await t.shot('captura-ia-resultado');
      await t.tap('#sheet button.ia-row[data-e]', 300); t.ok('abre la ficha', await t.has('#hero, .ficha'));
    });
    await t.case('abstención: sin candidatas dice qué falta ver', async () => {
      modo = 'duda'; await t.page.evaluate(() => window.__MI.abrirIA()); await t.wait(150);
      await t.page.setInputFiles('.ia-slot[data-i="1"] input', { name: 'b.png', mimeType: 'image/png', buffer: Buffer.from(PNG1, 'base64') }); await t.wait(150);
      await t.tap('#ia-go', 1500);
      t.ok('no puede decidirlo', /no puedo decidirlo/i.test(await t.T('#sheet') || '')); t.ok('pide la base del pie', /base del pie con la volva/.test(await t.T('#sheet') || ''));
    });
    await t.case('clave rechazada por Google: se borra y lo explica', async () => {
      modo = 'clave'; await t.page.evaluate(() => window.__MI.abrirIA()); await t.wait(150);
      await t.page.setInputFiles('.ia-slot[data-i="1"] input', { name: 'b.png', mimeType: 'image/png', buffer: Buffer.from(PNG1, 'base64') }); await t.wait(150);
      await t.tap('#ia-go', 1500);
      t.ok('mensaje de clave', /clave/i.test(await t.T('#sheet .warn') || '')); t.eq('clave borrada', await t.page.evaluate(() => window.__MI.ia.getKey()), '');
    });
    await t.case('variedad: 1 foto, 4 fotos con nota, no seta, respuesta rota y servidor caído', async () => {
      const png = n => ({ name: n + '.png', mimeType: 'image/png', buffer: Buffer.from(PNG1, 'base64') });
      const abrir = async m => { modo = m; llamadas = []; await t.page.evaluate(k => { window.__MI.ia.setKey(k); window.__MI.abrirIA(); }, KEY); await t.wait(200); };
      await abrir('ok'); await t.page.setInputFiles('.ia-slot[data-i="3"] input', png('o')); await t.wait(150);
      await t.page.fill('#ia-nota', 'pinar de Pinus radiata'); await t.tap('#ia-go', 1500);
      t.eq('una sola foto, en la ranura «otra»', llamadas.map(l => l.n), [1]);
      t.ok('la nota viaja en el prompt', /pinar de Pinus radiata/.test(llamadas[0].txt));
      t.ok('el prompt admite fotos sueltas y desordenadas', /cualquier orden/.test(llamadas[0].txt));
      await abrir('ok');
      for (let i = 0; i < 4; i++) { await t.page.setInputFiles('.ia-slot[data-i="' + i + '"] input', png('f' + i)); await t.wait(120); }
      await t.tap('#ia-go', 1500); t.eq('cuatro fotos', llamadas.map(l => l.n), [4]);
      await abrir('noseta'); await t.page.setInputFiles('.ia-slot[data-i="0"] input', png('n')); await t.wait(120); await t.tap('#ia-go', 1200);
      t.ok('no parece una seta', /No parece una seta/.test(await t.T('#sheet') || ''));
      await abrir('rota'); await t.page.setInputFiles('.ia-slot[data-i="0"] input', png('r')); await t.wait(120); await t.tap('#ia-go', 2500);
      t.ok('JSON roto: mensaje claro, sin colgarse', /No se ha podido reconocer/.test(await t.T('#sheet .warn') || '')); t.ok('Reconocer vuelve a estar activo', await t.page.evaluate(() => !document.querySelector('#ia-go').disabled));
      t.ok('la clave sigue guardada', (await t.page.evaluate(() => window.__MI.ia.getKey())) === KEY);
      await abrir('500'); await t.page.setInputFiles('.ia-slot[data-i="0"] input', png('s')); await t.wait(120); await t.tap('#ia-go', 3000);
      t.ok('servidor caído: mensaje y prueba los 3 modelos', /No se ha podido reconocer/.test(await t.T('#sheet .warn') || '') && llamadas.length === 3);
    });
    await t.case('en el hallazgo: «Reconocer con IA» abre la cámara, guarda la foto, muestra porcentajes y elige la especie', async () => {
      const png = { name: 'c.png', mimeType: 'image/png', buffer: Buffer.from(PNG1, 'base64') };
      modo = 'ok'; llamadas = []; await t.page.evaluate(k => window.__MI.ia.setKey(k), KEY);
      await t.page.evaluate(() => { document.querySelector('#sheet').hidden = true; }); await t.go('#mapa'); await t.fixGPS(); await t.tap('#fab', 500);
      t.ok('hay botón de IA en el hallazgo', await t.has('#mk-ia'));
      const [fc] = await Promise.all([t.page.waitForEvent('filechooser'), t.page.evaluate(() => document.querySelector('#mk-ia').click())]);
      t.eq('abre la cámara trasera directamente', await t.page.evaluate(() => document.querySelector('#file-ia').getAttribute('capture')), 'environment');
      await fc.setFiles(png);
      await t.page.waitForSelector('#mk-iares .ia-row', { timeout: 8000 });
      t.eq('una llamada con 1 foto', llamadas.map(l => l.n), [1]);
      t.ok('la foto queda en el hallazgo', (await t.N('#mk-th img')) === 1);
      t.ok('porcentaje del más probable', /80\s*%/.test(await t.T('#mk-iares .ia-row') || ''));
      await t.page.evaluate(() => document.querySelector('#mk-iares').scrollIntoView({ block: 'center', behavior: 'instant' })); await t.wait(600); await t.shot('captura-ia-hallazgo');
      await t.tap('#mk-iares .ia-row[data-iae]', 300);
      t.ok('elige la especie del catálogo', (await t.page.evaluate(() => document.querySelector('#sp-q').value)).length > 3);
      await t.tap('#mk-ok', 500);
      const hh = (await t.docs('hallazgos')).find(x => (x.fotos || []).length && x.especieId);
      t.ok('hallazgo guardado con foto y especie provisional', !!hh && hh.fotos.length === 1 && hh.identificacion === 'provisional');
      await t.fixGPS(); await t.tap('#fab', 500); modo = '500'; llamadas = [];
      const [f2] = await Promise.all([t.page.waitForEvent('filechooser'), t.page.evaluate(() => document.querySelector('#mk-ia').click())]); await f2.setFiles(png);
      await t.page.waitForSelector('#mk-iares .warn', { timeout: 10000 });
      t.ok('si falla: mensaje y «Reintentar», la foto se conserva', await t.has('#mk-iar') && (await t.N('#mk-th img')) === 1);
      modo = 'ok'; await t.tap('#mk-iar', 1500); t.ok('reintentar funciona', await t.has('#mk-iares .ia-row'));
      await t.tap('#mk-x', 300);
    });
    await t.case('ajustes: guardar y borrar la clave', async () => {
      await t.page.evaluate(() => document.querySelector('#sheet').hidden = true);
      await t.go('#ajustes'); await t.page.fill('#a-gk', KEY); await t.page.evaluate(() => document.activeElement.blur()); await t.tap('#a-gks', 500);
      t.eq('guardada', await t.page.evaluate(() => window.__MI.ia.getKey()), KEY);
      await t.tap('#a-gkd', 400); t.eq('borrada', await t.page.evaluate(() => window.__MI.ia.getKey()), '');
    });
  }
};
