/* Notas de voz: graba con el micrófono del móvil (MediaRecorder). El audio se guarda como un blob más (db.putBlob) y sube al repo privado con el resto. */
export const soportado = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
const mime = () => ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || '';
export async function grabar() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const m = mime(), r = new MediaRecorder(stream, m ? { mimeType: m } : undefined), parts = [], t0 = Date.now();
  const soltar = () => stream.getTracks().forEach(t => t.stop());
  r.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
  r.start(1000);
  return {
    seg: () => Math.round((Date.now() - t0) / 1000),
    stop: () => new Promise(ok => { r.onstop = () => { soltar(); ok(new Blob(parts, { type: (r.mimeType || m || 'audio/webm').split(';')[0] })); }; r.stop(); }),
    cancel: () => { r.onstop = null; try { r.stop(); } catch (e) { } soltar(); }
  };
}
export const mmss = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
