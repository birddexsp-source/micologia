/* Modelo de «¿cuándo salir?». Es un modelo EXPERTO y transparente, no una caja negra:
     puntuación (0–100) = lluvia acumulada × temperatura × helada × sequedad × época del año
   Cada factor va de 0 a 1 y el más bajo es «lo que falta» (se explica con palabras).
   Los parámetros salen de `fructificacion` de cada ficha (gremio ecológico). Solo Boletus edulis tiene umbrales de un estudio;
   el resto son valores iniciales razonados. Con tus salidas reales se CALIBRA (calibrar/aciertos): el modelo aprende de lo que encuentras.
   Nunca dice si una seta es comestible: solo si es buen momento para buscarla. */
import { sumaDias, difDias, iso } from './clima.js';
import { niveles, MESES } from './temporada.js';

const cl = x => Math.max(0, Math.min(1, x));
const NIV = [0.08, 0.5, 0.8, 1];   // temporada: nivel 0..3 → peso
export const ETIQ = s => s >= 70 ? 'Muy buen momento' : s >= 50 ? 'Buen momento' : s >= 30 ? 'Regular' : 'Flojo';
export const COL = s => s >= 70 ? '#46b36b' : s >= 50 ? '#9bcf53' : s >= 30 ? '#e0a458' : '#8a9a95';

/* Lo que ha pasado antes de `f` (sin contar el propio día), con los datos de `dias`. */
export function condiciones(dias, f, par) {
  const L = par.lluvia, T = par.temp, g = d => dias[sumaDias(f, d)];
  let mm = 0, nL = 0; for (let d = -L.ventana; d <= -1; d++) { const x = g(d); if (x && x.p != null) { mm += x.p; nL++; } }
  let ts = 0, nT = 0; for (let d = -T.ventana; d <= -1; d++) { const x = g(d); if (x && x.tmed != null) { ts += x.tmed; nT++; } }
  let minT = null; for (let d = -2; d <= 0; d++) { const x = g(d); if (x && x.tmin != null && (minT == null || x.tmin < minT)) minT = x.tmin; }
  let p5 = 0, n5 = 0; for (let d = -5; d <= -1; d++) { const x = g(d); if (x && x.p != null) { p5 += x.p; n5++; } }
  const ayer = g(-1), hoyD = g(0);
  const seco = n5 >= 3 && p5 < 1 && !!((ayer && ayer.tmax >= 20) || (hoyD && hoyD.tmax >= 20));
  return {
    mm: Math.round(mm), ventanaL: L.ventana, cobertura: Math.min(nL / L.ventana, nT / T.ventana),
    tmed: nT ? Math.round(ts / nT * 10) / 10 : null, ventanaT: T.ventana, minT, p5: Math.round(p5 * 10) / 10, seco,
    pHoy: hoyD && hoyD.p != null ? hoyD.p : null, tmaxHoy: hoyD ? hoyD.tmax : null
  };
}
export function temporada(e, f) {
  const niv = niveles(e), hayAlgo = niv.some(x => x.nivel > 0); if (!hayAlgo) return 0.6;
  const [, m, d] = f.split('-').map(Number), n = k => NIV[niv[(k + 12) % 12].nivel];
  const cur = n(m - 1); const t = d > 20 ? (d - 20) / 22 : d < 10 ? (10 - d) / 22 : 0;     // en los extremos del mes se mezcla con el vecino
  return d > 20 ? cur * (1 - t) + n(m) * t : d < 10 ? cur * (1 - t) + n(m - 2) * t : cur;
}
/* Presión de recolectores (HIPÓTESIS de Jon, sin contrastar): tras el fin de semana la gente ya ha recogido las setas que se recogen
   (quedan las que nadie se lleva, y los boletos pasados o agusanados); jueves y viernes por la mañana hay tanda nueva y poca gente.
   Solo afecta a las especies candidatas a comestibles y resta como mucho un 30 % (los lunes). No depende de la lluvia, para que más lluvia nunca baje la puntuación. */
