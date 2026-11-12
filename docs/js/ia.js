/* Reconocer con IA (Gemini). La clave NO está en el repo: la pega Jon en este móvil y solo vive aquí (localStorage).
   Es una pista orientativa: nunca certifica especie ni comestibilidad, y se abstiene si las fotos no bastan. */
import * as cat from './catalog.js';
import { reducirFoto } from './util.js';

export const MODELOS = ['gemini-2.5-flash', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'];
const KEY = 'mi_gemini_key';
export const getKey = () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
export const setKey = k => { try { k ? localStorage.setItem(KEY, k.trim()) : localStorage.removeItem(KEY); } catch (e) { } };
export const claveValida = k => /^AIza[\w-]{30,}$/.test((k || '').trim());

const SCHEMA = { type: 'OBJECT', properties: {
  esSeta: { type: 'BOOLEAN' },
  calidad: { type: 'STRING', enum: ['buena', 'regular', 'mala'] },
  candidatas: { type: 'ARRAY', maxItems: 3, items: { type: 'OBJECT', properties: {
    id: { type: 'STRING' }, nombreCientifico: { type: 'STRING' }, nombreComun: { type: 'STRING' },
    confianza: { type: 'INTEGER', minimum: 0, maximum: 100 }, rasgosVistos: { type: 'STRING' } },
    required: ['id', 'nombreCientifico', 'nombreComun', 'confianza', 'rasgosVistos'] } },
  faltaVer: { type: 'STRING' }
}, required: ['esSeta', 'calidad', 'candidatas', 'faltaVer'] };

export function prompt(especies) {
  const lista = especies.map(e => e.id + ' | ' + e.nombreCientifico.split(' (')[0] + ' | ' + ((e.nombresComunes && e.nombresComunes.es && e.nombresComunes.es[0]) || '')).join('\n');
  return 'Eres un micólogo prudente. Te paso 1 a 3 fotos de la MISMA seta (sombrero, láminas/poros, base del pie) hechas en España.\n' +
    'Esta es la colección de la persona (id | nombre científico | nombre común):\n' + lista + '\n\n' +
    'Devuelve SOLO JSON con: esSeta, calidad (de las fotos: buena/regular/mala), candidatas (como máximo 3, de más a menos probable) y faltaVer.\n' +
    'Para cada candidata: si es de la colección, copia su id EXACTO de la lista; si no lo es, id vacío "" y pon su nombre científico y común reales. confianza 0-100. rasgosVistos: solo lo que se VE en las fotos, en una frase corta.\n' +
    'Reglas: no inventes rasgos que no se vean (color, láminas, anillo, volva, base). Si las fotos no bastan para decidir, devuelve candidatas con confianza baja o una lista vacía, y en faltaVer di qué foto o rasgo haría falta (p. ej. «la base del pie con la volva», «las láminas por debajo»). Si hay especies tóxicas parecidas, inclúyelas entre las candidatas. No hables de si se puede comer. Si no es una seta, esSeta=false.';
}

/* Valida y limpia lo que devuelve el modelo: un id que no esté en el catálogo pasa a «no está en tu colección». */
export function limpiar(r, especies) {
  const ids = new Set(especies.map(e => e.id));
  if (!r || typeof r.esSeta !== 'boolean') throw new Error('respuesta no válida');
  const txt = (s, n) => (typeof s === 'string' ? s.trim().slice(0, n) : '');
  const cands = (Array.isArray(r.candidatas) ? r.candidatas : []).slice(0, 3).map(c => ({
    id: ids.has(c && c.id) ? c.id : '', nombreCientifico: txt(c && c.nombreCientifico, 120), nombreComun: txt(c && c.nombreComun, 120),
    confianza: Math.max(0, Math.min(100, Number.isInteger(c && c.confianza) ? c.confianza : 0)), rasgos: txt(c && c.rasgosVistos, 240)
  })).filter(c => c.id || c.nombreCientifico);
  return { esSeta: r.esSeta, calidad: ['buena', 'regular', 'mala'].includes(r.calidad) ? r.calidad : 'regular', candidatas: r.esSeta ? cands : [], faltaVer: txt(r.faltaVer, 300) };
}

const b64 = blob => new Promise((ok, ko) => { const f = new FileReader(); f.onload = () => ok(String(f.result).split(',')[1]); f.onerror = ko; f.readAsDataURL(blob); });

export async function reconocer(files, { key = getKey(), fetchImpl = fetch } = {}) {
  const especies = cat.todas();
  if (!key) throw new Error('sin-clave');
  const partes = [{ text: prompt(especies) }];
  for (const f of files) partes.push({ inline_data: { mime_type: 'image/jpeg', data: await b64(await reducirFoto(f, 1024, 0.7)) } });
  let ultimo = 'red';
  for (let i = 0; i < MODELOS.length; i++) {
    const m = MODELOS[i], ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 25000);
    try {
      const res = await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, signal: ctl.signal,
        body: JSON.stringify({ contents: [{ parts: partes }], generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.4, maxOutputTokens: 1024,
          thinkingConfig: m.startsWith('gemini-2.5') ? { thinkingBudget: 0 } : { thinkingLevel: 'minimal' } } })
      });
      if (res.status === 400 || res.status === 403) throw Object.assign(new Error('clave'), { fatal: true });
      if (!res.ok) { ultimo = 'http-' + res.status; continue; }
      const body = await res.json(), c = body.candidates && body.candidates[0];
      if (!c || c.finishReason !== 'STOP') { ultimo = 'incompleta'; continue; }
      return limpiar(JSON.parse(c.content.parts.filter(p => !p.thought).map(p => p.text || '').join('')), especies);
    } catch (e) { if (e.fatal) throw e; ultimo = e.name === 'AbortError' ? 'tiempo' : 'red'; }
    finally { clearTimeout(t); }
  }
  throw new Error(ultimo);
}
export const mensajeError = e => ({ 'sin-clave': 'Falta la clave de Gemini (Ajustes).', clave: 'Google no acepta la clave: revísala en Ajustes.', red: 'No hay conexión. Prueba cuando tengas cobertura.', tiempo: 'Ha tardado demasiado. Prueba otra vez.' }[e && e.message] || 'No se ha podido reconocer ahora. Prueba más tarde.');
