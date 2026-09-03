# Audit — pd/www/js/core/dom.js (12 lignes)

Fichier lu en entier. Lot annonce **3 fonctions**, **3 trouvées** (écart 0).

## (a) Fonctions

| nom | ligne |
|---|---|
| $ | 9 |
| esc | 11 |
| (arrow) remplaceur `(c) => ({...}[c])` | 12 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| $ | raccourci `document.querySelector(s)` | si `s` est un sélecteur invalide → `SyntaxError` (usage interne, appelants passent des littéraux) | OK |
| esc | échappe une chaîne pour insertion HTML | **n'échappe PAS l'apostrophe `'`** — voir finding | FAILLE |
| arrow l.12 | table de remplacement `&<>"` | complet pour les 4 caractères visés | OK |

## (c) Findings

- **dom.js:11-12 | état incohérent (injection/XSS latente)** | `.replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]))` | `esc` est la primitive d'échappement partagée par tout le jeu, mais elle ne traite pas l'apostrophe. Une valeur échappée insérée dans un attribut délimité par des apostrophes (`attr='...'`) laisse un `'` de la donnée refermer l'attribut et injecter (`onerror=`, etc.). Les gabarits de `dice.js` utilisent des guillemets doubles (couverts par `&quot;`), mais la primitive elle-même est incomplète : tout appelant présent ou futur qui délimite un attribut par apostrophes est vulnérable. Gravité : état incohérent / faille potentielle.

**Verdict : FAILLES(1) [état incohérent]**
