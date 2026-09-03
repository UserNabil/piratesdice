# srv/src/config.js

Ecart avec le lot : nb_fonctions=2. Recompte manuel : 2 (`int`, `str`). Conforme.

## a) Fonctions
| nom | ligne |
|-----|-------|
| int | 3 |
| str | 10 |

## b) Par fonction
| nom | role | risques | statut |
|-----|------|---------|--------|
| int(name,def) | lit une var d'env en entier, sinon `def` | `parseInt` + `Number.isFinite` -> retombe sur `def` si absent/vide/non numerique ; jamais NaN, jamais d'exception | OK |
| str(name,def) | lit une var d'env en chaine, sinon `def` | vide/absent -> `def` ; pas d'exception | OK |

## Analyse detaillee
- Construction pure d'un objet de config depuis l'environnement, aucune I/O, aucun async.
- **Secrets** : `secret` et `db.password` par defaut a '' (fournis par l'environnement).
  Pas de secret EN CLAIR dans le fichier. `appleAudience` par defaut
  'com.nabil.piratesdice' = identifiant public de bundle, pas un secret.
  Un `secret`/`password` vide est un risque de DEPLOIEMENT (auth desactivee cote
  verifyToken), pas une faille de code ; documente par les commentaires.
- `db` fixe `max:8`, `idleTimeoutMillis:30000`, `connectionTimeoutMillis:8000` —
  bornes de pool saines (cf. db.js).

## c) Findings
Aucune faille.

## Statut : OK
