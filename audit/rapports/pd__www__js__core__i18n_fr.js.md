# Audit — pd/www/js/core/i18n_fr.js (2395 lignes)

**0 fonction — catalogue de traduction FRANÇAIS** (`export const FR = { 'clé': 'texte', ... };`). Fichier de DONNÉES ; les clés absentes retombent sur l'anglais. Parcouru par tranches + grep ciblé.

## Risques évidents

- **Secrets : aucun.** Aucun `https://`, `token`, `secret`, clé ou mot de passe dans les valeurs (les backticks n'apparaissent que dans des commentaires de code, ex. l.688).
- **HTML intentionnel dans les valeurs** (`<b>…</b>` : `rules.2` l.707, `rules.3`, `rules.5`, `rules.7`) destiné à `innerHTML`. Statique, sans entrée utilisateur → pas d'injection en soi. **Attention combinée** avec la substitution non échappée de `t()` (i18n.js:86) pour toute clé mêlant `{var}` contrôlé et rendu `innerHTML`. Voir rapport i18n.js.
- Pas d'`eval`, `<script`, ni handler inline dans les valeurs.

**Verdict : OK** (données ; risque réel logé dans i18n.js).