export const DIA_GENTE = [0.5, 1, 0.7, 0.4, 0, 0, 0.3];   // domingo … sábado
const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export function presion(e, dias, f) {
  const [y, m, d] = f.split('-').map(Number), dow = new Date(y, m - 1, d, 12).getDay(), peso = e.candidataComestible ? DIA_GENTE[dow] : 0;
  return { v: Math.round((1 - 0.3 * peso) * 1000) / 1000, dow, peso, dia: DIAS_ES[dow], aplica: !!e.candidataComestible };
}
/* factores 0–1 de una especie en una fecha */
export function factores(e, dias, f) {
  const fr = e.fructificacion; if (!fr || fr.perenne) return null;
  const c = condiciones(dias, f, fr), L = fr.lluvia, T = fr.temp;
  const lluvia = cl((c.mm - 0.2 * L.ideal) / (0.8 * L.ideal));
  const temp = c.tmed == null ? 0.5 : Math.exp(-(((c.tmed - T.opt) / T.ancho) ** 2));
  const duro = fr.helada === 'fuerte';
  const helada = c.minT == null ? 1 : c.minT <= -3 ? (duro ? 0.15 : 0.4) : c.minT <= 0 ? (duro ? 0.35 : 0.7) : 1;
  const seco = c.seco ? 0.7 : 1, temp_ = temporada(e, f);
  return { c, lluvia, temp, helada, seco, temporada: temp_, gente: presion(e, dias, f) };
}
/* puntuación 0–100 + explicación */
export function puntuar(e, dias, f, cal) {
  const x = factores(e, dias, f); if (!x) return null;
  const crudo = 100 * x.lluvia * x.temp * x.helada * x.seco * x.gente.v * Math.pow(x.temporada, 0.7);
  const score = Math.round(cal ? aplicarCal(crudo, cal) : crudo);
  const nombres = { lluvia: 'lluvia', temp: 'temperatura', helada: 'helada', seco: 'sequedad', temporada: 'época del año', gente: 'recolectores' };
  const orden = Object.keys(nombres).map(k => [k, k === 'gente' ? x.gente.v : x[k]]).sort((a, b) => a[1] - b[1]);
  return { score, crudo: Math.round(crudo), x, limitante: orden[0][1] < 0.85 ? orden[0][0] : null, explicacion: explicar(e, x, nombres), prevision: false };
}
function explicar(e, x, nombres) {
  const c = x.c, T = e.fructificacion.temp, L = e.fructificacion.lluvia, out = [];
  out.push({ k: 'lluvia', v: x.lluvia, t: 'Lluvia: ' + c.mm + ' mm en los últimos ' + c.ventanaL + ' días (lo ideal: ≥ ' + L.ideal + ' mm)' + (x.lluvia >= 1 ? ' ✓' : x.lluvia < 0.4 ? ': falta agua' : ': va bien pero justa') });
  out.push({ k: 'temp', v: x.temp, t: c.tmed == null ? 'Temperatura: sin datos' : 'Temperatura media ' + String(c.tmed).replace('.', ',') + ' °C en los últimos ' + c.ventanaT + ' días (lo ideal: ' + T.rango[0] + '–' + T.rango[1] + ' °C)' + (x.temp > 0.8 ? ' ✓' : c.tmed > T.opt ? ': demasiado cálido' : ': demasiado frío') });
  if (x.helada < 1) out.push({ k: 'helada', v: x.helada, t: 'Helada: mínima de ' + String(c.minT).replace('.', ',') + ' °C en los últimos días, frena la salida' });
  if (x.seco < 1) out.push({ k: 'seco', v: x.seco, t: 'Seco y caluroso los últimos días: el suelo se seca' });
  if (x.temporada < 0.5) out.push({ k: 'temporada', v: x.temporada, t: 'Fuera de su época habitual en la costa cantábrica' });
  const g = x.gente;
  if (g.aplica && g.peso >= 0.7) out.push({ k: 'gente', v: g.v < 0.8 ? 0.6 : 0.8, t: 'Hay que contar con la gente: un ' + g.dia + ', tras el fin de semana, ya han pasado a recoger; quedan sobre todo las setas que nadie se lleva (hipótesis, sin contrastar)' });
  else if (g.aplica && g.peso === 0) out.push({ k: 'gente', v: 1, t: 'Un ' + g.dia + ' hay poca gente: tanda nueva sin recoger (hipótesis, sin contrastar)' });
  return out;
}
/* Gremios: «setas en general» = el gremio que mejor puntúa ese día (con la especie más representativa en cuenta de la temporada) */
export function puntuarGeneral(especies, dias, f, cal) {
  const por = new Map();
  for (const e of especies) {
    const fr = e.fructificacion; if (!fr || fr.perenne) continue;
    const r = puntuar(e, dias, f, cal); if (!r) continue;
    const g = por.get(fr.gremio) || { gremio: fr.gremio, nombre: fr.gremioNombre, scores: [], e: [] };
    g.scores.push(r.score); g.e.push([r.score, e]); por.set(fr.gremio, g);
  }
  const gs = [...por.values()].map(g => { const top = g.e.sort((a, b) => b[0] - a[0]).slice(0, 3); return { gremio: g.gremio, nombre: g.nombre, score: Math.round(top.reduce((a, b) => a + b[0], 0) / top.length), mejores: top.map(t => t[1]) }; }).sort((a, b) => b.score - a.score);
  return { score: gs.length ? gs[0].score : 0, mejor: gs[0] || null, gremios: gs };
}
/* serie de días: pasado (con datos reales) y futuro (previsión) */
export function serie(fn, hoyISO, atras = 7, adelante = 10, dias = {}) {
  const out = [];
  for (let d = -atras; d <= adelante; d++) {
    const f = sumaDias(hoyISO, d), r = fn(f), dd = dias[f];
    out.push({ f, d, score: r ? r.score : null, r, prevision: d >= 0, p: dd ? dd.p : null, tmax: dd ? dd.tmax : null, tmin: dd ? dd.tmin : null });
  }
  return out;
}
export function mejorDia(s) { const fut = s.filter(x => x.d >= 0 && x.score != null); return fut.length ? fut.reduce((a, b) => b.score > a.score ? b : a) : null; }

