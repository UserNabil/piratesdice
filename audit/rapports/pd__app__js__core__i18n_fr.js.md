# Audit — pd/app/js/core/i18n_fr.js (2395 lignes)

**0 fonction — catalogue de traduction FRANÇAIS** : `export const FR = { 'clé': 'texte', ... };`. Fichier de DONNÉES pur ; clés absentes retombent sur l'anglais. Parcouru par tranches + grep ciblé.

## Risques évidents

- **Secrets : aucun.** Les occurrences de « secret » (l.1200, 1402, 1438, 1563, 1598, 1609, 1629, 1644, 1678, 1837, 1884, 1963, 2076, 2311) sont des répliques de personnages, pas des identifiants. Aucun URL, token, clé ou mot de passe.
- **Aucun construct de code** : pas de `function`, `=>`, `eval(`, `new Function`, `<script`, `javascript:`, ni handler inline dans les valeurs.
- **HTML intentionnel dans 4 valeurs** — `<b>…</b>` : `rules.2` (l.707), `rules.3` (l.708), `rules.5` (l.711, `<b>{n}</b>`), `rules.7` (l.715). Destinées à `innerHTML`. Statiques, sans entrée utilisateur.
- **Substitution non échappée** : placeholders `{n}`, `{name}`, `{code}`, `{trait}`, `{total}` (ex. `fx.foeTrait` l.29 `'{name} : {trait}'`, `room.invitation` l.75 `'... Code : {code}'`). Remplacés sans échappement par `t()` (core/i18n.js:86). Risque XSS réel logé dans i18n.js + appelants, pas dans ce fichier de données.

**Verdict : OK** (données ; risque réel logé dans i18n.js / appelants).
