# Rapport d'audit — srv/.github/workflows/deploy.yml

Chemin réel : `/Users/develop/dice-server/.github/workflows/deploy.yml`
Lignes : 100. Lu en entier.

**0 fonction — fichier de configuration GitHub Actions (YAML).**

Nature : workflow de déploiement déclenché à chaque poussée sur `main` (hors
`**.md`) et en `workflow_dispatch`. Étapes : checkout, setup node 22, `npm ci`,
`npm test`, setup python 3.12, `pip install paramiko`, pose d'une clé SSH depuis
un secret, `python3 deploy/deploy.py`, contrôle santé via l'adresse publique,
effacement de la clé.

## Revue de sûreté (fichier de config)

Aucun risque évident (pas de secret en clair, pas d'injection, pas de commande
dangereuse).

Points positifs relevés :
- **Secret bien manipulé** : `EDEN_SSH_PRIVATE_KEY` passe par `env`, est écrit
  via `printf '%s\n' "$CLE"` (format fixe, pas d'injection de format) dans
  `$RUNNER_TEMP/deploy_key`, `chmod 600`, et effacé avec `if: always()` (l.98-100).
  La clé n'est jamais imprimée dans les logs ; garde `[ -z "$CLE" ]` → échec net
  si le secret manque.
- **Pas d'injection de commande** : aucun champ non fiable (`github.event.*`,
  titres/branches contrôlés par un tiers) n'est interpolé dans un `run:`. Seuls
  `secrets.*` et `runner.temp` (fiables) le sont.
- **Concurrence** : `group: dice-server`, `cancel-in-progress: false` — évite
  d'annuler un déploiement en cours.
- **Contrôle santé réel** : interroge la porte publique
  (`https://dice.my-officeapps.com/health`), échec explicite après 6 essais.

Notes non bloquantes (durcissement supply-chain, aucune faille) :
- Les actions sont épinglées à des tags majeurs (`actions/checkout@v5`,
  `setup-node@v5`, `setup-python@v6`) plutôt qu'à un SHA complet — pratique
  courante ; l'épinglage par SHA réduirait le risque de tag repoussé.
- `pip install --quiet paramiko` n'épingle pas de version : chaque run installe
  la dernière paramiko. Épingler (`paramiko==x.y.z`) figerait la dépendance.

## Statut fichier : OK
