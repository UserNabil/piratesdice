# Audit — pd/www/css/combat.css

Fichier : `/Users/develop/piratesdice/www/css/combat.css` — 1071 lignes.

**0 fonction — feuille de style statique** (réglages de l'écran de combat : plateaux, logements, jetons ; c'est le fichier que `studio.py` réécrit).

Risques évidents : **aucun**.
- Seule ressource externe au CSS : `filter: url(#pd-cerne)` (ligne 998) = référence à un filtre SVG local (fragment `#…`), pas une URL réseau.
- Pas de secret, pas de `@import`, pas de `data:`/`javascript:`/`expression()`, aucun hôte distant.
