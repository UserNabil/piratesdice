# Audit — pd/app/js/core/i18n_es.js (2336 lignes)

**0 fonction — catalogue de traduction ESPAGNOL** : `export const ES = { 'clé': 'texte', ... };`. Fichier de DONNÉES pur ; clés absentes retombent sur l'anglais. Parcouru par tranches + grep ciblé.

## Risques évidents

- **Secrets : aucun.** Les occurrences de « secreto » (l.1154, 1356, 1392, 1517, 1552, 1583, 1598, 1632, 1791, 1838, 1917, 2030, 2265) sont des répliques de personnages, pas des identifiants. Aucun URL, token, clé ou mot de passe.
- **Aucun construct de code** : pas de `function`, `=>`, `eval(`, `new Function`, `<script`, `javascript:`, ni handler inline dans les valeurs.
- **HTML intentionnel dans 4 valeurs** — `<b>…</b>` : `rules.2` (l.700), `rules.3` (l.701), `rules.5` (l.704, `<b>{n}</b>`), `rules.7` (l.708). Destinées à `innerHTML`. Statiques, sans entrée utilisateur.
- **Substitution non échappée** : placeholders `{n}`, `{name}`, `{code}`, `{trait}`, `{total}` (ex. `fx.foeTrait` l.28, `room.invitation` l.74). Remplacés sans échappement par `t()` (core/i18n.js:86). Risque XSS réel logé dans i18n.js + appelants, pas dans ce fichier de données.

**Verdict : OK** (données ; risque réel logé dans i18n.js / appelants).
