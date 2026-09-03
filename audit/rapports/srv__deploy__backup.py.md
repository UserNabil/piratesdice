# Rapport d'audit — srv/deploy/backup.py

Chemin réel : `/Users/develop/dice-server/deploy/backup.py`
Lignes : 133. Lu en entier.

Rôle du fichier : CLI de sauvegarde de la base — pose un service+timer systemd
qui fait un `pg_dump | gzip` nocturne (14 copies gardées), et permet de
déclencher/inspecter/rapatrier une sauvegarde. S'appuie sur `deploy.py` pour le
SSH.

## a) Liste de toutes les fonctions

| nom | ligne |
|-----|-------|
| install(client) | 72 |
| now(client) | 83 |
| status(client) | 88 |
| fetch(client) | 93 |
| main() | 110 |

Comptage conforme au lot (5 fonctions).

## b) Analyse par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| install | Pose script/unit/timer, active le timer, lance une sauvegarde. | exceptions SSH propagées à `main` (client fermé en `finally`) ; étapes critiques `base.run` sans `check=False` → échec bruyant ; textes bâtis depuis constantes (pas d'injection) | OK |
| now | Démarre le service et affiche le journal. | `check=False` (best-effort diagnostic assumé) | OK |
| status | Liste timers et sauvegardes existantes. | `check=False` ; `|| echo` gère l'absence | OK |
| fetch | Rapatrie la dernière sauvegarde par SFTP. | `remote` vide → retour propre ; SFTP fermé en `finally` (point 6 OK) ; `posixpath.basename` sur le chemin local (anti-traversée) | OK |
| main | Parse les options, connecte, dispatche, ferme le client. | client fermé en `finally` (point 6 OK) ; connexion échouée → propagée avant tout client à fermer | OK |

## c) Findings détaillés

Aucune faille détectée.

Revue injection / commande dangereuse (outil de déploiement) :
- `SCRIPT_TEXT`, `UNIT_TEXT` et les `base.run(...)` n'interpolent que des
  **constantes** (`DIR`, `KEEP`, `SCRIPT`, `UNIT`, `TIMER`) — aucune donnée
  utilisateur ni entrée réseau n'atteint un shell. Pas d'injection.
- Le script bash posé utilise `set -euo pipefail`, source `.env` et passe
  `PGPASSWORD` par variable d'environnement à `pg_dump` (pas d'exposition en
  ligne de commande ni en log). Aucun secret en clair dans le fichier Python.
- `fetch` : `remote` vient du `ls` du serveur (nôtre, de confiance) et sert à un
  `sftp.get` direct (pas de shell) ; le chemin local passe par
  `posixpath.basename`, neutralisant une éventuelle traversée.

Notes non bloquantes :
- Grille point 1 : les fonctions n'attrapent pas les exceptions SSH/paramiko ;
  c'est un comportement fail-loud approprié pour un CLI de déploiement, et
  `main`/`fetch` garantissent la fermeture des ressources via `finally`.
- Grille point 8 : les `check=False` sont limités aux commandes de diagnostic
  (now/status) ; les étapes d'installation critiques restent vérifiées.
- La docstring mentionne `--status` alors que l'action « status » est le
  comportement par défaut (aucun flag `--status` déclaré dans argparse) —
  incohérence de documentation, sans effet.

## Statut fichier : OK
