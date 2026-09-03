# Audit — srv/deploy/wire_tool.py

Fichier : `/Users/develop/dice-server/deploy/wire_tool.py` — 120 lignes.
Nature : outil LOCAL (aucun SSH, aucun réseau) qui rebranche les deux lignes (`import dice` + `dice.register(app, ...)`) du jeu dans le back-end du tool. Édite `app.py` (source) et, s'il existe, `code_reforged/app.py` (copie d'exécution). Se veut idempotent.
Fonctions annoncées : 5. Recomptées : **5** `def`. Aucun écart.

## a) Liste de toutes les fonctions

| nom | ligne |
|-----|-------|
| read | 45 |
| state | 50 |
| newline_of | 57 |
| wire | 61 |
| main | 85 |

## b) Analyse fonction par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| read | lit un fichier UTF-8 sans réécrire les fins de ligne | `with` correct (handle fermé) ; pas de `try` : si le fichier disparaît entre le `os.path.isfile` (construction d'`APPS`) et l'appel, `IOError` non attrapée → trace, pas de crash grave (outil local) | OK (mineur) |
| state | dit si l'import et l'appel register sont présents | détection par **sous-chaîne** (`"import dice" in src`, `"dice.register(app" in src`) → faux positif/négatif possible (voir F1) | FAILLE (heuristique) |
| newline_of | devine `\n` vs `\r\n` | heuristique approximative (`\r\n` compte aussi dans le total `\n`) ; sans impact fonctionnel réel | OK |
| wire | insère les deux lignes aux ancres | `sys.exit()` **dans un helper** si ancre absente/ambiguë → interrompt tout le run, y compris le fichier suivant (voir F3) ; `src.count(anchor)==1` bien vérifié avant remplacement | OK (contrôle de flux discutable) |
| main | boucle sur les app.py, vérifie/répare, code de sortie | écriture en mode `"w"` non atomique (voir F2) ; `--check` + cassé → `exit(1)` correct pour la CI ; `read()` hors `try` | FAILLE (écriture non atomique) |

## c) Findings détaillés

### F1 — state : détection par sous-chaîne, faux positif possible qui masque le branchement manquant
`wire_tool.py:50-54` (et le guard jumeau `wire_tool.py:65,73`)
```python
def state(src):
    return {
        "import": IMPORT_LINE in src,          # IMPORT_LINE = "import dice"
        "register": "dice.register(app" in src,
    }
```
Gravité : **état incohérent** (l'outil peut mentir « OK » alors que le back-end n'est pas branché — soit précisément le bug qu'il existe pour détecter).
`"import dice" in src` matche aussi `import dice_engine`, `import diceutils`, ou une occurrence en commentaire/chaîne. De même `"dice.register(app"` matcherait le texte du `REGISTER_BLOCK` s'il était collé en commentaire. Conséquence : `all(now.values())` renvoie `True`, la ligne réelle n'est **pas** ajoutée, le script imprime `OK` et `--check` sort en `0` — alors que `/api/dice/*` répondra « Not Found ». La direction d'erreur est « ne fait rien » (pas de double-ajout), donc pas destructrice, mais l'outil rate sa mission. Une détection ancrée sur une ligne entière (ex. `IMPORT_LINE + nl in src`, comme le fait déjà `wire`) serait fiable.

### F2 — main : réécriture de app.py en mode « w » non atomique
`wire_tool.py:107-109`
```python
fixed, changed = wire(src)
with io.open(path, "w", encoding="utf-8", newline="") as fh:
    fh.write(fixed)
```
Gravité : **état incohérent** (faible probabilité, fort impact).
`open(..., "w")` tronque le fichier **avant** l'écriture. Si le process est interrompu (Ctrl-C, disque plein, coupure) entre l'ouverture et la fin du `write`, `app.py` reste tronqué ou vide — or c'est le fichier source du tool, dont la corruption est exactement le désastre que ce script prétend prévenir. Un écrit atomique (fichier temporaire dans le même répertoire + `os.replace`) supprimerait cette fenêtre. Probabilité réelle basse (un seul `write`), mais l'enjeu justifie la protection.

### F3 — wire : `sys.exit()` au milieu d'un helper interrompt le traitement des fichiers restants
`wire_tool.py:67-69` et `wire_tool.py:75-77`
```python
if src.count(anchor) != 1:
    sys.exit("ancre d'import introuvable ou ambigue (%r) — branchement manuel necessaire" % IMPORT_ANCHOR)
```
Gravité : **état incohérent (partiel)**.
`main` boucle sur `APPS = [app.py, code_reforged/app.py]`. Si le PREMIER fichier est déjà réparé mais que le SECOND a une ancre manquante/ambiguë, `wire` fait `sys.exit` : la source a pu être modifiée et écrite tandis que la copie d'exécution reste dans un autre état (ou l'inverse selon l'ordre). Le run s'arrête avec un code non nul, laissant les deux fichiers potentiellement désynchronisés, sans message récapitulatif de ce qui a été fait avant l'abandon. Remonter la décision d'abandon dans `main` (collecter les échecs, puis sortir) rendrait l'état final lisible.

Note (non-faille) : aucun secret, aucune commande shell, aucune entrée réseau ici — l'outil n'agit que sur des fichiers locaux ; les risques sont de robustesse/atomicité, pas de sécurité.
