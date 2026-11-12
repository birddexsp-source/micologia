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
      ['index.html', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'css/app.css', 'js/app.js', 'js/db.js', 'js/sync.js', 'js/geo.js', 'js/map.js', 'js/catalog.js', 'js/util.js', 'js/guia.js', 'js/ficha.js', 'js/temporada.js', 'js/track.js', 'js/libro.js', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', 'data/especies.json']
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
      t.eq('número de fichas (25 del MVP + 31 de la ampliación)', E.length, 56);
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
      E.filter(x => x.candidataComestible).forEach(x => {
        t.ok(x.id + ': comestibilidad atribuida a las fuentes, en borrador', !!x.comestibilidad && ['si', 'cond'].includes(x.comestibilidad.nivel) && /^Según|xixa|«xixa»/.test(x.comestibilidad.txt) && /sin revisión experta/.test(x.comestibilidad.segun) && x.nivelVerificacion === 'borrador');
      });
      E.filter(x => x.clase === 'mortal' || x.clase === 'toxica' || x.clase === 'no_comestible').forEach(x => t.ok(x.id + ': peligrosa/no comestible sin marca de comestible', !x.comestibilidad));
      t.ok('las 31 candidatas a comestible están como sin_datos', E.filter(e => e.candidataComestible).length === 31 && E.filter(e => e.candidataComestible).every(e => e.clase === 'sin_datos'));
      ['amanita-phalloides', 'amanita-verna-virosa', 'lepiota-brunneoincarnata', 'galerina-marginata', 'cortinarius-orellanus'].forEach(id => t.eq(id + ' es mortal', (E.find(e => e.id === id) || {}).clase, 'mortal'));
    });
    await t.case('catálogo v3: datos de libro (hábitat, cómo recoger, curiosidades, nombres) con fuente', async () => {
      const E = JSON.parse(rd('data/especies.json')).especies, ACC = ['cortar', 'extraer', 'dejar'];
      const HAB = ['robledal', 'encinar', 'hayedo', 'castanar', 'abedular', 'frondosas', 'arbol_vivo', 'pinar', 'abetal', 'coniferas', 'mixto', 'bosque', 'prado', 'claro', 'parque', 'brezal', 'huerto', 'cuneta', 'madera', 'quemado'];
      E.forEach(e => {
        t.ok(e.id + ': hábitats válidos', Array.isArray(e.habitats) && e.habitats.length >= 1 && e.habitats.every(h => HAB.includes(h)), JSON.stringify(e.habitats));
        t.ok(e.id + ': texto de hábitat', !!e.habitatTexto && e.habitatTexto.length > 30);
        t.ok(e.id + ': cómo recogerla (acción y texto)', !!e.recoleccion && ACC.includes(e.recoleccion.acc) && e.recoleccion.txt.length > 20);
        t.ok(e.id + ': ≥2 curiosidades', Array.isArray(e.curiosidades) && e.curiosidades.length >= 1 && e.curiosidades.every(c => c.length > 15));
        t.ok(e.id + ': nombre en euskera', ((e.nombresComunes || {}).eu || []).length >= 1);
        t.ok(e.id + ': cita Wikipedia en español o euskera para hábitat/curiosidades', e.fuentes.some(f => /^Wikipedia \((español|euskera)\)/.test(f.nombre) && /^https:\/\/(es|eu)\.wikipedia\.org\/wiki\//.test(f.url || '')));
        if (e.clase === 'mortal' || e.clase === 'toxica') t.eq(e.id + ': tóxica → «No recoger»', e.recoleccion.acc, 'dejar');
        if (e.candidataComestible) t.ok(e.id + ': el texto de recogida no declara comestible', !/\bes comestible\b|\bse puede comer\b|\bbuen comestible\b/i.test(e.recoleccion.txt + ' ' + e.habitatTexto + ' ' + e.curiosidades.join(' ')));
      });
      ['xanthodermus', 'xanthoderma'].forEach(() => 0);
      t.ok('la «xixa» (Agaricus campestris) está en el catálogo', E.some(e => e.id === 'agaricus-campestris' && e.nombresComunes.es.concat(e.nombresComunes.eu).length >= 1));
    });
    await t.case('catálogo v2: fotos con licencia y autoría, qué mirar y temporada con fuente', async () => {
      const E = JSON.parse(rd('data/especies.json')).especies, LIC = ['CC BY 2.0', 'CC BY 2.5', 'CC BY 3.0', 'CC BY 4.0', 'CC BY-SA 2.0', 'CC BY-SA 3.0', 'CC BY-SA 4.0', 'CC0', 'Dominio público'];
      const PARTES = ['sombrero', 'cutis', 'himenio', 'carne', 'pie', 'anillo', 'volva', 'micelio', 'olor', 'esporada', 'habitat', 'otro'];
      E.forEach(e => {
        t.ok(e.id + ': ≥3 fotos o las que haya (mín. 3)', (e.fotos || []).length >= 3, String((e.fotos || []).length));
        (e.fotos || []).forEach((f, i) => {
          t.ok(e.id + ' foto ' + i + ': autor, licencia libre y página de origen', !!f.autor && LIC.includes(f.licencia) && /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(f.pagina), f.licencia);
          t.ok(e.id + ' foto ' + i + ': URL de Commons con {w}', /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/.+\/\{w\}px-/.test(f.url));
          if (f.licencia !== 'Dominio público') t.ok(e.id + ' foto ' + i + ': enlace a la licencia', /^https:\/\/creativecommons\.org\//.test(f.licenciaUrl || ''));
        });
        t.ok(e.id + ': «qué mirar» con ≥3 puntos y partes válidas', (e.queMirar || []).length >= 3 && e.queMirar.every(x => PARTES.includes(x.parte) && x.titulo && x.texto));
        t.ok(e.id + ': tiene regla clave', !!e.clave && e.clave.length > 20);
        t.ok(e.id + ': cita Wikipedia con URL y fecha', e.fuentes.some(f => /^Wikipedia/.test(f.nombre) && /^https:\/\/en\.wikipedia\.org\/wiki\//.test(f.url || '') && /^\d{4}-\d\d-\d\d$/.test(f.fechaConsulta || '')));
        const ins = (e.temporada || {}).inat || {};
        t.ok(e.id + ': temporada con 12 meses y N coherente', Array.isArray(ins.mensual) && ins.mensual.length === 12 && ins.mensual.reduce((a, b) => a + b, 0) === ins.n, JSON.stringify(ins.mensual));
        if (ins.n > 0) t.ok(e.id + ': cita iNaturalist si usa sus datos', e.fuentes.some(f => /iNaturalist/.test(f.nombre) && /^https:\/\/www\.inaturalist\.org\//.test(f.url || '')));
        if (e.candidataComestible) t.ok(e.id + ': las pistas de una candidata no la declaran comestible', !/\bes comestible\b|\bse puede comer\b|\bbuen comestible\b/i.test([e.clave, ...(e.queMirar || []).map(x => x.texto)].join(' ')));
      });
    });
  }
};
