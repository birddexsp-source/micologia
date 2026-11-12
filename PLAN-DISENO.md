# Plan de diseño (nov 2026)

Objetivo: que la app se vea como una app actual, con toda la información ordenada y visual, y que **enseñe poco a poco** en vez de hacer preguntas. Cada fase se prueba (suite completa + capturas a 360/390 px) y se publica por separado.

| Fase | Qué cambia | Estado |
|---|---|---|
| 1. Mapa | Cabecera de cristal, filtros rápidos (Todo / Spots / Quiero ir / Hallazgos), iconos SVG, chinchetas de spot con nombre y nº de especies, burbujas de hallazgo con foto y color de su clase, menos ruido al alejar, selector de tipo de mapa. Tocar un spot = **resumen** (especies con ×veces y años, aviso si allí salen tóxicas, meses en que has encontrado, visitas, notas); editar pasa al lápiz. Tocar un hallazgo = resumen con foto. | Hecho (v9–v10: cerrar el resumen arrastrando/tocando el mapa; desde lejos, «Añadir especie» en el sitio del spot) |
| 2. Spots y salidas | «Mis spots» como tarjetas con miniaturas de especies; detalle de salida con mapa grande y una línea de tiempo por spot (fotos, especies); cifras más limpias. Salida con pestañas (Spots · Hallazgos · Fotos · Más), botones «Especie aquí» / «Spot aquí», GPS apagado por defecto e importar GPX de Wikiloc (se ve en la salida y al abrir el spot). | Hecho (v11–v12) |
| 3. Marcar más rápido | Elegir especie de una rejilla de fotos (las que ya salieron en ese spot + las de temporada) con un toque; foto y voz grandes; cantidad/estado/nota plegados. | Hecho (v14): rejilla «¿Qué es?» con «No sé» + 7 sugerencias (aquí › hoy › de las tuyas › temporada), foto y voz en botones grandes, cantidad con un toque, estado y nota plegados |
| 4. Setas y aprender | Catálogo en rejilla de fotos; «Este mes» como portada; aprender poco a poco a partir de lo que encuentras (p. ej. «has encontrado boletus: así se distingue de su confusión»). | Hecho (v15–v16): «Hoy aprendes» (una lección al día: confusiones de lo que encuentras, lo que sale este mes, en qué fijarse, curiosidades; botón «Otra»), «Tu colección» con barra y filtro «✓ Las mías», catálogo en tarjetas con foto, Este mes con resumen y «Tú en <mes>» |
| 5. Pulido | Ajustes ordenado, estados vacíos, transiciones, revisión en el móvil real. | Hecho (v17): Ajustes por secciones con estado de sincronización arriba, aviso en el mapa vacío, transiciones al cambiar de pestaña y al abrir hojas, pantallas vacías más claras |

Capturas de diseño: `node tests/tools/capturas.js <carpeta>` (datos y teselas sintéticas).
