# Audit — pd/asc.py (73 lignes)

Fichier lu en entier. Lot annonce **3 fonctions**, **3 trouvées** (écart 0). Outil CLI développeur : signe un JWT ES256 et appelle l'API App Store Connect. Hors chemin runtime du jeu.

## (a) Fonctions

| nom | ligne |
|---|---|
| jeton | 29 |
| appel | 47 |
| main | 64 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| jeton | lit PD_ASC_KEY_ID/ISSUER + la clé .p8, signe un JWT 20 min | env manquants → `sys.exit` propre ; clé introuvable → `sys.exit` propre. `open(chemin).read()` **handle non fermé** (fuite mineure, CLI court). Erreur de lecture (permission) ou `jwt.encode` en échec → traceback non attrapé (sortie non nulle, acceptable pour un CLI). | OK |
| appel | requête HTTP, renvoie le JSON | `HTTPError` attrapé → `SystemExit` avec le corps (bon, le motif Apple est dans le corps). **`urlopen` SANS timeout** → peut pendre indéfiniment sur un réseau muet. `URLError`/timeout/`json.loads` d'une réponse non-JSON **non attrapés** → traceback. CLI, mais à noter. | OK |
| main | parse argv, imprime la réponse | `json.loads(sys.argv[3])` sur JSON invalide → traceback non attrapé ; `< 3` args → `sys.exit(__doc__)`. CLI. | OK |

## (c) Findings

- **asc.py:54 | cosmétique (fuite/blocage, outil CLI)** | `with urllib.request.urlopen(req) as r:` — pas d'argument `timeout`. Un serveur qui n'envoie rien fait pendre le script sans fin. Sur un CLI lancé à la main c'est peu grave, mais un `timeout=…` supprimerait le risque.
- **asc.py:40 | cosmétique** | `secret = open(chemin).read()` — handle de fichier jamais fermé (préférable : `with open(...)`). CLI court, GC nettoie.
- **asc.py:56 | cosmétique** | `json.loads(brut)` non gardé : une réponse 200 non-JSON lèverait un traceback plutôt qu'un message. Contexte CLI développeur.
- **Sécurité** : aucun secret en clair dans le fichier (la clé .p8 est lue depuis `~/.appstoreconnect/`), le jeton n'est pas imprimé, pas d'injection. OK.

**Verdict : OK** (findings cosmétiques, outil CLI hors runtime jeu).
