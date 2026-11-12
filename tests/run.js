#!/usr/bin/env node
/* Ejecuta las pruebas de Micología.
     node tests/run.js              → todas
     node tests/run.js sync mapa    → solo las suites cuyo nombre/archivo contenga esas palabras
     node tests/run.js --list       → lista las suites
     node tests/run.js --verbose    → muestra también cada comprobación que pasa
   Sale con código 1 si algo falla. Capturas en tests/out/ (se borra en cada ejecución). */
const fs = require('fs'), path = require('path');
const { T, serve, OUT } = require('./lib/harness');
const args = process.argv.slice(2), verbose = args.includes('--verbose'), list = args.includes('--list');
const filt = args.filter(a => !a.startsWith('--'));
const dir = path.join(__dirname, 'suites');
let suites = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort().map(f => Object.assign({ file: f }, require(path.join(dir, f))));
if (filt.length) suites = suites.filter(s => filt.some(w => (s.file + ' ' + s.name).toLowerCase().includes(w.toLowerCase())));
if (list) { suites.forEach(s => console.log(s.file.padEnd(28), s.name)); process.exit(0); }
(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const { srv, url } = await serve();
  const t = new T({ url, verbose }); const t0 = Date.now(), rows = [];
  for (const s of suites) {
    console.log('\n▶ ' + s.name + '  (' + s.file + ')');
    t.suite = s.name; const p0 = t.pass, f0 = t.fail, s0 = Date.now();
    try { if (!s.static) await t.launch(s.launch || {}); await s.run(t); }
    catch (e) { t.ok('la suite terminó sin romperse', false, String(e.stack || e).split('\n').slice(0, 2).join(' / ')); }
    await t.close(); t.page = null;
    rows.push([s.name, t.pass - p0, t.fail - f0, ((Date.now() - s0) / 1000).toFixed(1) + ' s']);
  }
  srv.close();
  console.log('\n══════════ RESUMEN ══════════');
  rows.forEach(r => console.log((r[2] ? '✗' : '✓') + ' ' + r[0].padEnd(36) + String(r[1]).padStart(4) + ' ok ' + String(r[2]).padStart(3) + ' fallos  ' + r[3]));
  console.log('\nTotal: ' + t.pass + ' correctas, ' + t.fail + ' fallos, ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  if (t.fail) { console.log('\nFALLOS:'); t.fails.forEach(f => console.log(' - ' + f)); }
  fs.writeFileSync(path.join(OUT, 'informe.json'), JSON.stringify({ fecha: new Date().toISOString(), correctas: t.pass, fallos: t.fail, detalle: t.fails, suites: rows }, null, 1));
  process.exit(t.fail ? 1 : 0);
})();
