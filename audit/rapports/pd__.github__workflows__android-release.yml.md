# Rapport — pd/.github/workflows/android-release.yml

**0 fonction** — Workflow GitHub Actions (YAML) : sur push `main` (ou dispatch), build + signature de l'AAB puis envoi sur la piste Play interne, avec ecriture de retour de `store/dernier-envoi.json` dans le depot.

## Fonctions
Aucune (fichier de configuration CI).

## Risques evidents
- **Secrets** : injectes via `${{ secrets.* }}` en `env:`, cle keystore ecrite en temp et effacee `if: always()` (ligne 118-120). Aucun secret en clair.
- **Concurrency** : `group: play`, `cancel-in-progress: false` — partage avec play-listing.yml pour serialiser les editions Play. Correct.
- **Permissions** : `contents: write` accorde (ligne 39) pour le commit de `dernier-envoi.json` — perimetre minimal justifie.
- **Injection shell (mineur, non-faille)** : ligne 89 interpole `${{ vars.DICE_SERVER_URL }}` dans le `run` (variable admin, risque faible, meme remarque que android-apk.yml). Ligne 141 `--track "${{ inputs.track || 'internal' }}"` : `inputs.track` est de type `choice` restreint a une liste fermee (internal/alpha/beta/production) — injection impossible. `inputs.forcer` est un booleen (ligne 136) — sur.
- **Push de journal resilient** : la boucle de retry (ligne 160-165) avec `git pull --rebase --autostash` puis fallback `::warning::` (ligne 169) evite qu'un echec de course fasse echouer une livraison deja partie. Bon comportement de sortie d'erreur.
- **Ligne 141 mise en forme** : espaces multiples entre arguments (artefact de continuation aplatie) ; le shell les collapse, sans effet. `$PD_FORCER`/`$PD_SI_LIBRE` volontairement non quotes pour disparaitre quand vides — correct.

## Statut : OK
