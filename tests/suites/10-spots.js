/* Spots (visitados / por visitar) y notas de voz con transcripción (Gemini simulado, micrófono simulado). */
const { FakeGH } = require('../lib/harness');
const REPO = 'usuario/micologia-datos', TOKEN = 'token-sintetico-de-prueba-123';
const AUDIO = [0x1A, 0x45, 0xDF, 0xA3, 1, 2, 3, 4, 5, 6, 7, 8];   // cabecera WebM
module.exports = {
  name: 'Spots y notas de voz',
  launch: { viewport: { width: 390, height: 844 }, permissions: ['geolocation', 'microphone'] },
  async run(t) {
    const gh = new FakeGH(); await t.fakeGitHub(t.page, gh, REPO);
    /* micrófono y grabadora de mentira: devuelve unos bytes WebM */
    await t.page.addInitScript(a => {
      navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() { } }] });
      window.MediaRecorder = class { constructor() { this.mimeType = 'audio/webm'; } static isTypeSupported() { return true; }
        start() { setTimeout(() => this.ondataavailable && this.ondataavailable({ data: new Blob([new Uint8Array(a)], { type: 'audio/webm' }) }), 20); }
        stop() { setTimeout(() => this.onstop && this.onstop(), 30); } };
    }, AUDIO);
    let transLlamadas = 0;
    await t.page.route('https://generativelanguage.googleapis.com/**', async r => {
      const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
      const p = r.request().postDataJSON().contents[0].parts; transLlamadas++;
      r.fulfill({ status: 200, contentType: 'application/json', headers: h, body: JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Hayedo con muchos rebozuelos bajo las hayas, saqué tres.' }] } }] }), });
    });
    await t.page.evaluate(() => localStorage.setItem('mi_gemini_key', 'AIza' + 'x'.repeat(35)));
    await t.reload(); await t.fixGPS();
    let spotId;
    await t.case('nuevo spot «Quiero ir»: sale en el mapa y en la lista', async () => {
      await t.go('#mapa'); await t.tap('#spotbtn', 400);
      t.ok('hoja de nuevo spot', /Nuevo spot/.test(await t.T('#sheet') || ''));
      await t.tap('#st-ok', 200); t.ok('exige nombre', /nombre al spot/i.test(await t.T('#toast') || ''));
      await t.page.fill('#st-nom', 'Hayedo de prueba'); await t.tap('#st-est button[data-s="por_visitar"]');
      await t.page.fill('#st-nota', 'Se llega por la pista'); await t.tap('#st-ok', 500);
      const z = (await t.docs('zonas')); t.eq('1 spot', z.length, 1); spotId = z[0].id;
      t.eq('estado por visitar', z[0].estado, 'por_visitar'); t.ok('con coordenadas', typeof z[0].lat === 'number');
      t.eq('marcador en el mapa', await t.page.evaluate(() => window.__MI.S.spotsL.getLayers().length), 1);
      await t.go('#salidas'); t.ok('en «Quiero ir»', /Quiero ir[\s\S]*Hayedo de prueba/i.test(await t.T('#v-salidas') || ''));
      await t.shot('captura-10-spots');
    });
    await t.case('marcar un hallazgo desde el spot: zona elegida, nota de voz y transcripción', async () => {
      await t.tap('[data-spot="' + spotId + '"]', 600);
      t.ok('abre el spot', /Hayedo de prueba/.test(await t.T('#sheet') || '')); t.ok('enlace Cómo llegar', await t.has('#sheet a[href*="maps/dir"]'));
      await t.tap('#st-marcar', 600);
      t.ok('hallazgo con la zona del spot ya elegida', await t.has('#mk-zonas button.on'));
      t.ok('muestra la hora', /\d\d:\d\d ·/.test(await t.T('#mk-pos') || ''));
      await t.page.fill('#sp-q', 'rebozuelo'); await t.wait(120); await t.tap('#sp-sugs button');
      await t.tap('#au-rec', 200); t.ok('botón en grabación', /Parar/.test(await t.T('#au-rec') || '')); await t.tap('#au-rec', 900);
      t.eq('un audio guardado', await t.N('#au-list audio'), 1);
      t.ok('transcripción en su caja', /rebozuelos bajo las hayas/.test(await t.page.inputValue('#au-list textarea')));
      t.ok('la nota se rellena sola', /rebozuelos/.test(await t.page.inputValue('#mk-nota')));
      t.eq('una llamada a Gemini', transLlamadas, 1);
      await t.shot('captura-10-voz');
      await t.tap('#mk-ok', 500);
      const h = (await t.docs('hallazgos'))[0], z = (await t.docs('zonas'))[0];
      t.eq('hallazgo en el spot', h.zonaId, spotId); t.eq('1 audio', h.audios.length, 1);
      t.ok('transcripción guardada', /rebozuelos/.test(h.transcripciones[h.audios[0]]));
      t.eq('el spot pasa a «visitada»', z.estado, 'visitada');
    });
    await t.case('sin conexión a Gemini: el audio queda guardado', async () => {
      await t.page.route('https://generativelanguage.googleapis.com/**', r => r.abort());
      await t.go('#mapa'); await t.tap('#fab', 400); await t.tap('#au-rec', 200); await t.tap('#au-rec', 900);
      t.eq('audio guardado', await t.N('#au-list audio'), 1); t.eq('sin transcripción', await t.page.inputValue('#au-list textarea'), '');
      t.ok('botón para transcribir luego', /Transcribir/.test(await t.T('#au-list [data-at]') || ''));
      await t.tap('#mk-x');
    });
    await t.case('el audio sube al repo privado con el resto', async () => {
      const id = (await t.docs('hallazgos'))[0].audios[0];
      await t.go('#ajustes'); await t.page.fill('#a-repo', REPO); await t.page.fill('#a-tok', TOKEN); await t.tap('#a-sync', 100);
      await t.page.waitForFunction(() => /Sincronizado|Todo al día|No encuentro/.test(document.querySelector('#a-st').textContent), null, { timeout: 8000 });
      t.ok('blob de audio en el repo', Object.keys(gh.files()).includes('blobs/' + id));
      t.ok('spot en el repo', Object.keys(gh.files()).some(p => p.startsWith('data/zonas/')));
    });
    await t.case('spots: móvil pequeño sin desbordes', async () => {
      await t.page.setViewportSize({ width: 360, height: 640 });
      await t.page.evaluate(id => window.__MI.abrirSpot(id), spotId); await t.wait(500);
      t.ok('hoja sin desborde horizontal', await t.page.evaluate(() => { const s = document.querySelector('#sheet .sh'); return s.scrollWidth <= s.clientWidth + 1; }));
    });
  }
};
