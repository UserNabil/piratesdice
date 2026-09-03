# Rapport — pd/.github/workflows/android-apk.yml

**0 fonction** — Workflow GitHub Actions (YAML) : build manuel (`workflow_dispatch`) d'un APK signe release pour un testeur, sans interaction avec Play (numero demande en lecture seule).

## Fonctions
Aucune (fichier de configuration CI).

## Risques evidents
- **Secrets** : correctement injectes via `${{ secrets.* }}` en `env:` (KEYSTORE_B64, mots de passe, alias). Aucun secret en clair. La cle est ecrite dans `$RUNNER_TEMP/upload.jks` puis effacee a l'etape `Effacer la cle` avec `if: always()` (ligne 95-97) — bonne hygiene.
- **Injection shell (mineur, non-faille)** : ligne 67 `python3 build.py --server "${{ vars.DICE_SERVER_URL }}" ...` interpole une variable de depot directement dans le `run`. `vars.*` est fixe par les administrateurs du depot (non pilotable par un tiers), donc risque faible ; techniquement une surface d'injection de script si cette variable devenait un jour controlable. `inputs.suffixe` (workflow_dispatch) est lui passe via `env:` (ligne 91) et non interpole dans le shell — surface d'injection correctement evitee.
- **Verification signature** : l'etape ligne 102-125 est desormais robuste (`set -euo pipefail`, selection deterministe de l'apksigner via `sort -V | tail -1`, pas de tube masquant le code de sortie). Le bug historique documente en commentaire (ligne 106-121) est corrige.
- **`play_api.py --next-version`** : si le script echoue, `VERSION_CODE` serait vide/malforme ; sans `set -e` sur cette ligne (ligne 62) une valeur vide serait propagee. Impact limite (build echouerait plus loin), pas de faille de securite.

## Statut : OK
