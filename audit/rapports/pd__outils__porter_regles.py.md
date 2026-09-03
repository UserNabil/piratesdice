# Rapport d'audit — `pd/outils/porter_regles.py`

Outil HORS LIGNE : copie mécaniquement les règles du serveur (`rules.js`) vers le
client (`dice_regles.js`) et échoue si la copie a dérivé. Lancé à la main / en CI.

## a) Fonctions (nom | ligne)
- convertir | 70
- main | 81

2 fonctions — conforme au lot (2).

## b) Par fonction
| nom | rôle | risques | statut |
|-----|------|---------|--------|
| convertir | Transforme le module CommonJS en module ES + `export{}` | `sys.exit` si des noms de `GARDE` sont absents de la source (garde-fou voulu) ; regex bornées | OK |
| main | `--verifier` (échoue si dérive) ou écrit la copie | `open(...).read()` / `open(...,'w').write()` sans `with` ; en CPython le fichier temporaire est fermé/vidé au drop de refcount | OK |

## c) Findings détaillés
Aucune faille. Le manque de `with` sur `open(CIBLE,'w').write(attendu)` (ligne 102)
repose sur la fermeture immédiate par refcount de CPython pour vider le tampon ;
correct sur CPython, fragile sur d'autres implémentations — gravité cosmétique
pour un outil. `--verifier` gère la source absente sans échouer (lignes 87-89).
