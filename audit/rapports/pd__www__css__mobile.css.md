# Audit — pd/www/css/mobile.css

Fichier : `/Users/develop/piratesdice/www/css/mobile.css` — 3310 lignes.

**0 fonction — feuille de style statique** (surcouche responsive : bureau, portrait, paysage large, écrans < 400 px ; empile les media queries).

Risques évidents : **aucun**.
- `border-image-source`/`background: url(...)` pointent des images locales (`../dice/img/*.png`, lignes 670, 678, 688, 721) ; `filter: url(#pd-cerne)` / `url(#pd-cerne-gros)` (lignes 2808, 3241) = filtres SVG locaux (fragments).
- Pas de secret, pas de `@import`, pas de `data:`/`javascript:`/`expression()`, aucun hôte distant.
