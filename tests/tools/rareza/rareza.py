"""Rareza de cada seta (común · poco común · raro · legendario): lo fácil que es encontrársela en Bizkaia.
1.ª pasada: observaciones de iNaturalist en la costa cantábrica (inat.json, lo genera cuentas.py).
   ≥ 90 → común · 30–89 → poco común · 8–29 → raro · < 8 → legendario
2.ª pasada: correcciones a mano con su motivo (ajustes.json): iNaturalist sobrerrepresenta lo vistoso e infrarrepresenta lo pequeño.
Escribe en docs/data/especies.json: rareza, rarezaNota, rarezaDatos."""
import json, os
A = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(A, '..', '..', '..', 'docs', 'data', 'especies.json')
I = json.load(open(os.path.join(A, 'inat.json'))); J = json.load(open(os.path.join(A, 'ajustes.json')))
def corte(n): return 'comun' if n >= 90 else 'poco' if n >= 30 else 'raro' if n >= 8 else 'legendario'
POR = {'comun': 'Mucha gente la encuentra en la costa cantábrica: es de las que más se ven.', 'poco': 'Se ve con regularidad si vas a su sitio y en su época.', 'raro': 'Hay pocas citas en la costa cantábrica: hace falta el sitio y el momento justos.', 'legendario': 'Casi no hay citas en la costa cantábrica.'}
D = json.load(open(R)); n = {}
for e in D['especies']:
    c = I[e['id']]; r = corte(c['cant']); nota = POR[r]
    if e['id'] in J: r, nota = J[e['id']]
    e['rareza'] = r; e['rarezaNota'] = nota
    e['rarezaDatos'] = {'cantabrico': c['cant'], 'bizkaia': c['biz'], 'espana': c['esp'], 'europa': c['eu'], 'fuente': 'iNaturalist', 'consulta': '2026-11-15'}
    n[r] = n.get(r, 0) + 1
json.dump(D, open(R, 'w'), ensure_ascii=False, indent=1)
print(n)
