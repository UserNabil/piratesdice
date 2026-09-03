# Audit — pd/app/js/core/i18n_ar.js (2328 lignes)

**0 fonction — catalogue de traduction ARABE (RTL)** : `export const AR = { 'clé': 'texte', ... };`. Fichier de DONNÉES pur. Parcouru par tranches + grep ciblé (constructs de code, secrets, balises HTML, placeholders).

## Risques évidents

- **Secrets : aucun.** Aucun `https://`, `token`, `secret` réel, clé ou mot de passe. Les seuls mots « secret » sont dans des répliques de personnages (données de jeu), pas des identifiants. En-tête = commentaire descriptif RTL.
- **Aucun construct de code** : pas de `function`, `=>`, `eval(`, `new Function`, `<script`, `javascript:`, ni handler inline (`onclick`/`onerror`) dans les valeurs.
- **HTML intentionnel dans 4 valeurs** — `<b>…</b>` : `rules.2` (l.702), `rules.3` (l.703), `rules.5` (l.706, contient `<b>{n}</b>`), `rules.7` (l.710). Destinées à `innerHTML`. Contenu statique, sans entrée utilisateur → inoffensif tel quel.
- **Substitution non échappée** : de nombreuses valeurs portent des placeholders `{n}`, `{name}`, `{code}`, `{trait}`, `{total}` (ex. `fx.foeTrait` l.30 `'{name}: {trait}'`, `room.invitation` l.76 `'... الرمز: {code}'`). Ils sont remplacés par `String(vars[...])` sans échappement dans `t()` (core/i18n.js:86). **Le risque XSS réel n'est PAS dans ce fichier de données** mais dans i18n.js + les appels qui injectent le résultat via `innerHTML` avec un `{name}` d'origine adverse. Voir rapport de core/i18n.js.

**Verdict : OK** (données ; risque réel logé dans i18n.js / appelants).
