/* Dibujo de la seta de cada ficha, hecho a partir de sus datos (tipo de himenio, anillo, volva, red en el pie, colores),
   con la parte que se está explicando resaltada. No es una foto: es un esquema para saber DÓNDE mirar. */
import { PARTES, OTROS } from './guia.js';

const COL = [[/verde/, '#8aa364'], [/amarill|azufre|limón|dorad/, '#d8b545'], [/rojo|escarlata|granate/, '#c4442e'], [/naranja|anaranjad|salmón/, '#e0893c'],
  [/violeta|lila|amatista/, '#8a68ad'], [/blanc|crema|marfil|pálid/, '#e9e1cf'], [/gris|ceniz|plomo|negr|oscuro/, '#6c6a66'], [/oliva/, '#8b8a4c'], [/pardo|marrón|castañ|canela|ocre|tabaco|bayo|leonado|miel/, '#93613a']];
/* el color que se nombra PRIMERO en el texto (no el primero de la lista) */
const color = (t, def) => { const s = (t || '').toLowerCase(); let mejor = null, pos = 1e9; COL.forEach(([r, c]) => { const m = s.search(r); if (m >= 0 && m < pos) { pos = m; mejor = c; } }); return mejor || def; };
const txtDe = (e, p) => (e.queMirar || []).filter(q => q.parte === p).map(q => q.titulo + ' ' + q.texto).join(' ') + ' ' + (e[p] || '');
const todo = e => [e.clave, ...(e.queMirar || []).map(q => q.titulo + ' ' + q.texto), e.anillo, e.volva, e.himenio, e.reticulo].join(' ').toLowerCase();
/* Rasgos que se pueden dibujar. Si no es una seta «de sombrero y pie», no hay dibujo. */
export function rasgos(e) {
  const tipo = { laminar: 'laminas', boleto: 'poros', pliegues: 'pliegues', pinchos: 'pinchos' }[e.grupo]; if (!tipo) return null;
  const t = todo(e), sinAn = /sin anillo|ni anillo|sin anillo ni|anillo fugaz/.test(t), sinVo = /sin volva|ni volva|ni anillo ni volva/.test(t);
  const anillo = !sinAn && ((e.anillo && !/ausente|no tiene|sin/i.test(e.anillo)) || (e.queMirar || []).some(q => q.parte === 'anillo') || /\banillo\b/.test(t) && !/sin anillo/.test(t));
  const volva = !sinVo && ((e.volva && !/ausente|no tiene|sin/i.test(e.volva)) || (e.queMirar || []).some(q => q.parte === 'volva') || /^amanita/i.test(e.nombreCientifico));
  const pie = txtDe(e, 'pie').toLowerCase();
  return {
    tipo, anillo, volva, red: /\bred\b|retícul|reticul/.test(pie + ' ' + (e.reticulo || '').toLowerCase()), puntos: /puntit|punteado|puntos/.test(pie), escamas: /escam|atigrad|bandas/.test(pie),
    embudo: /embudo|copa|trompeta/.test(txtDe(e, 'sombrero').toLowerCase() + ' ' + (e.clave || '').toLowerCase()) || e.grupo === 'pliegues',
    verrugas: /verrug|placas|escamas/.test(txtDe(e, 'sombrero').toLowerCase()),
    cap: color(txtDe(e, 'sombrero'), '#a9713a'), hym: color(txtDe(e, 'himenio'), e.grupo === 'boleto' ? '#d6c46a' : '#ece4d2'), stem: color(txtDe(e, 'pie'), '#e6dcc6')
  };
}
const OSC = '#0a0f0e';
/* parts: lista de partes a resaltar (en orden: se numeran). talla: px de ancho */
export function esquemaEsp(e, parts = [], { talla = 120, num = true } = {}) {
  const r = rasgos(e); if (!r) return '';
  const on = p => parts.includes(p), apaga = parts.length ? ' opacity=".28"' : '';
  const g = (p, body) => '<g' + (parts.length && !on(p) ? apaga : '') + (on(p) ? ' class="hl" style="--h:' + (PARTES[p] || OTROS[p] || {}).color + '"' : '') + '>' + body + '</g>';
  const capY = 70, capB = r.embudo ? 62 : 74;
  /* sombrero */
  const capD = r.embudo ? 'M40 52 Q100 30 160 52 L148 64 Q100 84 52 64 Z' : 'M30 74 C28 34 64 18 100 18 C136 18 172 34 170 74 Q100 88 30 74 Z';
  let verr = ''; if (r.verrugas && !r.embudo) [[70, 36], [96, 28], [124, 34], [146, 52], [56, 56], [110, 48], [84, 50]].forEach(([x, y]) => { verr += '<circle cx="' + x + '" cy="' + y + '" r="4" fill="#f4efe2" opacity=".9"/>'; });
  /* himenio según el tipo */
  let hym = '';
  if (r.embudo) hym = '<path d="M52 64 Q100 84 148 64 L118 96 Q100 104 82 96 Z" fill="' + r.hym + '" stroke="' + OSC + '" stroke-width="1.3"/>';
  else hym = '<path d="M30 74 Q100 88 170 74 L164 84 Q100 102 36 84 Z" fill="' + r.hym + '" stroke="' + OSC + '" stroke-width="1.3"/>';
  let det = '';
  if (r.tipo === 'laminas') { for (let x = 40; x <= 160; x += 7) { const y0 = r.embudo ? 66 + (1 - Math.abs(x - 100) / 50) * 12 : 76 + (1 - Math.pow((x - 100) / 70, 2)) * 8; if (r.embudo && (x < 56 || x > 144)) continue; det += '<path d="M' + x + ' ' + y0.toFixed(1) + ' l0 ' + (r.embudo ? 14 : 8) + '" stroke="#5a4a32" stroke-width="1.6" opacity=".7"/>'; } }
  else if (r.tipo === 'poros') { for (let x = 42; x <= 158; x += 8) for (const dy of [0, 4]) { const y0 = 79 + (1 - Math.pow((x - 100) / 70, 2)) * 8 + dy; det += '<circle cx="' + (x + dy) + '" cy="' + y0.toFixed(1) + '" r="1.6" fill="#6b5a2a" opacity=".75"/>'; } }
  else if (r.tipo === 'pliegues') { for (let x = 60; x <= 140; x += 9) det += '<path d="M' + x + ' 70 Q' + (x + (100 - x) * .35) + ' 84 ' + (x + (100 - x) * .62) + ' 98" stroke="#7a5a2a" stroke-width="1.4" fill="none" opacity=".7"/>'; }
  else if (r.tipo === 'pinchos') { for (let x = 42; x <= 158; x += 6) { const y0 = 78 + (1 - Math.pow((x - 100) / 70, 2)) * 8; det += '<path d="M' + x + ' ' + y0.toFixed(1) + ' l1.5 7 l1.5 -7" fill="#c9a777" stroke="#7a5a2a" stroke-width=".6"/>'; } }
  /* pie */
  const pieTop = r.embudo ? 96 : 84;
  let pieDet = '';
  if (r.red) for (let y = pieTop + 8; y < 168; y += 9) pieDet += '<path d="M86 ' + y + ' l7 5 l7 -5 l7 5 l7 -5" stroke="#6b5a3a" stroke-width="1" fill="none" opacity=".6"/>';
  if (r.puntos) for (let y = pieTop + 8; y < 168; y += 7) for (let x = 88; x <= 112; x += 6) pieDet += '<circle cx="' + (x + (y % 2) * 3) + '" cy="' + y + '" r="1.3" fill="#c4442e"/>';
  if (r.escamas) for (let y = pieTop + 10; y < 160; y += 11) pieDet += '<path d="M86 ' + y + ' q7 -4 14 0 q7 4 14 0" stroke="#7a5a32" stroke-width="1.4" fill="none" opacity=".6"/>';
  const pie = '<path d="M86 ' + pieTop + ' L84 168 Q82 176 84 184 L116 184 Q118 176 116 168 L114 ' + pieTop + ' Z" fill="' + r.stem + '" stroke="' + OSC + '" stroke-width="1.3"/>' + pieDet;
  const anillo = r.anillo ? '<path d="M85 ' + (pieTop + 16) + ' Q100 ' + (pieTop + 22) + ' 115 ' + (pieTop + 16) + ' L122 ' + (pieTop + 30) + ' Q100 ' + (pieTop + 40) + ' 78 ' + (pieTop + 30) + ' Z" fill="#f3eee2" stroke="' + OSC + '" stroke-width="1.2"/>' : '';
  const volva = r.volva ? '<path d="M70 196 C66 176 76 168 86 172 L114 172 C124 168 134 176 130 196 Z" fill="#e4dac0" stroke="' + OSC + '" stroke-width="1.2"/><path d="M86 172 Q93 166 100 172 Q107 166 114 172" stroke="' + OSC + '" stroke-width="1" fill="none"/>' : '';
  /* carne: medio corte a la izquierda */
  const carne = on('carne') ? '<path d="M30 74 C28 34 64 18 100 18 L100 88 Q64 84 30 74 Z" fill="#efe3cf" stroke="' + OSC + '" stroke-width="1"/><path d="M86 ' + pieTop + ' L84 168 Q82 176 84 184 L100 184 L100 ' + pieTop + ' Z" fill="#efe3cf"/>' : '';
  const suelo = '<rect x="0" y="190" width="200" height="40" fill="#18231f"/><path d="M0 190H200" stroke="#2c3d37" stroke-width="1.5"/>';
  /* números junto a las partes resaltadas */
  const POS = { sombrero: [176, 40], cutis: [176, 30], himenio: [178, r.embudo ? 84 : 86], pie: [134, 150], anillo: [138, pieTop + 26], volva: [146, 186], carne: [16, 50] };
  const marcas = num ? parts.filter(p => POS[p] && (p !== 'anillo' || r.anillo) && (p !== 'volva' || r.volva)).map((p, i) => { const [x, y] = POS[p], c = (PARTES[p] || OTROS[p]).color; return '<g class="nm"><circle cx="' + x + '" cy="' + y + '" r="10" fill="' + c + '" stroke="' + OSC + '" stroke-width="2"/><text x="' + x + '" y="' + (y + 4) + '" text-anchor="middle" font-size="12" font-weight="800" fill="' + OSC + '">' + (parts.length > 1 ? i + 1 : '!') + '</text></g>'; }).join('') : '';
  return '<svg class="esq-sp" viewBox="0 0 200 230" width="' + talla + '" role="img" aria-label="Esquema: ' + (parts.join(', ') || 'seta') + '">' + suelo +
    g('volva', volva) + g('pie', pie) + g('anillo', anillo) + g('himenio', hym + det) + g(parts.includes('cutis') ? 'cutis' : 'sombrero', '<path d="' + capD + '" fill="' + r.cap + '" stroke="' + OSC + '" stroke-width="1.5"/>' + verr) +
    (carne ? '<g class="hl" style="--h:' + PARTES.carne.color + '">' + carne + '</g>' : '') + marcas + '</svg>';
}
/* partes que nombra un texto (para la regla clave) */
const PAL = [['volva', /volva|bolsa en la base|desentierr/], ['anillo', /anillo/], ['himenio', /lámina|poro|pliegue|pincho|envés|tubos/], ['pie', /\bpie\b|red\b|retículo|puntitos/], ['carne', /carne|azulea|al cortar|leche/], ['sombrero', /sombrero|verrug|mamelón|placas/]];
export const partesDe = t => { const s = (t || '').toLowerCase(); return PAL.filter(([, r]) => r.test(s)).map(([p]) => p).filter(p => !new RegExp('sin ' + p).test(s) || p === 'volva' || p === 'anillo'); };
