# Audit — pd/www/css/dice.css

Fichier : `/Users/develop/piratesdice/www/css/dice.css` — 4139 lignes.

**0 fonction — feuille de style statique** (feuille partagée principale : jetons, plateau, dés, effets ; source non modifiée par le studio).

Risques évidents : **aucun**.
- Toutes les `url(...)` pointent des images locales (`../dice/img/*.png|jpg` ou `/dice/img/*.png`) — aucun hôte distant (lignes 1505, 1891, 2799, 2807, 2815, 3316, 3345).
- Pas de secret, pas de `@import`, pas de `data:`/`javascript:`/`expression()`.
