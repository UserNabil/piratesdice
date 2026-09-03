# Audit — srv/deploy/tunnel.py

Fichier : `/Users/develop/dice-server/deploy/tunnel.py` — 112 lignes.
Nature : script de déploiement Python (poste Windows → machine Linux via SSH, module `paramiko`) qui installe/désinstalle un connecteur Cloudflare Tunnel exposant le jeu (port 8100) en HTTPS public. S'appuie sur le module frère `deploy.py` (`base.connect`, `base.run`, `base.put_text`, `base.say`).
Fonctions annoncées : 4. Recomptées : **4** `def`. Aucun écart.

Contexte SSH (rappel de `deploy.py`, hors lot mais nécessaire à l'analyse) :
- `base.run(client, cmd)` exécute `cmd` via `client.exec_command(cmd)` : toute valeur interpolée dans `cmd` est un vecteur d'injection shell côté serveur, exécutée **en root** (l'utilisateur SSH a les droits `systemctl`/`chmod` root).
- `base.put_text(remote, text)` encode `text` en base64 avant de l'écrire → le CONTENU est à l'abri de l'injection, mais `remote` et `mode` sont interpolés en clair.
- `base.connect()` utilise `AutoAddPolicy()` (accepte n'importe quelle clé d'hôte).

## a) Liste de toutes les fonctions

| nom | ligne |
|-----|-------|
| ensure_binary | 59 |
| install | 70 |
| status | 80 |
| main | 86 |

## b) Analyse fonction par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| ensure_binary | télécharge le binaire cloudflared s'il est absent, sinon le garde | **aucune vérification d'intégrité** (ni checksum ni signature) d'un binaire téléchargé puis exécuté en root ; URL `releases/latest` (cible mouvante, non épinglée) ; échec du `curl` → `SystemExit` (check=True) donc pas de poursuite silencieuse | FAILLE |
| install | pose le jeton, l'unité systemd, active le service | jeton reçu en argv (voir F2) ; jeton écrit via `put_text` donc **pas** d'injection shell (base64) ; `is-active` en check=False → si le service ne démarre pas, message d'état mais pas d'échec dur (voulu) | FAILLE (via jeton argv) |
| status | affiche l'état systemd + sonde `/health` locale | tout en check=False → jamais bloquant ; aucune donnée externe interpolée | OK |
| main | parse les args, ouvre la connexion, dispatch, ferme | `client.close()` en `finally` (ressource libérée) ; `--logs 0` avale les logs (voir F3) ; priorité install>logs>uninstall>status arbitraire mais sans danger ; `args.logs` est `type=int` donc pas d'injection | OK (edge `--logs 0`) |

## c) Findings détaillés

### F1 — ensure_binary : binaire téléchargé et exécuté en root sans aucune vérification d'intégrité
`tunnel.py:64-67` (et exécution : unité `User=root`, lignes 48/51)
```python
base.say("  telechargement du binaire autonome (aucun apt)")
base.run(client, "set -e; mkdir -p %s && curl -fsSL --max-time 300 -o %s.new %s && "
                 "chmod 0755 %s.new && mv %s.new %s" % (BIN_DIR, BIN, URL, BIN, BIN, BIN))
```
avec `URL = ".../cloudflared/releases/latest/download/cloudflared-linux-amd64"` et l'unité systemd `ExecStart=%s tunnel ... run` / `User=root`.
Gravité : **état incohérent / compromission root (supply-chain)**.
Le binaire est récupéré, rendu exécutable, puis lancé **en root** par systemd, sans jamais vérifier un hash SHA256 ni une signature. TLS (`curl -fsSL`) protège du MITM en transit, mais :
- `latest` est une cible **mutable** : ce qui tourne en root change à chaque release amont, sans revue ni pin de version ;
- rien ne détecte un artefact corrompu/altéré côté GitHub ou un cache/proxy d'entreprise interposé.
C'est exactement le motif « la vérification ne vérifie rien » (cf. la note mémoire sur la signature APK). Un checksum épinglé (téléchargé du côté du dépôt, pas de la même source) rendrait l'installation vérifiable.

### F2 — install : le jeton du tunnel (secret) transite par la ligne de commande
`tunnel.py:88` (déclaration) et `tunnel.py:97-98` (usage) puis `tunnel.py:72` (écriture)
```python
ap.add_argument("--install", metavar="JETON", help="jeton du tunnel ...")
...
if args.install:
    install(client, args.install)
...
base.put_text(client, ENV_FILE, "TUNNEL_TOKEN=%s\n" % token.strip(), mode="0600")
```
Gravité : **fuite de secret**.
Le jeton porte l'identité du tunnel ET le nom public : c'est un secret. Passé en argument (`python tunnel.py --install <jeton>`), il apparaît dans `ps`/table des processus du poste opérateur, dans l'historique du shell et, sur Windows, potentiellement dans les journaux de commande. Le stockage distant est correct (fichier `0600`, contenu base64 non injectable), mais l'**exposition est en amont**, au moment de l'invocation. Une lecture depuis un fichier/variable d'environnement/`getpass` éviterait l'argv. À noter : le contenu passant par `put_text` (base64), il n'y a **pas** d'injection shell malgré l'interpolation `%s` — c'est le seul point rassurant.

### F3 — main : `--logs 0` est silencieusement transformé en `--status`
`tunnel.py:99`
```python
elif args.logs:
    base.run(client, "journalctl -u %s -n %d --no-pager" % (SERVICE, args.logs), check=False)
```
Gravité : **cosmétique**.
`args.logs` valant `0` est faux au sens booléen : la branche est sautée et l'exécution tombe dans le `else` (status). Demander « 0 ligne de log » affiche donc l'état du service au lieu de ne rien afficher. Sans conséquence sur le serveur ; à corriger par `elif args.logs is not None:`.

Note (non-faille) : aucune valeur d'origine externe n'est interpolée dans une commande shell distante (les constantes `BIN/URL/SERVICE/ENV_FILE/UNIT` sont figées, `args.logs` est `int`, le jeton passe par base64). Le risque d'injection shell est donc **absent** dans ce fichier ; le risque réel est l'absence de vérification du binaire (F1) et l'exposition du secret en argv (F2).
