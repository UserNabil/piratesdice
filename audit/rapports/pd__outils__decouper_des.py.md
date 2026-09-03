# Audit — pd/outils/decouper_des.py (291 lignes)

Fichier lu en entier (2 tranches). Lot annonce **10 fonctions**, **10 nommées trouvées** (+4 lambdas inline non comptées ; écart 0 sur les nommées). Outil CLI développeur : découpe une planche 4×3 en 12 faces de dé mesurées. Hors runtime jeu.

## (a) Fonctions

| nom | ligne |
|---|---|
| corps | 43 |
| rayon | 53 |
| trouver_les_des | 71 |
| proprietaires | 117 |
| isoler | 138 |
| epousseter | 152 |
| poser_a_l_echelle | 190 |
| decouper | 209 |
| verifier | 248 |
| main | 272 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| corps | boîte du corps opaque (alpha ≥ 200) | boîte vide → `SystemExit` propre | OK |
| rayon | arrondi peint, médiane des 4 coins | boucles `while` bornées par la largeur ; ligne toute transparente gérée (borne atteinte) | OK |
| trouver_les_des | étiquette et range les 12 dés | `combien_trouve < 12` → `SystemExit` propre ; `ordre` garantit 12 boîtes | OK |
| proprietaires | attribue chaque pixel au corps le plus proche | `distance_transform_edt` sur tout le plan ; OK | OK |
| isoler | isole un dé, voisin effacé | bornes clampées `max(0,...)`/`min(w,...)` | OK |
| epousseter | efface les poussières après mise à l'échelle | **lève `SystemExit` si un morceau de voisin > 0,2 %** (garde volontaire) — au sein de `decouper`, avorte le run | OK |
| poser_a_l_echelle | corps à l'échelle, centré | `corps` garantit boîte non vide → pas de division par 0 | OK |
| decouper | orchestre la découpe des 12 faces | **écrit face par face** : si `epousseter` lève au milieu, certaines `die_*.png` déjà écrites → **sortie partielle** dans `skins/<code>/` | OK |
| verifier | contrôle : 1 seule forme par face | `os.listdir` OK ; renvoie un message | OK |
| main | argv, découpe, met à jour `_mesures.json` | `json.load(open(fiche))` **handle non fermé** + **si `_mesures.json` absent/corrompu → traceback**. Read-modify-write **non atomique** → deux runs concurrents = perte d'une mesure. | OK |

## (c) Findings

- **decouper_des.py:216-226 | cosmétique (état incohérent, dev)** | la boucle sauve chaque `die_%d.png` immédiatement ; un `SystemExit` levé par `epousseter` (l.184) après quelques faces laisse `skins/<code>/` à moitié rempli. Le run relancé écrase, donc pas de perte durable, mais l'état intermédiaire est incohérent. Garde volontaire, à noter.
- **decouper_des.py:280 | cosmétique** | `tout = json.load(open(fiche, encoding="utf-8"))` — handle non fermé, et aucune garde si `_mesures.json` manque (`FileNotFoundError`) ou est corrompu (`JSONDecodeError`). Read-modify-write non atomique : deux exécutions parallèles perdraient la mesure de l'une (dernier écrivain gagne).
- **Grille** : pas d'async ; entrées = args CLI développeur (planche, code) ; les gardes `SystemExit` (planche illisible, morceau de voisin, face à 2 formes) signalent correctement les échecs plutôt que de livrer un dé faux.

**Verdict : OK** (findings cosmétiques, outil CLI développeur).
