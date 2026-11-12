/* Temporada de cada especie: cuenta de observaciones por mes (iNaturalist, costa cantábrica) + rango que cita Wikipedia.
   Solo dice CUÁNDO se ve la especie; nunca si es segura. */
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const INI = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
export const N_MIN = 15;     // por debajo de esto la cuenta de observaciones no basta por sí sola
export const MIN_MES = 2;    // un único registro en un mes no hace temporada
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
export const mesNombre = m => cap(MESES[m - 1]);

/* Nivel 0 (nada) a 3 (pleno) para cada mes. f: 'i' = lo respalda iNaturalist, 't' = lo cita Wikipedia */
export function niveles(e) {
  const t = e.temporada || {}, ins = t.inat || { n: 0, mensual: Array(12).fill(0) }, tx = (t.texto && t.texto.meses) || [];
  const suf = ins.n >= N_MIN, mx = Math.max(1, ...ins.mensual);
  return Array.from({ length: 12 }, (_, i) => {
    const c = ins.mensual[i] || 0, enTxt = tx.includes(i + 1); let nivel = 0, f = '';
    if (suf) { const r = c / mx; if (c >= MIN_MES) { nivel = r >= .5 ? 3 : r >= .2 ? 2 : 1; f += 'i'; } if (enTxt) { f += 't'; if (!nivel) nivel = 1; } }
    else if (enTxt) { nivel = 2; f = 't'; if (c >= MIN_MES) f += 'i'; }   /* pocas observaciones: solo cuenta el rango citado, la cuenta lo apoya */
    return { nivel, f };
  });
}
export function datos(e) {
  const t = e.temporada || {}, ins = t.inat || { n: 0, mensual: [] }, tx = (t.texto && t.texto.meses) || [], suf = ins.n >= N_MIN, niv = niveles(e);
  const hay = niv.some(x => x.nivel > 0);
  const tipo = !hay ? 'ninguna' : suf && tx.length ? 'contrastada' : suf ? 'inat' : 'texto';
  let pico = null; if (suf) { const mx = Math.max(...ins.mensual); pico = ins.mensual.indexOf(mx) + 1; }
  return { hay, tipo, n: ins.n || 0, pico, niv };
}
export function barrasHTML(e, mes) {
  const d = datos(e); if (!d.hay) return '';
  return '<div class="bars" role="img" aria-label="Meses en que se ve">' + d.niv.map((x, i) => '<i class="b l' + x.nivel + (i + 1 === mes ? ' cur' : '') + '"><u></u><span>' + INI[i] + '</span></i>').join('') + '</div>';
}
export function fuenteTxt(e) {
  const d = datos(e), t = e.temporada || {}, tx = t.texto || {};
  if (!d.hay) return 'Sin datos suficientes de temporada para esta especie.';
  const pico = d.pico ? 'pico en ' + MESES[d.pico - 1] : '';
  if (d.tipo === 'contrastada') return 'Dos fuentes: ' + pico + ' (observaciones verificadas en la costa cantábrica, N=' + d.n + ') y ' + (tx.nota ? tx.nota.toLowerCase().replace(/\.$/, '') : 'rango citado por Wikipedia') + '.';
  if (d.tipo === 'inat') return 'Una fuente: ' + pico + ' según observaciones verificadas en la costa cantábrica (N=' + d.n + ').';
  return 'Orientativo, una fuente: ' + (tx.nota || 'rango citado por Wikipedia') + (d.n ? ' En la zona hay pocas observaciones verificadas (' + d.n + '), no bastan para confirmarlo.' : ' Sin observaciones verificadas en la zona.');
}
/* Especies que se ven en el mes m, de más a menos probable */
export function delMes(todas, m) {
  return todas.map(e => { const d = datos(e), x = d.niv[m - 1]; return { e, nivel: x.nivel, f: x.f, tipo: d.tipo }; }).filter(r => r.nivel > 0).sort((a, b) => b.nivel - a.nivel);
}
