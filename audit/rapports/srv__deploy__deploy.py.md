# Rapport d'audit — srv/deploy/deploy.py

Chemin réel : `/Users/develop/dice-server/deploy/deploy.py`
Lignes : 334. Lu en entier (2 tranches de 200).

Rôle du fichier : CLI d'installation/mise à jour idempotente du service
`eden-dice` sur le serveur (via SSH/paramiko) : pose Node depuis le tarball
officiel, crée l'utilisateur de service, la base PostgreSQL, envoie le bundle,
écrit `.env`, migre le schéma, pose l'unité systemd et vérifie `/health`.

## a) Liste de toutes les fonctions

| nom | ligne |
|-----|-------|
| tool_secret() | 55 |
| connect() | 65 |
| say(text) | 79 |
| run(client, cmd, check, quiet) | 87 |
| put_text(client, remote, text, mode) | 101 |
| build_bundle() | 107 |
| upload_bundle(client, blob) | 120 |
| ensure_node(client) | 141 |
| ensure_service_user(client) | 157 |
| read_env(client) | 162 |
| ensure_database(client, db_password) | 173 |
| google_credentials(existing) | 216 |
| install(client, where) | 238 |
| status(client) | 300 |
| main() | 306 |

Comptage conforme au lot (15 fonctions).

## b) Analyse par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| tool_secret | Recalcule le secret HMAC du tool, repli sha256. | try/except → repli déterministe ; modifie `sys.path` (mineur) | OK |
| connect | Connecte en SSH (LAN mot de passe, sinon public par clé). | `AutoAddPolicy` désactive la vérif de clé d'hôte (Finding 2) ; mot de passe root en dur (Finding 1) | FAILLE |
| say | Écrit sur stdout en tolérant l'encodage console. | `encode(...,"replace")` → jamais de crash d'encodage | OK |
| run | Exécute une commande distante, lève si code≠0 et check. | timeout 600 ; `SystemExit` sur échec (fail-loud) ; canal fermé avec le client | OK |
| put_text | Écrit un fichier distant via base64. | `text` base64-encodé avant le shell → **pas d'injection** (alphabet base64 sans métacaractères) | OK |
| build_bundle | tar.gz du service. | vérifie les payloads manquants → `SystemExit` explicite ; context manager | OK |
| upload_bundle | Envoie le bundle (SFTP, repli base64). | SFTP fermé + fichier temp supprimé en `finally` ; repli base64 sûr (Finding note) | OK |
| ensure_node | Installe Node depuis le tarball officiel. | pas de checksum du tarball (note ; HTTPS mitige) ; `set -e` | OK |
| ensure_service_user | Crée l'utilisateur système. | idempotent (`id -u ... ||`) | OK |
| read_env | Lit le `.env` distant en dict. | `check=False` + parsing défensif | OK |
| ensure_database | Crée/altère rôle + base PostgreSQL. | `db_password` interpolé dans shell+SQL — sûr car token_urlsafe sans quote (Finding note) | OK |
| google_credentials | Relève les identifiants OAuth du coffre. | try/except → coffre optionnel ; handle de fichier non fermé (mineur) | OK |
| install | Orchestration complète du déploiement. | échec `/health` → journal + `SystemExit(1)` ; ressources gérées par les helpers | OK |
| status | État du service + health. | `check=False` ; `|| echo` | OK |
| main | Parse, connecte, dispatche, ferme le client. | client fermé en `finally` ; `int(args.logs)` valide l'entrée (anti-injection) | OK |

## c) Findings détaillés

### Finding 1 — Mot de passe root du serveur LAN en clair dans le source
- Emplacement : `deploy.py:35`.
- Gravité : sécurité (secret en clair).
- Extrait :
```python
LAN_HOST, LAN_USER, LAN_PASS = "192.168.1.19", "root", "admin"
```
- Pourquoi c'est un risque : identifiants `root:admin` codés en dur et versionnés
  dans git. Toute personne ayant accès au dépôt (ou à une copie/fuite) obtient un
  accès root au serveur dev sur le LAN. Le mot de passe est de plus trivial
  (`admin`). À déplacer vers un secret hors-git (comme `.secrets.json`/env, déjà
  utilisé pour Google et la clé publique). Grille point 4 (surface exposée).

### Finding 2 — Vérification de la clé d'hôte SSH désactivée (AutoAddPolicy)
- Emplacement : `connect` `deploy.py:67`.
- Gravité : sécurité (MITM).
- Extrait :
```python
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(LAN_HOST, username=LAN_USER, password=LAN_PASS, timeout=6, ...)
```
- Pourquoi c'est un risque : `AutoAddPolicy` accepte n'importe quelle clé d'hôte
  sans la vérifier. Combiné au Finding 1, le mot de passe root est envoyé sur une
  connexion dont l'identité du serveur n'est pas authentifiée : un attaquant en
  position d'interception sur le LAN (ARP spoofing, etc.) peut se faire passer
  pour `192.168.1.19`, capter `root:admin`, et rejouer/observer toutes les
  commandes de déploiement. À remplacer par une politique qui vérifie une
  `known_hosts` épinglée (`RejectPolicy` + clé connue).

## Notes non bloquantes (aucune ne franchit le seuil d'une faille)

- **Injection SQL/shell dans `ensure_database` — non exploitable** : `db_password`
  est interpolé dans `PASSWORD '%s'` (SQL) puis dans un `sudo psql -c "..."`
  (shell). C'est sûr *uniquement* parce que la valeur est toujours un
  `secrets.token_urlsafe(24)` (`deploy.py:248`, alphabet `[A-Za-z0-9_-]`, sans
  guillemet) ou une valeur relue d'un `.env` que ce même outil a écrit. Une
  future source de mot de passe contenant une quote romprait l'échappement. À
  passer en paramètre plutôt qu'en interpolation par prudence.
- **`put_text`/`upload_bundle`** neutralisent l'injection en base64-encodant le
  contenu avant de le passer au shell (alphabet sans métacaractère) — bonne
  conception.
- **`ensure_node`** télécharge le tarball Node sans vérifier de checksum/signature
  (l'intégrité repose sur `curl` HTTPS vers nodejs.org, ce qui mitige le MITM
  réseau ; un miroir compromis passerait toutefois).
- **`google_credentials`** ouvre `.secrets.json` sans `with`/close explicite
  (descripteur fermé au GC — lint uniquement).
- Grille point 6 : `main` ferme le client en `finally`, `upload_bundle` ferme le
  SFTP et supprime le temp en `finally` — pas de fuite.

## Statut fichier : FAILLES(2) [sécurité (secret en clair)]
