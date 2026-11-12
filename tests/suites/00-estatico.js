/* Comprobaciones sin navegador: archivos, service worker, catálogo y seguridad. */
const fs = require('fs'), path = require('path');
const DOCS = path.resolve(__dirname, '..', '..', 'docs');
const rd = f => fs.readFileSync(path.join(DOCS, f), 'utf8');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const CLASES = ['mortal', 'toxica', 'no_comestible', 'comestible_condicional', 'comestible_buena', 'sin_datos'];

module.exports = {
  name: 'Estático: archivos, SW, catálogo y seguridad', static: true,
  async run(t) {
    await t.case('archivos básicos y service worker', async () => {
      ['index.html', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'css/app.css', 'js/app.js', 'js/db.js', 'js/sync.js', 'js/geo.js', 'js/map.js', 'js/catalog.js', 'js/util.js', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', 'data/especies.json']
        .forEach(f => t.ok('existe docs/' + f, fs.existsSync(path.join(DOCS, f))));
      const sw = rd('sw.js'), shell = JSON.parse(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
      shell.forEach(f => t.ok('SHELL del SW existe: ' + f, f === './' || fs.existsSync(path.join(DOCS, f))));
      t.eq('versión de caché = APP_V de app.js', sw.match(/const V = '([^']+)'/)[1], rd('js/app.js').match(/const APP_V = '([^']+)'/)[1]);
      JSON.parse(rd('manifest.webmanifest'));
      t.ok('Leaflet fijado a 1.9.4', /1\.9\.4/.test(rd('vendor/leaflet/leaflet.js').slice(0, 300)));
    });
    await t.case('módulos: los import resuelven y no hay CDN', async () => {
      walk(path.join(DOCS, 'js')).forEach(f => {
        const s = fs.readFileSync(f, 'utf8');
        for (const m of s.matchAll(/from '(\.\/[^']+)'/g)) t.ok(path.basename(f) + ' importa ' + m[1], fs.existsSync(path.join(path.dirname(f), m[1])));
      });
      const idx = rd('index.html');
      t.ok('index.html sin scripts/estilos externos', !/(src|href)="https?:\/\//.test(idx));
    });
    await t.case('seguridad: sin tokens ni datos de sitios en el repo público', async () => {
      const bad = walk(DOCS).filter(f => !/\.(png|jpg|webp)$/.test(f)).filter(f => /ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/.test(fs.readFileSync(f, 'utf8')));
      t.eq('ningún token en docs/', bad, []);
      const data = fs.readdirSync(path.join(DOCS, 'data'));
      t.eq('docs/data solo contiene el catálogo', data, ['especies.json']);
      t.ok('no hay GPX/KML ni exportaciones en docs/', !walk(DOCS).some(f => /\.(gpx|kml|geojson)$/i.test(f)));
    });
    await t.case('catálogo: esquema y reglas de seguridad', async () => {
      const j = JSON.parse(rd('data/especies.json')), E = j.especies;
      t.ok('hay aviso de seguridad', /no se come/i.test(j.aviso));
      t.eq('ids únicos', new Set(E.map(e => e.id)).size, E.length);
      t.eq('número de fichas (lista del MVP validable)', E.length, 25);
      E.forEach(e => {
        t.ok(e.id + ': id, nombre científico y clase', !!(e.id && e.nombreCientifico && CLASES.includes(e.clase)), e.clase);
        t.ok(e.id + ': tiene fuentes', Array.isArray(e.fuentes) && e.fuentes.length >= 1);
        t.ok(e.id + ': nivel de verificación', ['borrador', 'contrastada', 'revisada'].includes(e.nivelVerificacion));
        /* regla del PDF 3: nada pasa a comestible_buena sin ≥2 fuentes y revisión */
        if (e.clase === 'comestible_buena') t.ok(e.id + ': comestible_buena exige ≥2 fuentes y nivel contrastada/revisada', e.fuentes.length >= 2 && e.nivelVerificacion !== 'borrador');
        if (/^comestible/.test(e.clase)) t.ok(e.id + ': comestible con nivel ≠ borrador', e.nivelVerificacion !== 'borrador');
        (e.confusiones || []).forEach(c => {
          t.ok(e.id + ' → confusión con texto de cómo distinguir', !!c.comoDistinguir && !!c.nombre);
          if (c.id) { const o = E.find(x => x.id === c.id); t.ok(e.id + ' ↔ ' + c.id + ': existe', !!o); if (o) t.ok(e.id + ' ↔ ' + c.id + ': recíproca', (o.confusiones || []).some(x => x.id === e.id)); }
        });
        if (e.candidataComestible) t.ok(e.id + ': candidata sin clasificar como comestible', e.clase === 'sin_datos');
      });
      t.ok('las 9 candidatas a comestible están como sin_datos', E.filter(e => e.candidataComestible).length === 9);
      ['amanita-phalloides', 'amanita-verna-virosa', 'lepiota-brunneoincarnata', 'galerina-marginata', 'cortinarius-orellanus'].forEach(id => t.eq(id + ' es mortal', (E.find(e => e.id === id) || {}).clase, 'mortal'));
    });
  }
};
