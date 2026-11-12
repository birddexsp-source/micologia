# micologia

Cuaderno de campo de setas para el móvil: marca hallazgos con GPS sobre mapa satélite, agrupa las salidas y consulta un catálogo con rasgos de identificación. Web estática (GitHub Pages), funciona sin conexión y sincroniza con un repo privado de datos.

**La app nunca certifica que una seta sea comestible.** Todo lo comestible pasa antes por una persona experta o sociedad micológica. En caso de duda, no se come.

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| App publicada (lo que ve el móvil) | `docs/` (Pages: rama `main`, carpeta `/docs`) |
| Datos (módulo IndexedDB, sync, mapa, GPS, catálogo, pantallas) | `docs/js/` (módulos ES, sin build) |
| Catálogo de especies (solo lectura) | `docs/data/especies.json` |
| Leaflet 1.9.4 alojado aquí (offline) | `docs/vendor/leaflet/` |
| Pruebas Playwright | `tests/` |

Las coordenadas **nunca** van a este repo público: solo viven en el móvil y en el repo privado de datos (`micologia-datos`). Los tests usan un punto sintético.

## Datos y sincronización

Todo se guarda primero en el móvil (IndexedDB). Al sincronizar, cada documento sube al repo privado como `data/<coleccion>/<id>.json = {u, del, d}` (`u` = ms de la última escritura, gana el más reciente; `del` = borrado lógico) y las fotos como `blobs/<id>`.
Colecciones: `salidas`, `zonas`, `hallazgos`. El token de GitHub (fine-grained, solo el repo de datos, permiso *Contents: Read and write*) lo escribe el usuario en Ajustes y vive solo en el navegador.

## Mapa

Satélite por defecto: IGN PNOA, WMTS `https://www.ign.es/wmts/pnoa-ma`, capa `OI.OrthoimageCoverage`, matriz `GoogleMapsCompatible` (niveles 0–20 según GetCapabilities, JPEG/PNG, CC BY 4.0). Callejero conmutable: OpenStreetMap.
Pendiente de verificar con una tesela real en navegador: respuesta/CORS de ign.es y texto exacto de atribución.

## Flujo para cambiar algo

1. Editar `docs/`.
2. Subir `V` en `docs/sw.js` **y** `APP_V` en `docs/js/app.js` (un test comprueba que coinciden).
3. `cd tests && npm install && npx playwright install chromium && node run.js` → todo en verde.
4. Commit y push; recargar la app dos veces en el móvil.

## Catálogo

25 fichas en **borrador** (lista del MVP: 16 peligrosas o pares de confusión y 9 comestibles candidatas). Las candidatas están como `sin_datos` hasta tener ≥2 fuentes contrastadas y revisión experta; ninguna ficha pasa a `comestible_buena` sin eso (lo comprueba `tests/suites/00-estatico.js`).
