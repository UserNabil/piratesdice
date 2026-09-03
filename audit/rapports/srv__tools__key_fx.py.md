# Audit — srv/tools/key_fx.py

Fichier : `/Users/develop/dice-server/tools/key_fx.py` — 48 lignes.

**0 fonction — script-outil (build asset)** : détourage chroma-key à pleine résolution puis réduction en alpha prémultiplié d'une séquence de frames `f_*` du dossier `fx960` vers un GIF/APNG animé. Aucun `def`, aucune classe : uniquement du code au niveau module exécuté à l'appel. `nb_fonctions` annoncé : 0. **Concordant.**

## Risques évidents (grille sécurité pour fichier sans fonction)

- **Injection / commande dangereuse : aucune.** Pas de `os.system`, `subprocess`, `eval`, ni shell. Seules opérations : lecture d'images via PIL, calcul NumPy, écriture d'un fichier de sortie. Aucune interpolation vers un interpréteur.
- **Secret en clair : aucun.** Pas de credential, token, URL ni clé d'API. `KEY = [228, 94, 112]` est une couleur RVB de chroma-key, pas un secret.
- **Réseau : aucun.** Aucun accès distant.

## Notes (non-failles — outil lancé à la main)

- `SRC, DST = 'fx960', sys.argv[1]` (l.12) : lancé sans argument → `IndexError` immédiat, sans message d'usage. Comportement CLI acceptable pour un outil manuel ; à peine cosmétique.
- `frames` vide (dossier `fx960` sans `f_*`) → `frames[min(len-1, …)]` = `frames[-1]` sur liste vide → `IndexError` (l.19). De même `out[0].save` (l.47) suppose `out` non vide. Crash net à l'exécution si l'entrée manque ; pas d'état corrompu, pas d'effet de bord réseau/serveur — outil de build hors chaîne runtime.
- Division protégée : `aa = np.clip(..., 1e-4, 1.0)` (l.39) évite la division par zéro lors du dé-prémultiplié ; `KEEP=32` constant, pas de div/0 sur `step`.
- Le fichier n'est pas importé par le serveur (dossier `tools/`) : un plantage n'affecte ni une partie ni un joueur.

**Statut fichier : OK**
