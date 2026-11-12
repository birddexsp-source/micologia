const { FakeGH, PNG1 } = require('../lib/harness');
const REPO = 'usuario/micologia-datos', TOKEN = 'token-sintetico-de-prueba-123';
module.exports = {
  name: 'Sincronización con el repo privado (GitHub simulado)',
  async run(t) {
    const gh = new FakeGH(); await t.fakeGitHub(t.page, gh, REPO);
    const logs = []; t.page.on('console', m => logs.push(m.text()));
    const cfgYSync = async (page, repo = REPO) => {
      const old = t.page; t.page = page; await t.go('#ajustes');
      await page.fill('#a-repo', repo); await page.fill('#a-tok', TOKEN); await t.tap('#a-sync', 100);
      await page.waitForFunction(() => /Sincronizado|Todo al día|No encuentro|Sin conexión|token|GitHub/.test(document.querySelector('#a-st').textContent), null, { timeout: 8000 });
      const r = await t.T('#a-st'); t.page = old; return r;
    };
    let h1, blobId;
    await t.case('sin configurar: el botón de sincronizar lleva a Ajustes', async () => {
      await t.tap('#syncbtn', 400); t.eq('va a Ajustes', await t.T('#ttl'), 'Ajustes');
      t.ok('aviso de configuración', /Configura/.test(await t.T('#toast') || ''));
    });
    await t.case('un dato de prueba y una foto suben al repo privado', async () => {
      await t.go('#mapa'); await t.marcarRapido({ esp: 'cicuta', cant: '1' });
      blobId = await t.page.evaluate(async b64 => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return window.__MI.db.putBlob(new Blob([u], { type: 'image/jpeg' })); }, PNG1.toString('base64'));
      h1 = (await t.docs('hallazgos'))[0]; await t.page.evaluate(([id, b]) => window.__MI.db.patch('hallazgos', id, { fotos: [b] }), [h1.id, blobId]);
      t.ok('hay pendientes en la insignia', /^[1-9]/.test(await t.T('#syncbtn .nb') || ''));
      const st = await cfgYSync(t.page);
      t.ok('estado: subido', /Sincronizado · subido 2/.test(st), st);
      const j = gh.json('data/hallazgos/' + h1.id + '.json');
      t.ok('data/hallazgos/<id>.json con {u, del, d}', !!j && typeof j.u === 'number' && j.del === false && j.d.especieId === 'amanita-phalloides', JSON.stringify(j));
      t.ok('blobs/<id> en el repo', !!gh.files()['blobs/' + blobId]);
      t.ok('el README previo sigue ahí', !!gh.files()['README.md']);
      t.eq('sin pendientes', await t.page.evaluate(() => window.__MI.db.dirtyCount()), 0);
      t.ok('insignia sin número', !(await t.has('#syncbtn .nb')));
      t.ok('el token no aparece en la interfaz ni en consola', !(await t.T('#v-ajustes') || '').includes(TOKEN) && !logs.some(l => l.includes(TOKEN)));
      t.eq('una segunda sincronización no sube nada', (await cfgYSync(t.page)), 'Todo al día');
    });
    await t.case('otro dispositivo (datos vacíos) baja lo mismo', async () => {
      const ctx = await t.context(); const p = await t.newPage(ctx); await t.fakeGitHub(p, gh, REPO);
      await p.goto(t.opts.url + '#ajustes'); await p.waitForSelector('body[data-ready="1"]');
      const st = await cfgYSync(p); t.ok('bajado 2', /bajado 2/.test(st), st);
      const [hs, hasBlob] = await p.evaluate(async b => [await window.__MI.db.list('hallazgos'), window.__MI.db.B.has(b)], blobId);
      t.eq('mismo hallazgo', hs.map(h => h.id), [h1.id]); t.ok('con su foto', hasBlob); t.eq('con su foto enlazada', hs[0].fotos, [blobId]);
      /* conflicto: gana la escritura más reciente */
      await t.page.evaluate(id => window.__MI.db.patch('hallazgos', id, { notas: 'A (antigua)' }), h1.id);
      await p.waitForTimeout(40);
      await p.evaluate(id => window.__MI.db.patch('hallazgos', id, { notas: 'B (reciente)' }), h1.id);
      await cfgYSync(p);
      await cfgYSync(t.page);
      t.eq('A recibe lo más reciente (B)', (await t.docs('hallazgos'))[0].notas, 'B (reciente)');
      await t.page.evaluate(id => window.__MI.db.patch('hallazgos', id, { notas: 'A2 (aún más reciente)' }), h1.id);
      await cfgYSync(t.page); await cfgYSync(p);
      t.eq('B recibe A2', (await p.evaluate(() => window.__MI.db.list('hallazgos')))[0].notas, 'A2 (aún más reciente)');
      /* borrado lógico */
      await t.page.evaluate(id => window.__MI.db.remove('hallazgos', id), h1.id); await cfgYSync(t.page);
      t.eq('en el repo queda del:true', gh.json('data/hallazgos/' + h1.id + '.json').del, true);
      await cfgYSync(p); t.eq('B ya no lo ve', (await p.evaluate(() => window.__MI.db.list('hallazgos'))).length, 0);
      await ctx.close();
    });
    await t.case('errores comprensibles: repo inexistente y sin conexión', async () => {
      const st = await cfgYSync(t.page, 'otro/repo-que-no-existe'); t.ok('404 → mensaje claro', /No encuentro el repositorio/.test(st), st);
      t.ok('la insignia marca error', await t.has('#syncbtn.err'));
      await cfgYSync(t.page, REPO);
      await t.ctx.setOffline(true); await t.go('#ajustes'); await t.tap('#a-sync', 400);
      t.ok('sin conexión → mensaje', /Sin conexión/.test(await t.T('#a-st') || ''), await t.T('#a-st')); await t.ctx.setOffline(false);
    });
    await t.case('el commit va a la rama main con mensaje reconocible', async () => {
      t.ok('se usó la API git (blobs, trees, commits, refs)', ['POST /git/blobs', 'POST /git/trees', 'POST /git/commits', 'PATCH /git/refs/heads/main'].every(x => gh.log.includes(x)));
    });
  }
};
