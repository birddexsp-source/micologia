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

Cinco pestañas: **Mapa** (Marcar aquí), **Salidas**, **Setas** (catálogo de 56 fichas tipo libro, guía de partes de la seta y «El libro para empezar»), **Este mes** (qué se puede encontrar ahora, con las peligrosas arriba) y **Ajustes**.

### Salida y recorrido
Al empezar una salida se graba el recorrido (`docs/js/track.js`): un punto cada ≥12 m y solo con precisión ≤40 m, guardado en la propia salida como `track: [[lat, lon, segundos], …]`. Pausar/reanudar y los huecos de más de 20 min abren un tramo nuevo (no se dibuja ni se mide una línea falsa entre tramos). Se dibuja en el mapa y en el minimapa de la salida; se exporta a GPX (recorrido + hallazgos como puntos).
**Limitación de la web:** si el móvil bloquea la pantalla o la app pasa a segundo plano, el navegador puede dejar de dar posiciones. Hay un botón «Pantalla encendida» (Wake Lock) que lo evita a costa de batería; la app retoma la grabación al volver.
Al terminar, el bloque «Fotos de lo que te llevas» guarda fotos de lo recogido (cámara o galería) en `fotosCosecha`, como registro de la salida.

## Catálogo visual
- **Fotos:** Wikimedia Commons, enlazadas (no copiadas). Cada foto lleva autor, licencia (solo CC BY, CC BY-SA, CC0 o dominio público) y página de origen, que se muestran en la ficha. Se piden con CORS y el service worker las guarda (`fotos-v1`); «Descargar fotos» en Ajustes las baja todas (~35 MB, 168 fotos) para usarlas sin cobertura.
- **Qué mirar y confusiones:** texto en cada ficha con su fuente. Hoy proceden de Wikipedia (fuente terciaria) y siguen en nivel **borrador** hasta que las revise una persona experta.
- **Temporada:** observaciones verificadas de iNaturalist por mes en la costa cantábrica (42,6–43,7 N · 5,5–1,0 O) + el rango que cita Wikipedia. Con menos de 15 observaciones solo se usa el rango citado (marcado «orientativo»); con menos de 2 registros en un mes ese mes no cuenta. Sin datos suficientes, la ficha lo dice. La temporada dice cuándo se ve la especie, nunca si es segura.
- **Ficha tipo libro:** hábitat con iconos y texto, color de esporada, «Cómo recogerla» (cortar / sacar entera / no recoger, con su fuente, p. ej. La Rioja), curiosidades y nombres en castellano y euskera. Los datos de cada especie están en `tools/datos/` (`n*.py` fichas nuevas, `x*.py` ampliación de las 25 anteriores), cada dato con la fuente de la que sale.
- **El libro para empezar** (`docs/js/libro.js`): 7 capítulos (equipo, cortar o arrancar, identificar y esporada, mitos, en casa, intoxicación, normas). Citan La Rioja, OCU, Consumer, Instituto Nacional de Toxicología, SUMMA 112 y la Universidad de Tampere. La normativa de Bizkaia/Euskadi **no está verificada** y la pantalla lo dice.
- **Regenerar:** `python3 tools/enriquecer.py` (v2: fotos, qué mirar, temporada) y después `python3 tools/ampliar.py` (v3: +31 fichas y datos de libro). Ambos son idempotentes.

## Mapa

Satélite por defecto: IGN PNOA, WMTS `https://www.ign.es/wmts/pnoa-ma`, capa `OI.OrthoimageCoverage`, matriz `GoogleMapsCompatible` (niveles 0–20 según GetCapabilities, JPEG/PNG, CC BY 4.0). Callejero conmutable: OpenStreetMap.
Verificado en navegador (12-nov-2026): una tesela de Bizkaia responde 200 JPEG 256×256 con `Access-Control-Allow-Origin: *`, por eso las teselas se piden con CORS y el service worker las guarda para uso sin cobertura. Pendiente: confirmar el texto exacto de atribución (el servicio indica «CC BY 4.0 scne.es»).

## Flujo para cambiar algo

1. Editar `docs/`.
2. Subir `V` en `docs/sw.js` **y** `APP_V` en `docs/js/app.js` (un test comprueba que coinciden). Si se añade un módulo, añadirlo también a `SHELL` en `sw.js`.
3. `cd tests && npm install && npx playwright install chromium && node run.js` → todo en verde.
4. Commit y push; recargar la app dos veces en el móvil.

## Catálogo

56 fichas en **borrador** (25 del MVP: 16 peligrosas o pares de confusión y 9 candidatas, más 31 de la ampliación v3: 22 candidatas, 5 tóxicas, 1 mortal y 3 no comestibles; en total 31 candidatas, 14 tóxicas, 7 mortales y 4 no comestibles). Las comestibles se muestran como «Comestible» o «Con condiciones» **según fuentes** (Wikipedia y guías divulgativas, campo `comestibilidad`, datos en `tools/datos/com.py`); internamente siguen como `sin_datos` + `candidataComestible` y en borrador hasta tener ≥2 fuentes contrastadas y revisión experta; ninguna ficha pasa a `comestible_buena` sin eso (lo comprueba `tests/suites/00-estatico.js`).

## Reconocer con IA (Gemini)
Setas → «Reconocer con IA»: 1-3 fotos (arriba, por debajo, base del pie) → Gemini devuelve candidatas que se cruzan con las 56 fichas; si no está en la colección lo dice. Solo es una pista: se abstiene si las fotos no bastan, avisa si entre las candidatas hay tóxicas y nunca habla de comestibilidad.
La clave (gratis, aistudio.google.com/apikey) **no está en el repo**: se pega en la pantalla o en Ajustes y vive solo en el localStorage del móvil. Las fotos se envían a Google solo al pulsar «Reconocer». Módulo: `docs/js/ia.js`; pruebas: `tests/suites/09-ia.js`.

## Spots y notas de voz
- **Spot = zona** con estado «Visitado» o «Quiero ir» (bandera verde / azul discontinua en el mapa; lista en Salidas → Mis spots, por cercanía). Botón ⚑ del mapa para crear uno; desde un spot, «Marcar hallazgo aquí» (también se elige solo si estás a menos de 150 m). Al marcar un hallazgo en un «Quiero ir» pasa a «Visitado».
- **Nota de voz** (`docs/js/audio.js`) en hallazgos y spots: se guarda como blob (`blobs/<id>` en el repo de datos) y, con conexión, Gemini la transcribe sola (`ia.transcribir`); la transcripción se puede corregir y rellena la nota. Sin conexión queda el audio y se transcribe luego.
- Datos nuevos (opcionales) en `zonas`: `estado`, `fotos`, `audios`, `transcripciones`, `visitadaTs`; en `hallazgos`: `audios`, `transcripciones`.