/* ---------- aprendizaje con tus salidas ----------
   Cada visita a un spot es un ejemplo: ¿encontraste algo? (1/0) y qué puntuaba el modelo ese día.
   Se ajusta una recta en escala logit (calibración de Platt) con un anclaje fuerte a «el modelo tal cual»: con pocos datos casi no se mueve. */
const sg = z => 1 / (1 + Math.exp(-z)), lg = p => Math.log(cl(p) / (1 - cl(p)));
const EPS = 0.03;
export function ajustar(ej, lambda = 6) {
  let a = 1, b = 0; if (!ej.length) return { a, b, n: 0 };
  const xs = ej.map(e => lg(Math.max(EPS, Math.min(1 - EPS, e.s / 100)))), ys = ej.map(e => e.y ? 1 : 0);
  for (let it = 0; it < 400; it++) {
    let ga = lambda * (a - 1), gb = lambda * b;
    for (let i = 0; i < xs.length; i++) { const err = sg(a * xs[i] + b) - ys[i]; ga += err * xs[i]; gb += err; }
    a -= 0.05 * ga / (ej.length + lambda); b -= 0.05 * gb / (ej.length + lambda);
  }
  return { a: Math.round(a * 1000) / 1000, b: Math.round(b * 1000) / 1000, n: ej.length };
}
export const aplicarCal = (crudo, cal) => !cal || !cal.n ? crudo : 100 * sg(cal.a * lg(Math.max(EPS, Math.min(1 - EPS, crudo / 100))) + cal.b);

/* Tasa de acierto: ¿los días con puntuación alta fueron los de éxito? ej = [{s, y}] */
export function aciertos(ej) {
  const n = ej.length, pos = ej.filter(e => e.y).length, alto = ej.filter(e => e.s >= 60), bajo = ej.filter(e => e.s < 40), medio = ej.filter(e => e.s >= 40 && e.s < 60);
  const tasa = a => a.length ? Math.round(100 * a.filter(e => e.y).length / a.length) : null;
  /* AUC: probabilidad de que una visita con éxito puntúe más que una sin éxito (0,5 = azar, 1 = perfecto) */
  let auc = null; const P = ej.filter(e => e.y), N = ej.filter(e => !e.y);
  if (P.length && N.length) { let w = 0; P.forEach(p => N.forEach(q => { w += p.s > q.s ? 1 : p.s === q.s ? 0.5 : 0; })); auc = Math.round(100 * w / (P.length * N.length)) / 100; }
  return { n, exitos: pos, base: n ? Math.round(100 * pos / n) : null, alto: { n: alto.length, tasa: tasa(alto) }, medio: { n: medio.length, tasa: tasa(medio) }, bajo: { n: bajo.length, tasa: tasa(bajo) }, auc };
}
export { MESES, iso, difDias };
