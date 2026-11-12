#!/usr/bin/env python3
"""Servidor de teselas FALSAS con aspecto de foto aérea (bosque, claros, caminos) para capturas de diseño.
Solo para mirar cómo queda la interfaz: ign.es y OSM no se alcanzan desde el entorno de pruebas.
Uso: python3 teselas.py PUERTO   →  GET /sat/{z}/{x}/{y}.png  y  /calle/{z}/{x}/{y}.png"""
import sys, io, re, numpy as np
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from PIL import Image, ImageFilter

def hsh(ix, iy, s):
    h = (ix * 374761393 + iy * 668265263 + s * 2147483647) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0

def vnoise(gx, gy, cell, s):
    x, y = gx / cell, gy / cell
    ix, iy = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64)
    fx, fy = x - ix, y - iy
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = hsh(ix, iy, s), hsh(ix + 1, iy, s)
    c, d = hsh(ix, iy + 1, s), hsh(ix + 1, iy + 1, s)
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy

def fbm(gx, gy, cell, s, oct=5):
    t, amp, n = 0, 1, 0
    for o in range(oct):
        t += amp * vnoise(gx, gy, cell / (2 ** o), s + o * 17); n += amp; amp *= .5
    return t / n

def tile(kind, z, x, y):
    j, i = np.mgrid[0:256, 0:256].astype(np.float64)
    k = 2.0 ** (z - 15)                                   # la textura escala con el zoom: parece el mismo terreno
    gx, gy = (x * 256 + i) / k, (y * 256 + j) / k
    claro = fbm(gx, gy, 900, 3)                           # claros / prados
    copas = fbm(gx, gy, 14, 9, 3)                         # copas de árboles
    ruido = fbm(gx, gy, 3, 21, 2)
    tipo = fbm(gx, gy, 1400, 5)                           # pinar (oscuro) vs hayedo (cálido)
    camino = np.abs(fbm(gx, gy, 2200, 41, 3) - .5)
    if kind == 'calle':
        img = np.zeros((256, 256, 3))
        bosque = claro < .55
        img[:] = (242, 239, 233); img[bosque] = (205, 226, 192)
        road = camino < .006 / max(k, .3) + .0025
        img[road] = (255, 255, 255)
        edge = (camino >= .006 / max(k, .3) + .0025) & (camino < .006 / max(k, .3) + .0045)
        img[edge] = (200, 196, 188)
        return Image.fromarray(img.astype(np.uint8))
    pino = np.array([28, 44, 26]); haya = np.array([62, 72, 34]); prado = np.array([118, 128, 70]); tierra = np.array([120, 104, 78])
    mezcla = np.clip((tipo - .42) * 4, 0, 1)[..., None]
    bosque = pino * (1 - mezcla) + haya * mezcla
    sombra = (copas[..., None] - .5) * 70 + (ruido[..., None] - .5) * 26
    bosque = bosque + sombra
    pr = prado + (ruido[..., None] - .5) * 30 + (copas[..., None] - .5) * 18
    m = np.clip((claro - .58) * 9, 0, 1)[..., None]
    img = bosque * (1 - m) + pr * m
    w = .004 / max(k, .25) + .0015
    cm = np.clip(1 - camino / w, 0, 1)[..., None]
    img = img * (1 - cm * .85) + tierra * cm * .85
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.6))
    return im

def foto(n):
    """Foto FALSA de seta (fondo de bosque desenfocado + silueta) para ver la maqueta; las reales vienen de Wikimedia."""
    from PIL import ImageDraw
    rng = np.random.default_rng(n); W = 320
    j, i = np.mgrid[0:W, 0:W].astype(np.float64)
    bg = np.array([[38, 52, 30], [70, 58, 40], [52, 66, 38], [80, 70, 52]])[n % 4]
    img = bg + (fbm(i + n * 999, j, 60, n, 3)[..., None] - .5) * 80
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))
    d = ImageDraw.Draw(im)
    caps = [(150, 98, 52), (196, 140, 40), (110, 70, 40), (220, 200, 170), (180, 60, 40), (60, 50, 45)]
    c = caps[n % len(caps)]; cx = W // 2 + int(rng.integers(-30, 30)); w = int(rng.integers(90, 140))
    d.rounded_rectangle([cx - 22, 150, cx + 22, 270], 18, fill=(225, 215, 190))
    d.pieslice([cx - w, 70, cx + w, 230], 180, 360, fill=c)
    return im.filter(ImageFilter.GaussianBlur(1.2))

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        f = re.match(r'/foto/(\d+)\.jpg', self.path)
        if f:
            b = io.BytesIO(); foto(int(f[1])).save(b, 'JPEG', quality=82)
            self.send_response(200); self.send_header('content-type', 'image/jpeg'); self.send_header('access-control-allow-origin', '*'); self.end_headers(); self.wfile.write(b.getvalue()); return
        m = re.match(r'/(sat|calle)/(\d+)/(\d+)/(\d+)\.png', self.path)
        if not m: self.send_response(404); self.end_headers(); return
        b = io.BytesIO(); tile(m[1], *map(int, m.groups()[1:])).save(b, 'PNG')
        self.send_response(200); self.send_header('content-type', 'image/png'); self.send_header('access-control-allow-origin', '*'); self.end_headers(); self.wfile.write(b.getvalue())

if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
