# Rapport d'audit — `pd/outils/portraits_fiche.py`

Outil HORS LIGNE : retire le liseré blanc des portraits de capitaines et cuit un
fondu dans l'alpha, en écrivant à côté (`capf_<id>.png`). Lancé à la main.

## a) Fonctions (nom | ligne)
- rampe | 111
- sans_lisere | 135
- main | 152

3 fonctions — conforme au lot (3).

## b) Par fonction
| nom | rôle | risques | statut |
|-----|------|---------|--------|
| rampe | Construit le dégradé d'opacité (masque L) | division par `h-1` / `w-1` : ZeroDivisionError si image 1 px (irréaliste, portraits 512) | OK |
| sans_lisere | Retire le liseré par couleur+bord, floute, applique la rampe | `Image.open`/`save` fail-loud ; source garantie présente par `main` | OK |
| main | Vérifie les portraits présents, traite les 15 capitaines | `sys.exit` si portraits absents (garde-fou) ; boucle séquentielle | OK |

## c) Findings détaillés
Aucune faille. `main` valide d'abord la présence des 15 sources
(`cap_%s.png`) et sort proprement si l'une manque (lignes 154-157), donc
`sans_lisere` n'est jamais appelée sur un fichier absent. La division par
`h-1`/`w-1` dans `rampe` ne casserait que sur une toile de 1 px, cas impossible
ici — gravité cosmétique.
