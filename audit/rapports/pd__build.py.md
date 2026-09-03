# Audit — pd/build.py (392 lignes)

Fichier lu en entier (2 tranches). Lot annonce **11 fonctions**, **11 trouvées** (écart 0). Outil de build développeur : assemble `www/` avant un build Capacitor. Hors runtime jeu, mais **destructif** (vide `www/`).

## (a) Fonctions

| nom | ligne |
|---|---|
| copy_tree | 54 |
| standalone | 60 |
| source_de | 70 |
| travail_a_la_main | 90 |
| build | 145 |
| check | 218 |
| weigh | 249 |
| parse_js | 261 |
| copier_vers_android | 292 |
| noms_absents | 317 |
| main | 344 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| copy_tree | copytree avec `dirs_exist_ok` | source absente → `sys.exit` propre | OK |
| standalone | dépôt autonome = pas de `static/` | aucun | OK |
| source_de | remonte le fichier source d'un fichier `www/` | renvoie None si non trouvé (géré par l'appelant) | OK |
| travail_a_la_main | liste les fichiers `www/` édités à la main (garde anti-destruction) | `open(...).read()` ×2 par fichier **non fermés** (fuite mineure, boucle) ; compare par mtime pour distinguer édition manuelle. Logique de garde solide. | OK |
| build | vide `www/`, recopie app+jeu, grave le serveur | **garde forte** : `ecarts and not PD_ECRASER` → `sys.exit` avant de vider. `os.remove` en try/except OSError (verrou Windows). Concurrence : deux builds simultanés se marcheraient dessus (improbable, outil dev). | OK |
| check | vérifie que chaque import relatif résout | regex, walk ; renvoie une liste de problèmes | OK |
| weigh | pèse `www/` | aucun | OK |
| parse_js | `node --input-type=module --check` par fichier | **`node` absent → `FileNotFoundError` non attrapé** → traceback au lieu d'un message. `with open` correct. | OK |
| copier_vers_android | `npx cap copy android` | **`npx` absent → `FileNotFoundError` non attrapé** ; sinon returncode vérifié → `sys.exit` propre | OK |
| noms_absents | détecte les noms appelés inexistants | import de `noms` gardé (try/except) ; mais **`noms.fautes(chemin)` dans la boucle non gardé** → un fichier illisible casserait la vérif | OK |
| main | argparse, garde HTTPS, build, vérifs, poids | garde `--build != dev` + non-HTTPS → `sys.exit` (empêche de graver une adresse LAN dans un paquet distribué). Enchaîne check+parse_js+noms_absents. | OK |

## (c) Findings

- **build.py:261-290 | cosmétique (crash, outil dev)** | `subprocess.run(["node", ...])` — si `node` n'est pas installé, `FileNotFoundError` remonte en traceback brut plutôt qu'en message clair. Même chose pour `npx` en l.310 (`copier_vers_android`). L'outil ne peut de toute façon pas aboutir sans ces dépendances ; un message serait plus propre.
- **build.py:339 | cosmétique** | dans `noms_absents`, seul l'`import noms` est protégé ; `noms.fautes(chemin)` appelé en boucle sans garde — un `.js` au décodage douteux ferait planter toute la vérification.
- **build.py:126 | cosmétique** | `travail_a_la_main` fait `open(chemin,"rb").read() == open(src,"rb").read()` : deux handles non fermés par itération. Sans effet réel (CLI court), mais `with` serait correct.
- **Garde destructive** : `build()` vide `www/` mais uniquement après la garde `PD_ECRASER`/mtime — pas de perte silencieuse de travail à la main. OK.
- **Grille** : pas d'async ; entrées = args CLI développeur (pas de client hostile) ; le seul état partagé est le disque (`www/`), sûr en usage mono-utilisateur.

**Verdict : OK** (findings cosmétiques, outil de build développeur).
