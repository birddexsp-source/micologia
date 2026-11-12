/* Arnés de pruebas de Micología. Sirve docs/ en local, abre un Chromium móvil con datos vacíos por suite,
   simula las teselas y GitHub (API git en memoria). TODO con datos sintéticos: nunca coordenadas reales. */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')); }

const ROOT = path.resolve(__dirname, '..', '..');
const APP = path.join(ROOT, 'docs');
const OUT = path.join(ROOT, 'tests', 'out');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
/* Punto sintético (no es ningún sitio real de setas) */
const GEO = { latitude: 43.1, longitude: -2.8, accuracy: 8 };
const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqKn5DwAFgwK/lXZ0dQAAAABJRU5ErkJggg==', 'base64');

function serve() {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      let p = path.join(APP, decodeURIComponent(q.url.split('?')[0]));
      if (p.endsWith(path.sep) || p === APP) p = path.join(p, 'index.html');
      fs.readFile(p, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(b); });
    }).listen(0, () => res({ srv, url: 'http://localhost:' + srv.address().port + '/' }));
  });
}

/* GitHub simulado: lo justo de la API git que usa sync.js */
class FakeGH {
  constructor() {
    this.blobs = {}; this.trees = {}; this.commits = {}; this.refs = {}; this.log = [];
    const readme = this.addBlob(Buffer.from('# datos').toString('base64'));
    const tree = this.addTree([{ path: 'README.md', mode: '100644', type: 'blob', sha: readme }]);
    const c = this.addCommit(tree, []); this.refs['main'] = c;
  }
  sha(x) { return crypto.createHash('sha1').update(String(x) + Math.random()).digest('hex'); }
  addBlob(b64) { const s = this.sha(b64); this.blobs[s] = b64; return s; }
  addTree(entries) { const s = this.sha('t'); this.trees[s] = entries; return s; }
  addCommit(tree, parents) { const s = this.sha('c'); this.commits[s] = { sha: s, tree: { sha: tree }, parents }; return s; }
  files() { const out = {}; (this.trees[this.commits[this.refs.main].tree.sha] || []).forEach(e => { out[e.path] = this.blobs[e.sha]; }); return out; }
  json(p) { const f = this.files()[p]; return f ? JSON.parse(Buffer.from(f, 'base64').toString('utf8')) : null; }
  handle(method, url, body, repo) {
    const m = url.pathname.match(new RegExp('^/repos/' + repo + '(/.*)$')); if (!m) return [404, { message: 'Not Found' }];
    const p = m[1]; this.log.push(method + ' ' + p);
    let x;
    if (method === 'GET' && (x = p.match(/^\/git\/ref\/heads\/(.+)$/))) return this.refs[x[1]] ? [200, { object: { sha: this.refs[x[1]] } }] : [404, {}];
    if (method === 'GET' && (x = p.match(/^\/git\/commits\/(.+)$/))) return this.commits[x[1]] ? [200, this.commits[x[1]]] : [404, {}];
    if (method === 'GET' && (x = p.match(/^\/git\/trees\/(.+)$/))) return this.trees[x[1]] ? [200, { sha: x[1], truncated: false, tree: this.trees[x[1]] }] : [404, {}];
    if (method === 'GET' && (x = p.match(/^\/git\/blobs\/(.+)$/))) return this.blobs[x[1]] ? [200, { content: this.blobs[x[1]], encoding: 'base64' }] : [404, {}];
    if (method === 'POST' && p === '/git/blobs') return [201, { sha: this.addBlob(body.content) }];
    if (method === 'POST' && p === '/git/trees') {
      const base = this.trees[body.base_tree] || [], map = {}; base.forEach(e => { map[e.path] = e; }); body.tree.forEach(e => { map[e.path] = e; });
      return [201, { sha: this.addTree(Object.values(map)) }];
    }
    if (method === 'POST' && p === '/git/commits') return [201, { sha: this.addCommit(body.tree, body.parents) }];
    if (method === 'PATCH' && (x = p.match(/^\/git\/refs\/heads\/(.+)$/))) { this.refs[x[1]] = body.sha; return [200, {}]; }
    return [404, { message: 'no simulado: ' + method + ' ' + p }];
  }
}

