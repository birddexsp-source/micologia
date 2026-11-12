#!/usr/bin/env node
/* Capturas de diseño con datos SINTÉTICOS (no son sitios reales), teselas y fotos falsas de teselas.py.
   node tests/tools/capturas.js [carpeta] [escena…]   → PNG a 390×844 @2x */
const path = require('path'), fs = require('fs'), { spawn } = require('child_process');
const { serve, GEO } = require('../lib/harness');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')); }
const OUTD = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out', 'capturas'));
const SOLO = process.argv.slice(3);
const PORT = 8765, TS = 'http://127.0.0.1:' + PORT;
const http = require('http'), CACHE = {};
function get(u, n = 4) { if (CACHE[u]) return Promise.resolve(CACHE[u]); return new Promise((ok, ko) => http.get(u, r => { const b = []; r.on('data', c => b.push(c)); r.on('end', () => ok(CACHE[u] = Buffer.concat(b))); }).on('error', e => n ? setTimeout(() => get(u, n - 1).then(ok, ko), 300) : ko(e))); }
const day = (s, h = 16, m = 0) => { const d = new Date(s + 'T00:00:00'); d.setHours(h, m); return d.getTime(); };

const ZONAS = {
  z1: { nombre: 'Boletus 1', lat: 43.1012, lon: -2.8031, estado: 'visitada', notas: 'Hayedo con robles al borde de la pista. Mejor por la ladera norte.' },
  z2: { nombre: 'Boletus 2', lat: 43.0985, lon: -2.7972, estado: 'visitada', notas: '' },
  z3: { nombre: 'Boletus 3', lat: 43.1041, lon: -2.7948, estado: 'visitada', notas: 'Pinar con helechos.' },
  z4: { nombre: 'Boletus 4', lat: 43.0962, lon: -2.8058, estado: 'visitada', notas: '' },
  z5: { nombre: 'Pinar de arriba', lat: 43.1078, lon: -2.8012, estado: 'por_visitar', notas: 'Me dijeron que salen níscalos.' }
};
const SALIDAS = {
  s1: { fecha: '2025-10-18', titulo: 'Primera vuelta', zonaIds: ['z1', 'z2'], estado: 'terminada', creada: day('2025-10-18', 10), fin: day('2025-10-18', 13, 20), totalTxt: '≈1 kg', fotos: [], fotosCosecha: [], track: [], notas: '' },
  s2: { fecha: '2026-11-11', titulo: 'Boletus · 4 spots', zonaIds: ['z1', 'z2', 'z3', 'z4'], estado: 'terminada', creada: day('2026-11-11', 15, 30), fin: day('2026-11-11', 18), totalTxt: '≈2,5 kg', fotos: [], fotosCosecha: [], track: [], notas: '' }
};
const H = [
  ['z1', 's2', 'boletus-edulis', '2026-11-11', 15, 50, '3', 'provisional'], ['z1', 's2', 'boletus-edulis', '2026-11-11', 16, 2, '2', 'provisional'],
  ['z1', 's2', 'amanita-rubescens', '2026-11-11', 16, 5, '', 'provisional'], ['z1', 's1', 'boletus-edulis', '2025-10-18', 10, 40, '1', 'confirmada'],
  ['z1', 's1', 'cantharellus-cibarius', '2025-10-18', 11, 5, '≈200 g', 'confirmada'], ['z2', 's2', 'cantharellus-cibarius', '2026-11-11', 16, 30, '≈300 g', 'provisional'],
  ['z2', 's2', 'hydnum-repandum', '2026-11-11', 16, 41, '6', 'provisional'], ['z2', 's2', 'amanita-pantherina-muscaria', '2026-11-11', 16, 44, '', 'provisional'],
  ['z3', 's2', 'lactarius-deliciosus', '2026-11-11', 17, 10, '8', 'provisional'], ['z3', 's2', 'suillus-luteus', '2026-11-11', 17, 15, '', 'provisional'],
  ['z3', 's2', null, '2026-11-11', 17, 20, '', 'sin_identificar'], ['z4', 's2', 'craterellus-cornucopioides', '2026-11-11', 17, 42, '≈150 g', 'provisional']
];
const ESCENAS = {
  'mapa': async p => { await p.evaluate(() => window.__MI.S.map.setView([43.1015, -2.8000], 15, { animate: false })); await p.waitForTimeout(900); },
  'mapa-cerca': async p => { await p.evaluate(() => window.__MI.S.map.setView([43.1005, -2.8010], 17, { animate: false })); await p.waitForTimeout(900); },
  'spot': async p => { await p.evaluate(() => window.__MI.S.map.setView([43.1015, -2.8000], 15, { animate: false })); await p.waitForTimeout(400); await p.evaluate(() => window.__MI.abrirSpot('z1')); await p.waitForTimeout(1200); },
  'spot-por-ir': async p => { await p.evaluate(() => window.__MI.S.map.setView([43.1015, -2.8000], 15, { animate: false })); await p.waitForTimeout(400); await p.evaluate(() => window.__MI.abrirSpot('z5')); await p.waitForTimeout(1200); },
  'hallazgo': async p => { await p.evaluate(() => window.__MI.S.map.setView([43.1012, -2.8031], 17, { animate: false })); await p.waitForTimeout(400); await p.evaluate(() => window.__MI.verHallazgo('h0')); await p.waitForTimeout(1000); },
  'marcar': async p => { await p.evaluate(() => window.__MI.S.map.setView([43.1, -2.8], 16, { animate: false })); await p.click('#fab'); await p.waitForTimeout(1300); },
  'marcar-spot': async p => { await p.evaluate(() => window.__MI.S.map.setView([43.1012, -2.8031], 16, { animate: false })); await p.evaluate(() => window.__MI.verSpot('z1')); await p.waitForTimeout(600); await p.click('#st-marcar'); await p.waitForTimeout(1200); },
  'capas': async p => { await p.click('#layerbtn'); await p.waitForTimeout(800); },
  'salidas': async p => { await p.evaluate(() => { location.hash = '#salidas'; }); await p.waitForTimeout(1000); },
  'salida': async p => { await p.evaluate(() => { location.hash = '#salida/s2'; }); await p.waitForTimeout(1400); },
  'salida-curso': async p => { await p.evaluate(async () => { await window.__MI.db.patch('salidas', 's2', { estado: 'en_curso', fin: null, creada: Date.now() - 4800000 }); location.hash = '#salida/s2'; }); await p.waitForTimeout(1400); },
  'salida-fotos': async p => { await p.evaluate(() => { location.hash = '#salida/s2'; }); await p.waitForTimeout(1200); await p.click('.tabs [data-tb="hall"]'); await p.waitForTimeout(500); },
  'salida-nueva': async p => { await p.evaluate(async () => { await window.__MI.db.set('salidas', 's9', { fecha: '2026-11-12', titulo: '', zonaIds: [], estado: 'en_curso', creada: Date.now() - 600000, fin: null, grabar: false, fotos: [], fotosCosecha: [], track: [], totalTxt: '', notas: '' }); location.hash = '#salida/s9'; }); await p.waitForTimeout(1400); },
  'salida-abajo': async p => { await p.evaluate(() => { location.hash = '#salida/s2'; }); await p.waitForTimeout(1400); await p.evaluate(() => { const v = document.querySelector('#v-salida'); v.scrollTop = 560; }); await p.waitForTimeout(400); },
  'salida-fin': async p => { await p.evaluate(() => { location.hash = '#salida/s2'; }); await p.waitForTimeout(1400); await p.evaluate(() => { const v = document.querySelector('#v-salida'); v.scrollTop = 1250; }); await p.waitForTimeout(400); },
  'setas': async p => { await p.evaluate(() => { location.hash = '#setas'; }); await p.waitForTimeout(1000); },
  'ficha': async p => { await p.evaluate(() => { location.hash = '#setas'; }); await p.waitForTimeout(500); await p.evaluate(() => window.__MI.abrirFicha('boletus-edulis')); await p.waitForTimeout(1000); },
  'setas-abajo': async p => { await p.evaluate(() => { location.hash = '#setas'; }); await p.waitForTimeout(1000); await p.evaluate(() => { document.querySelector('#v-setas').scrollTop = 900; }); await p.waitForTimeout(600); },
  'mes': async p => { await p.evaluate(() => { location.hash = '#mes'; }); await p.waitForTimeout(1000); },
  'ajustes': async p => { await p.evaluate(() => { location.hash = '#ajustes'; }); await p.waitForTimeout(800); }
};
(async () => {
  fs.mkdirSync(OUTD, { recursive: true });
  const ts = spawn('python3', [path.join(__dirname, 'teselas.py'), String(PORT)], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1500));
  const { srv, url } = await serve();
  const br = await chromium.launch();
  const lista = Object.keys(ESCENAS).filter(k => !SOLO.length || SOLO.includes(k));
  for (const k of lista) {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, geolocation: { ...GEO, latitude: 43.0998, longitude: -2.8002 }, permissions: ['geolocation'], locale: 'es-ES', timezoneId: 'Europe/Madrid', serviceWorkers: 'block' });
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('  ! ' + k + ': ' + String(e).slice(0, 200)));
    await p.route(/ign\.es/, async r => { const u = new URL(r.request().url()), q = u.searchParams; const b = await get(TS + '/sat/' + q.get('TILEMATRIX') + '/' + q.get('TILECOL') + '/' + q.get('TILEROW') + '.png'); r.fulfill({ status: 200, contentType: 'image/png', body: b, headers: { 'access-control-allow-origin': '*' } }); });
    await p.route(/tile\.openstreetmap\.org/, async r => { const m = r.request().url().match(/(\d+)\/(\d+)\/(\d+)\.png/); const b = await get(TS + '/calle/' + m[1] + '/' + m[2] + '/' + m[3] + '.png'); r.fulfill({ status: 200, contentType: 'image/png', body: b, headers: { 'access-control-allow-origin': '*' } }); });
    await p.route(/upload\.wikimedia\.org/, async r => { let h = 0; for (const c of r.request().url().replace(/\/\d+px-/, '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; const b = await get(TS + '/foto/' + (h % 12) + '.jpg'); r.fulfill({ status: 200, contentType: 'image/jpeg', body: b, headers: { 'access-control-allow-origin': '*' } }); });
    await p.goto(url + '#mapa'); await p.waitForSelector('body[data-ready="1"]');
    await p.evaluate(async ([Z, SA, HH]) => {
      const db = window.__MI.db;
      for (const [id, z] of Object.entries(Z)) await db.set('zonas', id, { ...z, fotos: [], audios: [], transcripciones: {}, creada: Date.now() });
      for (const [id, s] of Object.entries(SA)) await db.set('salidas', id, s);
      for (let i = 0; i < HH.length; i++) { const [z, s, e, f, hh, mm, c, idn] = HH[i], zz = Z[z], d = new Date(f + 'T00:00:00'); d.setHours(hh, mm);
        await db.set('hallazgos', 'h' + i, { salidaId: s, zonaId: z, lat: zz.lat + (i % 3 - 1) * 0.0004, lon: zz.lon + (i % 2 ? .0005 : -.0003), precisionM: 6, ts: d.getTime(), especieId: e, especieTxt: e ? '' : 'Seta marrón pequeña', cantidad: c, estadoSeta: '', sustrato: '', notas: '', fotos: [], identificacion: idn, confirmadoPor: idn === 'confirmada' ? 'Aranzadi' : '', recogida: !!c, audios: [], transcripciones: {} }); }
    }, [ZONAS, SALIDAS, H]);
    await p.waitForTimeout(600);
    await ESCENAS[k](p);
    await p.waitForFunction(() => [...document.querySelectorAll('img.leaflet-tile')].every(i => i.complete), null, { timeout: 15000 }).catch(() => { }); await p.waitForTimeout(300);
    await p.evaluate(() => { const t = document.querySelector('#toast'); if (t) t.classList.remove('show'); });
    await p.screenshot({ path: path.join(OUTD, k + '.png') });
    console.log('✓ ' + k); await ctx.close();
  }
  await br.close(); srv.close(); ts.kill();
})();
