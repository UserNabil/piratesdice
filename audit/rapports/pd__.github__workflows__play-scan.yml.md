# Rapport — pd/.github/workflows/play-scan.yml

**0 fonction** — Workflow GitHub Actions (YAML) : dispatch manuel en lecture seule interrogeant Play (`--check`, `--historique`, `--brut`), avec option `purger` des brouillons.

## Fonctions
Aucune (fichier de configuration CI).

## Risques evidents
- **Secrets** : `PLAY_SERVICE_ACCOUNT_JSON` injecte via `env:`. Aucun secret en clair.
- **Interpolation d'entree** : ligne 37 `if [ "${{ inputs.purger }}" = "true" ]` interpole `inputs.purger` dans le shell — c'est un booleen (valeurs seules possibles `true`/`false`), donc pas d'injection.
- **Operation destructive** : `--purger` retire des versions brouillon des pistes alpha/internal (ligne 38-42), mais gate derriere l'entree opt-in explicite `purger` (defaut false). Pas de faille ; comportement intentionnel documente.

## Statut : OK
