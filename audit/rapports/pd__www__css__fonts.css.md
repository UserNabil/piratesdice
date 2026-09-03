# Audit — pd/www/css/fonts.css

Fichier : `/Users/develop/piratesdice/www/css/fonts.css` — 34 lignes.

**0 fonction — feuille de style statique** (deux `@font-face` : Luckiest Guy et Baloo 2, embarquées localement).

Risques évidents : **aucun**.
- Les `src: url('../fonts/*.woff2')` sont locaux (polices embarquées, pas de CDN) — cohérent avec l'objectif « s'ouvrir sans réseau ».
- Pas de secret, pas de source distante.
