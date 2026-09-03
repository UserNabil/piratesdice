# Rapport d'audit — `pd/outils/orienter_des.py`

Outil HORS LIGNE : ré-oriente les faces des dés d'origine (quart de tour /
miroir) pour les accorder aux parures. Lancé à la main.

## a) Fonctions (nom | ligne)
- main | 59

1 fonction — conforme au lot (1). Les 3 entrées de `SENS` (52-56) sont des
lambdas, non comptées.

## b) Par fonction
| nom | rôle | risques | statut |
|-----|------|---------|--------|
| main | Lit chaque face, la tourne selon `--sens`, réécrit | face absente → message + `continue` ; `Image.open`/`save` fail-loud si erreur disque ; pas de concurrence ; lecture puis écriture du même fichier indépendantes | OK |

## c) Findings détaillés
Aucune faille. Entrée `--sens` bornée par `choices`. `--source` par défaut =
dossier en place : chaque face est lue puis réécrite individuellement (pas de
corruption croisée). Une écriture ratée lève un traceback, comportement voulu
pour un outil manuel.
