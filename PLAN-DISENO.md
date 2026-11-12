# Plan de diseño (nov 2026)

Objetivo: que la app se vea como una app actual, con toda la información ordenada y visual, y que **enseñe poco a poco** en vez de hacer preguntas. Cada fase se prueba (suite completa + capturas a 360/390 px) y se publica por separado.

| Fase | Qué cambia | Estado |
|---|---|---|
| 1. Mapa | Cabecera de cristal, filtros rápidos (Todo / Spots / Quiero ir / Hallazgos), iconos SVG, chinchetas de spot con nombre y nº de especies, burbujas de hallazgo con foto y color de su clase, menos ruido al alejar, selector de tipo de mapa. Tocar un spot = **resumen** (especies con ×veces y años, aviso si allí salen tóxicas, meses en que has encontrado, visitas, notas); editar pasa al lápiz. Tocar un hallazgo = resumen con foto. | Hecho (v9) |
| 2. Spots y salidas | «Mis spots» como tarjetas con miniaturas de especies; detalle de salida con mapa grande y una línea de tiempo por spot (fotos, especies); cifras más limpias. | Pendiente |
| 3. Marcar más rápido | Elegir especie de una rejilla de fotos (las que ya salieron en ese spot + las de temporada) con un toque; foto y voz grandes; cantidad/estado/nota plegados. | Pendiente |
| 4. Setas y aprender | Catálogo en rejilla de fotos; «Este mes» como portada; aprender poco a poco a partir de lo que encuentras (p. ej. «has encontrado boletus: así se distingue de su confusión»). | Pendiente |
| 5. Pulido | Ajustes ordenado, estados vacíos, transiciones, revisión en el móvil real. | Pendiente |

Capturas de diseño: `node tests/tools/capturas.js <carpeta>` (datos y teselas sintéticas).
