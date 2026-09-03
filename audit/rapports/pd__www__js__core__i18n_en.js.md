# Audit — pd/www/js/core/i18n_en.js (2270 lignes)

**0 fonction — catalogue de traduction ANGLAIS** (`export const EN = { 'clé': 'texte', ... };`). Fichier de DONNÉES, source unique copiée dans l'app par build.py. Parcouru par tranches + grep ciblé.

## Risques évidents

- **Secrets : aucun.** Les occurrences de `token`/`secret` sont du texte de dialogue de jeu (« Your secret's out, cabin boy. », `say.*`). Aucun `https://`, clé, mot de passe, ni jeton dans les valeurs (les backticks n'apparaissent que dans des commentaires).
- **HTML intentionnel dans les valeurs** (`<b>…</b>` : `rules.2` l.682, `rules.3`, `rules.5`, `rules.7`) destiné à un rendu `innerHTML`. Chaînes statiques écrites par les devs, sans entrée utilisateur → pas d'injection en soi. **Attention combinée** : la substitution `{var}` de `t()` (i18n.js:86) n'échappe pas ; toute clé mêlant un `{var}` contrôlé par un joueur et un rendu `innerHTML` devient une surface XSS. Voir le rapport i18n.js (finding l.86).
- Pas d'`eval`, pas de `<script`, pas de gestionnaire d'événement inline dans les valeurs.

**Verdict : OK** (données ; risque réel logé dans i18n.js).
