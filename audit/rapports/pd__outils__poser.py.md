# Rapport d'audit — `pd/outils/poser.py`

Outil HORS LIGNE : recopie `www/` dans le conteneur du simulateur iOS et vide les
deux dossiers de cache WebView. Lancé à la main. `main()` est appelée directement
en fin de module (ligne 64), sans garde `__main__`.

## a) Fonctions (nom | ligne)
- simctl | 31
- main | 39

2 fonctions — conforme au lot (2).

## b) Par fonction
| nom | rôle | risques | statut |
|-----|------|---------|--------|
| simctl | Enveloppe `xcrun simctl`, `sys.exit` sur échec | `capture_output` ; sortie propre si erreur (sauf `silencieux`) | OK |
| main | rsync www → paquet, purge caches, relance l'app | `subprocess.run(..., check=True)` sur rsync → CalledProcessError fail-loud ; `rm -rf` best-effort (retour ignoré) sur des chemins dérivés d'un APPID constant (pas d'injection) ; `sys.exit` si app non installée | OK |

## c) Findings détaillés
Aucune faille. Le `rm -rf` (ligne 57) opère sur des chemins construits depuis le
conteneur retourné par `simctl` et un `APPID` constant : pas d'entrée hostile, pas
de risque d'effacement hors cible. L'échec de `rsync` remonte en traceback
(voulu). Le `terminate` est marqué `silencieux` (l'app peut ne pas tourner).
