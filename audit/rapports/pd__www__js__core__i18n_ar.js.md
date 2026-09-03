# Audit — pd/www/js/core/i18n_ar.js (2328 lignes)

**0 fonction — catalogue de traduction ARABE (RTL)** (`export const AR = { 'clé': 'texte', ... };`). Fichier de DONNÉES ; déclenche `dir="rtl"` via i18n.js (isRTL). Parcouru par tranches + grep ciblé.

## Risques évidents

- **Secrets : aucun.** Aucun `https://`, `token`, `secret`, clé ou mot de passe dans les valeurs (le seul backtick est dans un commentaire, l.683).
- **HTML intentionnel dans les valeurs** (`<b>…</b>` : `rules.2` l.702, `rules.3`, `rules.5`, `rules.7`) destiné à `innerHTML`. Statique, sans entrée utilisateur. **Attention combinée** avec la substitution non échappée de `t()` (i18n.js:86). Voir rapport i18n.js.
- Contenu RTL : correct, dépend de `dir="rtl"` posé par `stamp()` (i18n.js). Pas de risque de code.
- Pas d'`eval`, `<script`, ni handler inline dans les valeurs.

**Verdict : OK** (données ; risque réel logé dans i18n.js).
