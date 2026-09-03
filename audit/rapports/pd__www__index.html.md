# Audit — pd/www/index.html

Fichier : `/Users/develop/piratesdice/www/index.html` — 21 lignes.

**0 fonction — page HTML statique** (coquille de l'application : charge les 4 CSS puis `js/boot.js` en module). Un `<script>` inline pose `window.PD_CONFIG = { server: 'https://dice.my-officeapps.com', build: 'dev' }`.

Risques évidents :
- **Pas de secret** dans la config (URL publique du serveur, pas de clé/token).
- Note mineure (cosmétique) : `build: 'dev'` est codé en dur dans le fichier servi ; s'il part tel quel en production, le client s'annonce comme build « dev ». C'est une donnée de configuration, pas une faille — à vérifier que la chaîne de build la remplace.
- `viewport` avec `user-scalable=no, maximum-scale=1` : choix d'ergonomie (bloque le zoom), sans impact sécurité.