class T {
  constructor(opts) { this.opts = opts; this.pass = 0; this.fail = 0; this.fails = []; this.errs = []; this.suite = ''; this.n = 0; this.tileReqs = []; this.photoReqs = []; }
  ok(name, cond, detail) {
    if (cond) { this.pass++; if (this.opts.verbose) console.log('   ✓ ' + name); }
    else { this.fail++; this.fails.push(this.suite + ' › ' + name + (detail ? ' (' + detail + ')' : '')); console.log('   ✗ ' + name + (detail ? '  → ' + detail : '')); }
    return !!cond;
  }
  eq(name, a, b) { return this.ok(name, JSON.stringify(a) === JSON.stringify(b), 'esperado ' + JSON.stringify(b) + ', obtenido ' + JSON.stringify(a)); }
  async case(name, fn) {
    console.log('  · ' + name); const before = this.fail;
    try { await fn(); } catch (e) { this.ok(name + ' (no debería lanzar)', false, String(e.message || e).split('\n')[0]); }
    if (this.fail > before && this.page) await this.shot('fallo-' + this.suite.replace(/\W+/g, '_') + '-' + (++this.n));
    if (this.errs.length) { const e = this.errs.splice(0); this.ok('sin errores de JS en «' + name + '»', false, e[0].slice(0, 1500)); }
  }
  /* ---------- navegador ---------- */
  async newPage(ctx) {
    const page = await ctx.newPage();
    page.on('pageerror', e => this.errs.push(String(e.stack || e).split('\n').slice(0, 14).join(' / ')));
    page.on('console', m => { if (m.type() === 'error' && !/tile|404|Failed to load resource|net::ERR/.test(m.text())) this.errs.push('console: ' + m.text()); });
    /* teselas simuladas (ign.es está bloqueado en este entorno y no queremos red real en pruebas) */
    await page.route(/ign\.es|tile\.openstreetmap\.org/, r => { this.tileReqs.push(r.request().url()); r.fulfill({ status: 200, contentType: 'image/png', body: PNG1, headers: { 'access-control-allow-origin': '*' } }); });
    /* fotos del catálogo (Wikimedia Commons): también simuladas */
    await page.route(/upload\.wikimedia\.org/, r => { this.photoReqs.push(r.request().url()); r.fulfill({ status: 200, contentType: 'image/png', body: PNG1, headers: { 'access-control-allow-origin': '*' } }); });
    return page;
  }
  async context(o = {}) {
    return this.browser.newContext({ viewport: o.viewport || { width: 390, height: 844 }, deviceScaleFactor: 1, acceptDownloads: true, geolocation: o.geo || GEO, permissions: o.permissions || ['geolocation'], locale: 'es-ES', timezoneId: 'Europe/Madrid', serviceWorkers: o.sw ? 'allow' : 'block' });
  }
  async launch(o = {}) {
    this.browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
    this.ctx = await this.context(o); this.page = await this.newPage(this.ctx);
    this.gh = null;
    if (o.gh) await this.fakeGitHub(this.page, o.gh === true ? undefined : o.gh);
    await this.page.goto(this.opts.url + (o.hash || '#mapa'));
    await this.ready();
  }
  async fakeGitHub(page, gh = new FakeGH(), repo = 'usuario/micologia-datos') {
    this.gh = gh;
    await page.route('https://api.github.com/**', async r => {
      const rq = r.request(), u = new URL(rq.url());
      if (!(rq.headers().authorization || '').startsWith('Bearer ')) return r.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
      let body = null; try { body = rq.postDataJSON(); } catch (e) { }
      const [status, json] = gh.handle(rq.method(), u, body, repo);
      r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json), headers: { 'access-control-allow-origin': '*' } });
    });
    return gh;
  }
  async ready() { await this.page.waitForSelector('body[data-ready="1"]', { timeout: 15000 }); await this.wait(300); }
  async close() { try { await this.browser.close(); } catch (e) { } }
  async reload() { await this.page.reload(); await this.ready(); }
  wait(ms) { return this.page ? this.page.waitForTimeout(ms) : new Promise(r => setTimeout(r, ms)); }
  /* ---------- usar la app ---------- */
  async tap(sel, ms = 250) { await this.page.waitForSelector(sel, { state: 'visible', timeout: 6000 }); await this.page.evaluate(s => document.querySelector(s).click(), sel); await this.wait(ms); }
  async tab(k) { await this.tap('.tabs [data-tb="' + k + '"]', 250); }   /* pestañas de la salida */
  async T(sel) { return this.page.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; }, sel); }
  async N(sel) { return this.page.evaluate(s => document.querySelectorAll(s).length, sel); }
  async has(sel) { return (await this.N(sel)) > 0; }
  async visible(sel) { return this.page.evaluate(s => { const e = document.querySelector(s); if (!e || e.hidden) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, sel); }
  async go(hash) { await this.page.evaluate(h => { location.hash = h; }, hash); await this.wait(350); }
  async shot(name) { fs.mkdirSync(OUT, { recursive: true }); await this.page.evaluate(() => { const t = document.querySelector('#toast'); if (t) t.classList.remove('show'); }); await this.page.screenshot({ path: path.join(OUT, name + '.png') }); }
  /* ---------- datos ---------- */
  docs(col) { return this.page.evaluate(c => window.__MI.db.list(c), col); }
  put(col, id, data) { return this.page.evaluate(([c, i, d]) => window.__MI.db.set(c, i, d), [col, id, data]); }
  setGeo(lat, lon, acc = 8) { return this.ctx.setGeolocation({ latitude: lat, longitude: lon, accuracy: acc }); }
  async fixGPS() { for (let i = 0; i < 30; i++) { if (await this.page.evaluate(() => !!window.__MI.geo.fix())) return true; await this.wait(150); } return false; }
  /* Marca un hallazgo con el botón (2 toques: Marcar aquí → Guardar) */
  async marcarRapido(extra = {}) {
    await this.fixGPS(); await this.tap('#fab', 350);
    if (extra.esp) { await this.page.fill('#sp-q', extra.esp); await this.wait(120); await this.tap('#sp-sugs button'); }
    if (extra.zona) { await this.tap('#mk-nz'); await this.page.fill('#mk-znom', extra.zona); await this.tap('#mk-zok'); }
    else if (extra.zonaExistente) { if (!(await this.has('#mk-zonas button[data-z].on'))) await this.tap('#mk-zonas button[data-z]'); }   /* si ya hay una a menos de 150 m, la app la elige sola */
    if (extra.cant) await this.page.fill('#mk-cant', extra.cant);
    await this.tap('#mk-ok', 350);
  }
}
module.exports = { T, serve, FakeGH, OUT, GEO, PNG1 };
