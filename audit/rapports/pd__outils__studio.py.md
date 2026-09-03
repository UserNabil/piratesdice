# Rapport d'audit — `pd/outils/studio.py`

Outil de développement : serveur HTTP local (port 8123) qui expose les réglages
CSS `--cbt-*`, les modifie en mémoire, et sur `/enregistrer` **réécrit
`www/css/combat.css` et `app/css/combat.css`**. L'app (simulateur/émulateur)
interroge `/etat` 5×/s. `ThreadingTCPServer`, lié à **`0.0.0.0`** (nécessaire pour
l'émulateur Android en `10.0.2.2`).

## a) Fonctions / méthodes (nom | ligne)
- resoudre | 57
- reglages | 82
- enregistrer | 107
- Poste.log_message | 219
- Poste._rendre | 222
- Poste.do_OPTIONS | 234
- Poste.do_GET | 237
- Poste.do_POST | 247
- main | 277

Classes : `Poste` (218), `Serveur` (272).

**Écart de comptage** : je compte **9** fonctions/méthodes Python (+2 classes). Le
lot annonce 11 : l'écart vient très probablement des 3 fonctions JavaScript
embarquées dans la chaîne `PAGE` (`unite`, `bornes`, `famille`) comptées par la
métrique auto. Pas de fonction Python manquante.

## b) Par fonction
| nom | rôle | risques | statut |
|-----|------|---------|--------|
| resoudre | Suit les `var(--x)` jusqu'à une valeur littérale | boucle bornée (`profondeur=6`) → pas d'appel circulaire infini | OK |
| reglages | Lit les 3 CSS, 1re déclaration de chaque `--cbt-*` | `open(...).read()` **hors `VERROU`** pendant que `enregistrer` peut écrire le même fichier (course) | voir F1/F2 |
| enregistrer | Remplace les déclarations dans combat.css (+ miroir) | écrit une **valeur arbitraire** issue de `/poser` ; écriture non atomique (truncate+write) | FAILLE (F1) |
| Poste.log_message | Silence les logs | aucun | OK |
| Poste._rendre | Écrit la réponse + CORS `*` | `wfile.write` → BrokenPipe si client parti (contenu par socketserver) | OK |
| Poste.do_OPTIONS | Préflight CORS | aucun | OK |
| Poste.do_GET | Sert `/etat`, `/reglages`, la page | `/etat` sous `VERROU` ; `/reglages` lit les fichiers hors verrou | voir F2 |
| Poste.do_POST | `/poser`, `/enregistrer`, `/raz` | `json.loads`/`d["nom"]` sur entrée hostile → exception **contenue** par ThreadingTCPServer (le serveur survit) ; `/enregistrer` déclenche l'écriture disque | voir F1 |
| main | Démarre le serveur, ouvre le navigateur | `webbrowser.open` en try/except ; serveur en context manager | OK |

## c) Findings détaillés

### F1 — `studio.py:107-130` (+ surface `do_POST` 247-268) — état incohérent / intégrité
Gravité : **état incohérent** (injection dans un fichier source livré), faible
probabilité (nécessite un accès LAN pendant une session studio).

Le serveur est lié à `0.0.0.0` (ligne 283) et **aucune authentification** ne
protège les routes. N'importe quel hôte du réseau local peut :
1. `POST /poser {"nom":"--cbt-x","valeur":"<texte libre>"}` → stocké tel quel
   dans `ETAT["vars"]` (ligne 253) ;
2. `POST /enregistrer` → `enregistrer` réécrit `www/css/combat.css` **et**
   `app/css/combat.css` (lignes 128-130).

Dans `enregistrer`, la substitution (lignes 121-124) ne contraint que le **nom**
(doit exister comme `--cbt-*`), pas la **valeur** :
```
motif = re.compile(r"^(\s*)" + re.escape(nom) + r"\s*:\s*[^;]+;", re.M)
texte = motif.sub(lambda m: "%s%s: %s;" % (m.group(1), nom, valeur), texte, count=1)
```
Une valeur du type `red; } body{display:none} .x{` est écrite telle quelle dans
la feuille de style **livrée à l'app**. C'est une injection CSS dans un fichier
source suivi par git, déclenchable par un client non authentifié tant que le
studio tourne. Le tout est aussi une **écriture non atomique** (truncate puis
write) : une interruption pendant l'écriture laisse `combat.css` tronqué.

### F2 — `studio.py:242-243` vs `107-130` — état partagé (course fichier)
Gravité : **cosmétique / état incohérent transitoire**, faible probabilité.

`do_GET /reglages` appelle `reglages()` qui lit `combat.css` **sans `VERROU`**,
alors que `do_POST /enregistrer` écrit ce même fichier **sous `VERROU`**. Les deux
peuvent tourner dans des threads concurrents (`ThreadingTCPServer`). Une lecture
tombant pendant le `open(CIBLE,"w")` (qui tronque d'abord) peut renvoyer un
fichier vide/partiel → liste de réglages fausse renvoyée à la page. Le verrou ne
protège que `ETAT`, pas le fichier partagé (point 7). Auto-résorbé au rechargement.

### Note (non faille)
Les entrées JSON hostiles sur `do_POST` (`json.loads` invalide, `d["nom"]`
absent/non hashable) lèvent des exceptions **contenues** par le pool de threads
de `ThreadingTCPServer` : le thread meurt, la connexion est fermée, `ETAT` reste
intact (`v` non incrémenté), le serveur continue. Ce n'est donc pas un crash
process — auto-limité.
