module.exports = {
  name: 'Carga: arranque, pestañas y mapa satélite',
  async run(t) {
    await t.case('arranca con 4 pestañas y el mapa', async () => {
      t.eq('4 pestañas', await t.N('.nav a'), 4);
      t.ok('mapa Leaflet montado', await t.has('#map.leaflet-container'));
      t.ok('botón «Marcar aquí» visible', await t.visible('#fab'));
      t.eq('título', await t.T('#ttl'), 'Mapa');
      await t.shot('captura-01-mapa');
    });
    await t.case('el satélite del IGN es la capa por defecto', async () => {
      await t.wait(600);
      const u = t.tileReqs.find(x => /ign\.es\/wmts\/pnoa-ma/.test(x));
      t.ok('se piden teselas a ign.es/wmts/pnoa-ma', !!u);
      t.ok('capa OI.OrthoimageCoverage', /LAYER=OI\.OrthoimageCoverage/.test(u || ''));
      t.ok('matriz GoogleMapsCompatible', /TILEMATRIXSET=GoogleMapsCompatible/.test(u || ''));
      t.ok('formato JPEG', /FORMAT=image\/jpeg/.test(u || ''));
      t.ok('atribución del IGN visible', /IGN/.test(await t.T('.leaflet-control-attribution') || ''));
    });
    await t.case('conmutar a callejero (OSM) y volver', async () => {
      t.tileReqs.length = 0; await t.tap('#layerbtn', 700);
      t.ok('callejero pide teselas a OSM', t.tileReqs.some(x => /tile\.openstreetmap\.org/.test(x)));
      t.ok('atribución de OSM', /OpenStreetMap/.test(await t.T('.leaflet-control-attribution') || ''));
      await t.tap('#layerbtn', 500);
      t.eq('vuelve a satélite', await t.page.evaluate(() => window.__MI.S.map.getBase()), 'sat');
    });
    await t.case('navegación entre pestañas', async () => {
      for (const [h, titulo] of [['#salidas', 'Salidas'], ['#setas', 'Setas'], ['#ajustes', 'Ajustes'], ['#mapa', 'Mapa']]) {
        await t.go(h); t.eq('título en ' + h, await t.T('#ttl'), titulo);
        t.ok('pestaña activa en ' + h, await t.has('.nav a.on[data-tab="' + h.slice(1) + '"]'));
      }
    });
    await t.case('GPS: la app muestra la precisión', async () => {
      await t.fixGPS(); await t.wait(200);
      t.ok('indicador ±8 m', /±8 m/.test(await t.T('#gps') || ''), await t.T('#gps'));
    });
  }
};
