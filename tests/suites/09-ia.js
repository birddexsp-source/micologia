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
      const bad = walk(DOCS).filter(f => !/\.(png|jpg|webp)$/.test(f)).filter(f => /AIza[\w-]{30,}/.test(fs.readFileSync(f, 'utf8')));
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
      t.ok('forma de la clave', await t.page.evaluate(([k]) => window.__MI.ia.claveValida(k) && !window.__MI.ia.claveValida('hola'), [KEY]));
    });
    let llamadas = [], modo = 'ok', ids = [];
    await t.page.route('https://generativelanguage.googleapis.com/**', async r => {
      const rq = r.request(); llamadas.push({ key: rq.headers()['x-goog-api-key'], n: (rq.postDataJSON().contents[0].parts.length - 1) });
      const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
      if (rq.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
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
      t.ok('ya enseña las 3 ranuras', (await t.N('.ia-slot')) === 3);
      t.eq('clave en localStorage', await t.page.evaluate(() => window.__MI.ia.getKey()), KEY);
      t.eq('«Reconocer» apagado sin fotos', await t.page.evaluate(() => document.querySelector('#ia-go').disabled), true);
    });
    await t.case('reconocer con 2 fotos: candidata de la colección + una fuera + aviso de peligro', async () => {
      const png = { name: 'a.png', mimeType: 'image/png', buffer: Buffer.from(PNG1, 'base64') };
      await t.page.setInputFiles('.ia-slot[data-i="0"] input', png); await t.wait(200);
      await t.page.setInputFiles('.ia-slot[data-i="2"] input', png); await t.wait(200);
      await t.tap('#ia-go', 1500);
      t.eq('una llamada con 2 imágenes y la clave en cabecera', llamadas.map(l => [l.key, l.n]), [[KEY, 2]]);
      t.eq('1 candidata de tu colección (abre su ficha)', await t.N('#sheet button.item[data-e]'), 1);
      t.ok('la otra sale «no está en tu colección»', /Amanita nueva[\s\S]*no está en tu colección/i.test(await t.T('#sheet') || ''));
      t.ok('aviso de tóxica entre candidatas', /tóxica o mortal/.test(await t.T('#sheet') || ''));
      t.ok('recuerda que es solo una pista', /Es una pista, no una identificación/.test(await t.T('#sheet') || ''));
      t.ok('nunca dice «comestible» como veredicto', !/es comestible|se puede comer/i.test(await t.T('#sheet .ia-res') || ''));
      await t.shot('captura-ia-resultado');
      await t.tap('#sheet button.item[data-e]', 300); t.ok('abre la ficha', await t.has('#hero, .ficha'));
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
    await t.case('ajustes: guardar y borrar la clave', async () => {
      await t.page.evaluate(() => document.querySelector('#sheet').hidden = true);
      await t.go('#ajustes'); await t.page.fill('#a-gk', KEY); await t.page.evaluate(() => document.activeElement.blur()); await t.tap('#a-gks', 500);
      t.eq('guardada', await t.page.evaluate(() => window.__MI.ia.getKey()), KEY);
      await t.tap('#a-gkd', 400); t.eq('borrada', await t.page.evaluate(() => window.__MI.ia.getKey()), '');
    });
  }
};
