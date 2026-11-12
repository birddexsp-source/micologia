# micologia

Cuaderno de campo de setas para el móvil: marca hallazgos con GPS sobre mapa satélite, graba el recorrido de cada salida, guarda fotos de lo recogido y consulta un catálogo con fotos, qué mirar y con qué se confunde cada especie. Web estática (GitHub Pages), funciona sin conexión y sincroniza con un repo privado de datos.

App en vivo: https://birddexsp-source.github.io/micologia/

**La app nunca certifica que una seta sea comestible.** Todo lo comestible pasa antes por una persona experta o sociedad micológica. En caso de duda, no se come.

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| App publicada (lo que ve el móvil) | `docs/` (Pages: rama `main`, carpeta `/docs`) |
| Datos (módulo IndexedDB, sync, mapa, GPS, catálogo, pantallas) | `docs/js/` (módulos ES, sin build) |
| Catálogo de especies (solo lectura) | `docs/data/especies.json` |
| Cómo se genera el catálogo (fotos, licencias, fuentes) | `tools/` |
| Leaflet 1.9.4 alojado aquí (offline) | `docs/vendor/leaflet/` |
| Pruebas Playwright | `tests/` |

Las coordenadas **nunca** van a este repo público: solo viven en el móvil y en el repo privado de datos (`micologia-datos`). Los tests usan un punto sintético.

## Datos y sincronización

Todo se guarda primero en el móvil (IndexedDB). Al sincronizar, cada documento sube al repo privado como `data/<coleccion>/<id>.json = {u, del, d}` (`u` = ms de la última escritura, gana el más reciente; `del` = borrado lógico) y las fotos como `blobs/<id>`.
Colecciones: `salidas`, `zonas`, `hallazgos`. El token de GitHub (fine-grained, solo el repo de datos, permiso *Contents: Read and write*) lo escribe el usuario en Ajustes y vive solo en el navegador.

## Pantallas

Cinco pestañas: **Mapa** (Marcar aquí), **Salidas**, **Setas** (catálogo + guía de partes de la seta), **Este mes** (qué se puede encontrar ahora, con las peligrosas arriba) y **Ajustes**.

### Salida y recorrido
Al empezar una salida se graba el recorrido (`docs/js/track.js`): un punto cada ≥12 m y solo con precisión ≤40 m, guardado en la propia salida como `track: [[lat, lon, segundos], …]`. Pausar/reanudar y los huecos de más de 20 min abren un tramo nuevo (no se dibuja ni se mide una línea falsa entre tramos). Se dibuja en el mapa y en el minimapa de la salida; se exporta a GPX (recorrido + hallazgos como puntos).
**Limitación de la web:** si el móvil bloquea la pantalla o la app pasa a segundo plano, el navegador puede dejar de dar posiciones. Hay un botón «Pantalla encendida» (Wake Lock) que lo evita a costa de batería; la app retoma la grabación al volver.
Al terminar, el bloque «Fotos de lo que te llevas» guarda fotos de lo recogido (cámara o galería) en `fotosCosecha`, como registro de la salida.

## Catálogo visual
- **Fotos:** Wikimedia Commons, enlazadas (no copiadas). Cada foto lleva autor, licencia (solo CC BY, CC BY-SA, CC0 o dominio público) y página de origen, que se muestran en la ficha. Se piden con CORS y el service worker las guarda (`fotos-v1`); «Descargar fotos» en Ajustes las baja todas (~15 MB) para usarlas sin cobertura.
- **Qué mirar y confusiones:** texto en cada ficha con su fuente. Hoy proceden de Wikipedia (fuente terciaria) y siguen en nivel **borrador** hasta que las revise una persona experta.
- **Temporada:** observaciones verificadas de iNaturalist por mes en la costa cantábrica (42,6–43,7 N · 5,5–1,0 O) + el rango que cita Wikipedia. Con menos de 15 observaciones solo se usa el rango citado (marcado «orientativo»); con menos de 2 registros en un mes ese mes no cuenta. Sin datos suficientes, la ficha lo dice. La temporada dice cuándo se ve la especie, nunca si es segura.
- **Regenerar:** `python3 tools/enriquecer.py` (lista de fotos y textos en `tools/`; es idempotente).

## Mapa

Satélite por defecto: IGN PNOA, WMTS `https://www.ign.es/wmts/pnoa-ma`, capa `OI.OrthoimageCoverage`, matriz `GoogleMapsCompatible` (niveles 0–20 según GetCapabilities, JPEG/PNG, CC BY 4.0). Callejero conmutable: OpenStreetMap.
Verificado en navegador (12-nov-2026): una tesela de Bizkaia responde 200 JPEG 256×256 con `Access-Control-Allow-Origin: *`, por eso las teselas se piden con CORS y el service worker las guarda para uso sin cobertura. Pendiente: confirmar el texto exacto de atribución (el servicio indica «CC BY 4.0 scne.es»).

## Flujo para cambiar algo

1. Editar `docs/`.
2. Subir `V` en `docs/sw.js` **y** `APP_V` en `docs/js/app.js` (un test comprueba que coinciden). Si se añade un módulo, añadirlo también a `SHELL` en `sw.js`.
3. `cd tests && npm install && npx playwright install chromium && node run.js` → todo en verde.
4. Commit y push; recargar la app dos veces en el móvil.

## Catálogo

25 fichas en **borrador** (lista del MVP: 16 peligrosas o pares de confusión y 9 comestibles candidatas). Las candidatas están como `sin_datos` hasta tener ≥2 fuentes contrastadas y revisión experta; ninguna ficha pasa a `comestible_buena` sin eso (lo comprueba `tests/suites/00-estatico.js`).
