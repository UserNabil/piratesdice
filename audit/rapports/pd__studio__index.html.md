# Audit — pd/studio/index.html

Fichier : `/Users/develop/piratesdice/studio/index.html` — 50 lignes.

**0 fonction — page HTML statique** (coque du studio : panneau de réglages + `<iframe>` d'aperçu). Charge `/__studio/studio.css` et `/__studio/studio.js` (script externe, aucun JS inline).

Risques évidents : **aucun**.
- Pas de secret en clair, pas de contenu utilisateur interpolé.
- `<iframe src="/apercu">` pointe une route locale du même serveur (127.0.0.1), pas de source externe.
- Les `<option value>` du sélecteur d'écran/contenu sont des littéraux fixes.
