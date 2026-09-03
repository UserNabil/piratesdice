# Rapport — pd/app/js/core/dom.js

Utilitaires DOM cote application : `$` (querySelector) et `esc` (echappement HTML) — reexportes pour que le code de jeu copie de Reforged Studio (pages/dice*.js) trouve ses imports relatifs.

**Comptage** : lot = 3. Je compte 3 fonctions flechees : `$` (9), `esc` (11), et la flechee de remplacement `(c) => ({...}[c])` (12). Concorde.

## a) Liste des fonctions
- $ | 9
- esc | 11
- (flechee) remplacement de caractere `(c) => (...)` | 12

## b) Analyse par fonction
| nom | role | risques | statut |
|-----|------|---------|--------|
| $ | `document.querySelector(s)` | selecteur invalide → SyntaxError, mais usage interne a selecteurs statiques (pas d'entree hostile) | OK |
| esc | echappe `& < > "` pour insertion HTML | null-safe (`s == null ? '' : String(s)`) ; **n'echappe PAS l'apostrophe `'`** — voir note | OK |

## c) Findings
Aucune faille exploitable dans le perimetre observe.

Note (robustesse, faible) — `esc` couvre `& < > "` mais pas `'` :
```js
export const esc = (s) => (s == null ? '' : String(s))
  .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
```
Verification des appelants (grep sur `www/js/pages/*.js`) : `esc()` est utilise exclusivement en **contenu textuel** (`'<b>'+esc(t(...))+'</b>'`, `<em>${esc(nom)}</em>`) ou en **attribut a guillemets doubles** (`title="${esc(...)}"`). Dans ces deux contextes, echapper `"` suffit — l'apostrophe non echappee n'est pas exploitable. Le risque n'apparaitrait que si un futur appelant plaçait `esc()` dans un attribut a guillemets **simples** (`attr='${esc(x)}'`) ; ajouter `'` a la table serait une precaution bon marche. Statut OK car aucun appelant observe n'est vulnerable.

## Statut : OK
