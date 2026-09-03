# Audit — pd/www/js/core/i18n_es.js (2336 lignes)

**0 fonction — catalogue de traduction ESPAGNOL** (`export const ES = { 'clé': 'texte', ... };`). Fichier de DONNÉES ; clés absentes → repli anglais. Parcouru par tranches + grep ciblé.

## Risques évidents

- **Secrets : aucun.** Les `secreto(s)` sont du dialogue de jeu (`say.*`). Aucun `https://`, clé, mot de passe ou jeton dans les valeurs.
- **HTML intentionnel dans les valeurs** (`<b>…</b>` : `rules.2` l.700, `rules.3`, `rules.5`, `rules.7`) destiné à `innerHTML`. Statique, sans entrée utilisateur. **Attention combinée** avec la substitution non échappée de `t()` (i18n.js:86). Voir rapport i18n.js.
- Pas d'`eval`, `<script`, ni handler inline dans les valeurs.

**Verdict : OK** (données ; risque réel logé dans i18n.js).
