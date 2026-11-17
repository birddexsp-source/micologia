/* Reconocer con IA (Gemini). La clave NO está en el repo: la pega Jon en este móvil y solo vive aquí (localStorage).
   Es una pista orientativa: nunca certifica especie ni comestibilidad, y se abstiene si las fotos no bastan. */
import * as cat from './catalog.js';
import { reducirFoto } from './util.js';
import * as db from './db.js';

export const MODELOS = ['gemini-2.5-flash', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'];
const KEY = 'mi_gemini_key';
export const getKey = () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
const loc = k => { try { k ? localStorage.setItem(KEY, k.trim()) : localStorage.removeItem(KEY); } catch (e) { } };
/* La clave se guarda en este dispositivo y también como un dato más de la sincronización (repo privado), para tener la misma en el móvil y en el PC. */
export const setKey = k => { loc(k); db.init().then(() => k ? db.set('ajustes', 'gemini', { k: k.trim() }) : (db.M.has('ajustes/gemini') ? db.remove('ajustes', 'gemini') : null)).catch(() => { }); };
/* Tras sincronizar: si otro dispositivo guardó o borró la clave, se copia aquí; si solo la tengo yo, se sube. Devuelve true si cambió algo local. */
export async function alinear() {
  try {
    await db.init(); const r = db.M.get('ajustes/gemini'), mia = getKey();
    if (r && !r.del && r.d && r.d.k) { if (r.d.k !== mia) { loc(r.d.k); return true; } return false; }
    if (r && r.del) { if (mia) { loc(''); return true; } return false; }
    if (mia) await db.set('ajustes', 'gemini', { k: mia });
  } catch (e) { }
  return false;
}
export const claveValida = k => /^(AIza[\w-]{30,}|AQ\.[\w.-]{30,})$/.test((k || '').trim());

const SCHEMA = { type: 'OBJECT', properties: {
  esSeta: { type: 'BOOLEAN' },
  calidad: { type: 'STRING', enum: ['buena', 'regular', 'mala'] },
  candidatas: { type: 'ARRAY', maxItems: 3, items: { type: 'OBJECT', properties: {
    id: { type: 'STRING' }, nombreCientifico: { type: 'STRING' }, nombreComun: { type: 'STRING' },
    confianza: { type: 'INTEGER', minimum: 0, maximum: 100 }, rasgosVistos: { type: 'STRING' },
    encaja: { type: 'STRING' }, noEncaja: { type: 'STRING' }, comprobar: { type: 'STRING' } },
    required: ['id', 'nombreCientifico', 'nombreComun', 'confianza', 'rasgosVistos', 'encaja', 'noEncaja', 'comprobar'] } },
  diferencias: { type: 'ARRAY', maxItems: 4, items: { type: 'OBJECT', properties: {
    mira: { type: 'STRING' },
    opciones: { type: 'ARRAY', maxItems: 3, items: { type: 'OBJECT', properties: { si: { type: 'STRING' }, entonces: { type: 'STRING' } }, required: ['si', 'entonces'] } } },
    required: ['mira', 'opciones'] } },
  faltaVer: { type: 'STRING' }
}, required: ['esSeta', 'calidad', 'candidatas', 'diferencias', 'faltaVer'] };

export function prompt(especies, nota) {
  /* con la regla clave de cada ficha: así la IA compara con lo mismo que lee la persona */
  const lista = especies.map(e => e.id + ' | ' + e.nombreCientifico.split(' (')[0] + ' | ' + ((e.nombresComunes && e.nombresComunes.es && e.nombresComunes.es[0]) || '') + (e.clave ? ' | ' + e.clave.slice(0, 160) : '')).join('\n');
  return 'Eres un micólogo prudente. Te paso de 1 a 4 fotos de la MISMA seta (o grupo de setas), hechas en España, en cualquier orden y encuadre: pueden ser solo del sombrero, de las láminas, del pie, la seta entera en el suelo o en el árbol, o fotos poco nítidas.\n' + (nota ? 'Dato de la persona (puede ser erróneo): ' + nota + '\n' : '') +
    'Esta es la colección de la persona (id | nombre científico | nombre común | lo que la distingue):\n' + lista + '\n\n' +
    'Devuelve SOLO JSON con: esSeta, calidad (de las fotos: buena/regular/mala), candidatas (como máximo 3, de más a menos probable), diferencias y faltaVer.\n' +
    'Para cada candidata, además: encaja = qué rasgos de las fotos apoyan esa especie; noEncaja = qué no cuadra o no se ve y haría falta (vacío si nada); comprobar = UNA comprobación física concreta, que la persona pueda hacer con la seta en la mano (mirar debajo, cortar, oler, tocar, desenterrar la base, esporada), para confirmar o descartar esa candidata frente a las otras.\n' +
    'diferencias: de 1 a 4 comprobaciones, de la más decisiva a la menos, que separen las candidatas entre sí. mira = qué hacer y dónde (p. ej. «Corta el pie a lo largo», «Mira debajo del sombrero», «Huele la carne», «Desentierra la base del pie»); opciones = lo que se puede encontrar y a qué candidata lleva (si: «la carne se vuelve azul», entonces: el nombre de la candidata, o «ninguna: no es ninguna de estas»). Usa rasgos de verdad de esas especies, no inventes. Si solo hay una candidata, compárala con su parecida más peligrosa.\n' +
    'Para cada candidata: si es de la colección, copia su id EXACTO de la lista; si no lo es, id vacío "" y pon su nombre científico y común reales. confianza 0-100. rasgosVistos: solo lo que se VE (y qué vistas hay) en las fotos, en una frase corta.\n' +
    'Reglas: no inventes rasgos que no se vean (color, láminas, anillo, volva, base). Aprovecha el hábitat y el sustrato que se vean (madera, hierba, hojarasca, árbol cercano). Si las fotos no bastan para decidir, devuelve candidatas con confianza baja o una lista vacía, y en faltaVer di qué foto o rasgo haría falta (p. ej. «la base del pie con la volva», «las láminas por debajo»). Si hay especies tóxicas parecidas, inclúyelas entre las candidatas. No hables de si se puede comer. Si no es una seta, esSeta=false.';
}

/* Valida y limpia lo que devuelve el modelo: un id que no esté en el catálogo pasa a «no está en tu colección». */
export function limpiar(r, especies) {
  const ids = new Set(especies.map(e => e.id));
  if (!r || typeof r.esSeta !== 'boolean') throw new Error('respuesta no válida');
  const txt = (s, n) => (typeof s === 'string' ? s.trim().slice(0, n) : '');
  const cands = (Array.isArray(r.candidatas) ? r.candidatas : []).slice(0, 3).map(c => ({
    id: ids.has(c && c.id) ? c.id : '', nombreCientifico: txt(c && c.nombreCientifico, 120), nombreComun: txt(c && c.nombreComun, 120),
    confianza: Math.max(0, Math.min(100, Number.isInteger(c && c.confianza) ? c.confianza : 0)), rasgos: txt(c && c.rasgosVistos, 240),
    encaja: txt(c && c.encaja, 240), noEncaja: txt(c && c.noEncaja, 240), comprobar: txt(c && c.comprobar, 240)
  })).filter(c => c.id || c.nombreCientifico);
  const dif = (Array.isArray(r.diferencias) ? r.diferencias : []).slice(0, 4).map(d => ({ mira: txt(d && d.mira, 140),
    opciones: (Array.isArray(d && d.opciones) ? d.opciones : []).slice(0, 3).map(o => ({ si: txt(o && o.si, 140), entonces: txt(o && o.entonces, 120) })).filter(o => o.si && o.entonces) })).filter(d => d.mira && d.opciones.length);
  return { esSeta: r.esSeta, calidad: ['buena', 'regular', 'mala'].includes(r.calidad) ? r.calidad : 'regular', candidatas: r.esSeta ? cands : [], diferencias: r.esSeta && cands.length ? dif : [], faltaVer: txt(r.faltaVer, 300) };
}

const b64 = blob => new Promise((ok, ko) => { const f = new FileReader(); f.onload = () => ok(String(f.result).split(',')[1]); f.onerror = ko; f.readAsDataURL(blob); });

/* Llama a Gemini con los modelos de respaldo y devuelve el texto de la respuesta. */
async function generar(partes, gen, { key = getKey(), fetchImpl = fetch, pensar = false } = {}) {
  if (!key) throw new Error('sin-clave');
  let ultimo = 'red';
  for (let i = 0; i < MODELOS.length; i++) {
    const m = MODELOS[i], ctl = new AbortController(), t = setTimeout(() => ctl.abort(), pensar ? 60000 : 30000);
    try {
      const res = await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, signal: ctl.signal,
        body: JSON.stringify({ contents: [{ parts: partes }], generationConfig: { ...gen, thinkingConfig: m.startsWith('gemini-2.5') ? { thinkingBudget: pensar ? 2048 : 0 } : { thinkingLevel: pensar ? 'low' : 'minimal' } } })
      });
      if (res.status === 403 || res.status === 400) {
        const tx = await res.text().catch(() => '');
        if (res.status === 403 || /API key|API_KEY|permission/i.test(tx)) throw Object.assign(new Error('clave'), { fatal: true });
        ultimo = 'formato'; continue;
      }
      if (!res.ok) { ultimo = 'http-' + res.status; continue; }
      const body = await res.json(), c = body.candidates && body.candidates[0];
      if (!c || c.finishReason !== 'STOP') { ultimo = 'incompleta'; continue; }
      return c.content.parts.filter(p => !p.thought).map(p => p.text || '').join('');
    } catch (e) { if (e.fatal) throw e; ultimo = e.name === 'AbortError' ? 'tiempo' : 'red'; }
    finally { clearTimeout(t); }
  }
  throw new Error(ultimo);
}
export async function reconocer(files, opts = {}) {
  const especies = cat.todas(), partes = [{ text: prompt(especies, (opts.nota || '').trim().slice(0, 120)) }];
  for (const f of files) partes.push({ inline_data: { mime_type: 'image/jpeg', data: await b64(await reducirFoto(f, 1024, 0.7)) } });
  const txt = await generar(partes, { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.3, maxOutputTokens: 8192 }, { ...opts, pensar: true });
  let r; try { r = JSON.parse(txt); } catch (e) { throw new Error('incompleta'); }
  return limpiar(r, especies);
}
/* Transcribe una nota de voz (castellano, a veces con palabras en euskera). Solo texto: no interpreta ni resume. */
export async function transcribir(blob, opts = {}) {
  const prompt_ = { text: 'Transcribe literalmente este audio (castellano; puede haber palabras en euskera o nombres de setas). Devuelve SOLO el texto transcrito, sin comentarios. Si no se entiende nada, devuelve una cadena vacía.' };
  const mime = (blob.type || 'audio/webm').split(';')[0], data = await b64(blob);
  /* el móvil a veces graba en MP4 (iPhone, algunos Android): si Google rechaza ese tipo, se reintenta como AAC */
  const tipos = /mp4|m4a/.test(mime) ? [mime, 'audio/aac'] : [mime];
  let err;
  for (const m of tipos) {
    try {
      const t = (await generar([prompt_, { inline_data: { mime_type: m, data } }], { temperature: 0, maxOutputTokens: 4096 }, opts)).trim();
      if (!t) throw new Error('vacio');
      return t.slice(0, 4000);
    } catch (e) { err = e; if (e.message !== 'formato') throw e; }
  }
  throw err;
}
export const mensajeError = e => ({ 'sin-clave': 'Falta la clave de Gemini (Ajustes).', clave: 'Google no acepta la clave: revísala en Ajustes.', red: 'No hay conexión. Prueba cuando tengas cobertura.', tiempo: 'Ha tardado demasiado. Prueba otra vez.', formato: 'Google no ha podido leer este audio.', vacio: 'No se ha entendido nada en el audio.' }[e && e.message] || 'No se ha podido reconocer ahora. Prueba más tarde.');
