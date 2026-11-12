"""Ayudas para escribir las fichas. Cada dato de una ficha sale de las fuentes que se citan en ella."""
N = {}   # fichas nuevas: id -> campos
X = {}   # añadidos a fichas que ya existían: id -> campos
def q(parte, titulo, texto): return {'parte': parte, 'titulo': titulo, 'texto': texto}
def c(id, nombre, como, grav='baja'): return {'id': id, 'nombre': nombre, 'comoDistinguir': como, 'gravedad': grav}
def nueva(id, **k): N[id] = k
def extra(id, **k): X[id] = k
# Fuentes de consejos y seguridad (consultadas 2026-11-12)
RIOJA = ('Gobierno de La Rioja: Consejos para la recolección de setas', 'https://larioja.org/medio-ambiente/en/gestion-forestal-incendios-forestales/aprovechamiento-setas.files/753961-737604_CONSEJOS_recoleccion_setas.pdf')
CONSUMER = ('Consumer (Eroski): Setas: cesta, navaja… y cautela', 'https://www.consumer.es/articulo/coger-setas-cesta-navaja-cautela')
OCU = ('OCU: Mitos sobre las setas (6/10/2020)', 'https://www.ocu.org/alimentacion/alimentos/noticias/mitos-sobre-setas')
SUMMA = ('Comunidad de Madrid, SUMMA 112: Ante la mínima sospecha se debe acudir a Urgencias (18/11/2017)', 'https://www.comunidad.madrid/node/54017')
INT = ('Instituto Nacional de Toxicología (Ministerio de Justicia): Prevención de intoxicaciones, setas', 'https://www.mjusticia.gob.es/en/institucional/organismos/instituto-nacional/servicios/servicio-informacion/prevencion-intoxicaciones/setas1')
TUNI = ('Universidad de Tampere: How can wild mushrooms be harvested sustainably?', 'https://blogs.tuni.fi/enve/blogpost/how-can-wild-mushrooms-be-harvested-sustainably/')
