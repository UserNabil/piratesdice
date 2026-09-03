# Rapport d'audit — `pd/outils/noms.py`

Outil de contrôle (lint maison) : détecte les noms appelés comme fonctions mais
jamais déclarés/importés, et les accents graves qui cassent un template literal.
Lancé sur `www/js` et `app/js`.

## a) Fonctions (nom | ligne)
- nettoyer | 59
- declares | 67
- fautes | 100
- gabarits_casses | 116
- main | 165

5 fonctions — conforme au lot (5).

## b) Par fonction
| nom | rôle | risques | statut |
|-----|------|---------|--------|
| nettoyer | Retire chaînes et commentaires (garde les \n) | regex bornées | OK |
| declares | Recense tous les noms déclarés du fichier | regex ; heuristique volontairement large | OK |
| fautes | Liste les appels à des noms inconnus | `open(...).read()` sans `with` ; **UnicodeDecodeError sur un .js non-utf8 → interrompt tout le scan** | OK (voir note) |
| gabarits_casses | Détecte accent grave dans commentaire HTML d'un gabarit | scan char-par-char borné ; expression de n° de ligne morte (cosmétique) | OK |
| main | Parcourt les .js, agrège les fautes | propage l'UnicodeDecodeError des deux fonctions ci-dessus | OK (voir note) |

## c) Findings détaillés
Aucune faille bloquante.

- `noms.py:101` et `noms.py:134` — cosmétique / robustesse faible :
  `open(chemin, encoding="utf-8").read()` sans gestion. Un fichier `.js` non
  décodable en UTF-8 lèverait `UnicodeDecodeError` non attrapée et **avorterait
  le lint entier** (point 5 : le contrôle CI resterait bloqué sur un seul mauvais
  fichier). Improbable sur un dépôt tout-UTF-8, d'où gravité cosmétique.
- `noms.py:154` — cosmétique : le numéro de ligne rapporté est calculé
  `ligne + src[:i].count("\n") - src[:i].count("\n")`, soit `X - X = 0` ajouté à
  `ligne`. Le résultat vaut `ligne` (correct), mais l'expression est du code mort
  redondant (double `src[:i]` en O(n)). Aucun impact fonctionnel.
