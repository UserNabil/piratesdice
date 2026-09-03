# Audit — pd/studio/apercu.html

Fichier : `/Users/develop/piratesdice/studio/apercu.html` — 154 lignes.
Nature : page HTML de démonstration du plateau (aperçu du studio), avec un `<script type="module">` inline.
Fonctions annoncées : 0 (métrique sur .html). **Écart : le script inline contient 1 fonction nommée `plateau` + callbacks fléchés.** Signalé, pas bloquant.

## a) Liste des fonctions

| nom | ligne |
|-----|-------|
| plateau | 72 |
| callback `colonnes.forEach((colonne,i)=>…)` | 82 |
| callback `(colonne.des).forEach((de)=>…)` | 99 |
| callback `import(...).then((fit)=>…)` | 151 |

## b) Analyse fonction par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| plateau | construit le DOM d'un plateau (cadre + 3 colonnes + rangée de plaques) à partir d'`opts` | pas de garde sur `opts.colonnes`/`opts.scores` — mais appelé uniquement avec des littéraux internes, aucune entrée client | OK |
| forEach colonnes | crée une plaque + colonne par entrée | idem, données statiques | OK |
| forEach des | crée les cases et l'`<img>` du dé | `de.valeur` injecté dans `src` par concaténation, mais valeurs = littéraux numériques (pas d'entrée externe) | OK |
| import().then | démarre la mesure fit.js | **pas de `.catch()`** sur le `import()` dynamique ni sur `startFitting()` | FAILLE (cosmétique) |

## c) Findings détaillés

### F1 — import dynamique sans .catch()
`studio/apercu.html:151`
```javascript
import('/js/fit.js').then((fit) => fit.startFitting());
```
Gravité : **cosmétique**.
Si `/js/fit.js` est absent/injoignable, ou si `startFitting()` lève, la promesse rejetée est non gérée : seule une erreur console apparaît, l'aperçu s'affiche sans la mesure de case (le studio réglerait alors sur une taille non représentative — c'est justement ce que le commentaire ligne 149-150 met en garde). Page de dev, impact limité, mais un `.catch()` afficherait pourquoi l'aperçu « ment ».

Note : la seule entrée externe est `location.search` (`?fin`) lue via `URLSearchParams(...).has('fin')` (ligne 131) — booléen, sans risque d'injection. Les `innerHTML` (lignes 105, 133-135) n'utilisent que des littéraux, pas de contenu utilisateur.
