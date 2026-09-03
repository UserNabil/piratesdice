# Rapport — pd/app/index.html

**0 fonction** — Page HTML statique (21 lignes) : point d'entree de l'application (charge les CSS, le conteneur `#dicewrap`, et `js/boot.js` en module).

## Fonctions
Aucune (HTML statique).

## Risques evidents
- **Placeholders de build** : ligne 18 `window.PD_CONFIG = { server: '__PD_SERVER__', build: '__PD_BUILD__' };` — jetons remplaces a la compilation par `build.py` (voir workflows). Ce ne sont pas des donnees runtime injectees par un tiers ; pas de risque XSS. Si `build.py` inserait une URL serveur non echappee contenant `'`, le script casserait — mais la source est une variable CI de confiance, pas une entree hostile.
- Aucun script externe (CDN), aucune ressource distante, aucun secret. Tout est local (`css/*`, `js/boot.js`).
- `user-scalable=no, maximum-scale=1` : choix d'accessibilite (bloque le zoom), cosmetique, hors perimetre securite.

## Statut : OK
