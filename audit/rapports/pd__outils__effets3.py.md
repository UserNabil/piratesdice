# Audit — pd/outils/effets3.py (205 lignes)

Fichier lu en entier. Lot annonce **5 fonctions**, **5 nommées trouvées** (+1 lambda inline ; écart 0 sur les nommées). Outil CLI développeur : suite d'`effets2.py`, importe 5 capitaines B012–B016 + effets + fonds. Hors runtime jeu. **Mieux gardé** que `effets2.py`.

## (a) Fonctions

| nom | ligne |
|---|---|
| boite | 106 |
| inscrire | 112 |
| remplir | 130 |
| reduire | 142 |
| main | 160 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| boite | boîte du dessin (alpha > 8) | appelants convertissent en RGBA | OK |
| inscrire | recadre puis inscrit à 92 %, centré ; flag `ecrire` (dry-run `--verifier`) | dessin vide → `sys.exit` propre ; source garanti présent par le pré-contrôle de `main` | OK |
| remplir | recadre puis étire bord à bord | idem, source pré-vérifié | OK |
| reduire | réduit un fond (jpg opaque / png à alpha) | choix du format par l'extension de `dst` ; OK | OK |
| main | pré-vérifie tout, refuse d'écraser, puis écrit | **pré-contrôle `manquants`** (tout source existe avant toute écriture) → pas de sortie partielle sur fichier absent ; **garde `deja`** (refuse d'écraser un existant sauf `--refaire`/`--verifier`) ; mode `--verifier` = dry-run. Reste : source **présent mais corrompu** → `Image.open` lèverait en cours de boucle (le pré-contrôle ne teste que l'existence, pas la validité). | OK |

## (c) Findings

- **effets3.py:192-193 | cosmétique (dev)** | le pré-contrôle `manquants` (l.178) vérifie l'existence mais pas la validité ; un fichier source présent mais illisible/corrompu lèverait dans la boucle d'écriture après quelques fichiers → sortie partielle. Cas résiduel et improbable ; le gros du risque (fichier absent) est déjà couvert.
- **Bonnes gardes à noter** : (1) `manquants` = tout vérifié avant qu'une seule image ne soit écrite ; (2) `deja` = jamais d'écrasement d'un travail fait à la main sans `--refaire` ; (3) `--verifier` = dry-run propre (`getsize` gardé par `os.path.exists`). C'est exactement la correction que `effets2.py` n'avait pas.
- **Grille** : pas d'async ; entrées = tables codées en dur + `~/Downloads/new_effect_pirates` (pas de client hostile) ; aucun blocage possible.

**Verdict : OK** (aucune faille ; findings résiduels cosmétiques, outil CLI développeur bien gardé).
