# Rapport d'audit — `pd/publier-ios.py`

Outil de publication iOS : assemble, vérifie, signe et envoie la version à App
Store Connect. Chaque étape peut REFUSER bruyamment (`refuser` = `sys.exit`,
`courir` vérifie le code retour). Lancé à la main.

## a) Fonctions (nom | ligne)
- dire | 43
- refuser | 47
- courir | 51
- prochain_build | 65
- verifier_www | 102
- poser_version | 118
- construire | 129
- verifier_ipa | 156
- manifeste | 193
- envoyer | 221
- main | 236

11 fonctions — conforme au lot (11).

## b) Par fonction
| nom | rôle | risques | statut |
|-----|------|---------|--------|
| dire | `print(flush=True)` | aucun | OK |
| refuser | `sys.exit("REFUS : …")` | arrêt voulu | OK |
| courir | Lance une commande, refuse si code ≠ 0 | **vérifie le retour** ; affiche les tails stdout/stderr | OK |
| prochain_build | Demande à Apple le prochain build (+ trace locale) | `asc.appel` non attrapé (fail-loud) ; **écrit la trace comme effet de bord, y compris en `--prochain` et avant tout succès** → dérive du compteur local | OK (voir note 1) |
| verifier_www | Rejoue `build.py --check`, exige des serveurs HTTPS | `refuser` si pas d'adresse / non-HTTPS ; `open` temp | OK |
| poser_version | Écrit `CURRENT_PROJECT_VERSION` dans le pbxproj | `refuser` si motif introuvable | OK |
| construire | build.py, cap sync, xcodebuild archive/export | chaque `courir` refuse à l'échec ; `plistlib.dump(..., open(...,'wb'))` fermé par refcount | OK |
| verifier_ipa | Contrôle bundle, version, chiffrement, signature | `refuser` sur chaque écart ; `with ZipFile` ; dir `_ouvert` laissé si `refuser` tombe après extraction (nettoyé au run suivant) | OK |
| manifeste | SHA-256 + git → MANIFESTE.txt | `git` sans `check` (best-effort, git vide si absent) | OK |
| envoyer | altool `--validate-app` puis `--upload-app` | `refuser` si clé/émetteur env absents ; `courir` refuse à l'échec | OK |
| main | argparse + orchestration | rouvre l'IPA `ZipFile(ipa).read(...)` sans `with` (temp) ; `CFBundle*` KeyError fail-loud | OK |

## c) Findings détaillés
Aucune faille bloquante. Outil de publication « fail-loud » soigné : contrôles
défensifs de l'IPA (nombre de fichiers dans le bundle, identifiant, version,
`ITSAppUsesNonExemptEncryption`, signature Apple Distribution + équipe) avant tout
envoi, et le numéro de build est demandé à Apple plutôt que déduit.

- Note 1 — `publier-ios.py:87-97` — cosmétique : `prochain_build` **écrit** la
  trace locale `dernier-build.txt` à chaque appel, y compris en mode `--prochain`
  (censé seulement « afficher et s'arrêter », lignes 240-241, 247-248) et **avant**
  que le build/envoi réussisse. Deux `--prochain` successifs renvoient N puis N+1,
  et un build échoué après coup laisse quand même la trace incrémentée. Comme
  Apple accepte tout numéro supérieur et ne redescend jamais (documenté), la seule
  conséquence est une dérive vers le haut / des numéros « sautés » — sans casse.
- Note 2 — plusieurs `open(...)`/`ZipFile(...)` sans `with` (lignes 91, 96, 121,
  126, 145, 196, 215, 260) reposent sur la fermeture par refcount de CPython ;
  correct ici, fragile hors CPython. `git`/`codesign` en `subprocess.run` sans
  `check` sont best-effort (valeurs vides tolérées). Gravité cosmétique.
