# Audit — pd/outils/effets2.py (156 lignes)

Fichier lu en entier. Lot annonce **4 fonctions**, **4 nommées trouvées** (+1 lambda inline ; écart 0 sur les nommées). Outil CLI développeur : met au format 5 capitaines + effets importés de `~/Downloads`. Hors runtime jeu.

## (a) Fonctions

| nom | ligne |
|---|---|
| boite | 82 |
| inscrire | 88 |
| remplir | 106 |
| main | 117 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| boite | boîte du dessin (alpha > 8) | appelants convertissent en RGBA d'abord | OK |
| inscrire | recadre puis inscrit à 92 % du côté, centré | `Image.open(src)` **si le fichier source précis manque → `FileNotFoundError` non attrapé**. Dessin vide → `sys.exit` propre. | OK |
| remplir | recadre puis étire bord à bord | idem `inscrire` pour un source manquant | OK |
| main | copie `trait_ching`→`trait_lionne`, puis boucle capitaines/traits/gel | **ne vérifie que l'existence des DOSSIERS** `ICONES`/`PORTRAITS`, pas des fichiers individuels → un fichier listé manquant plante en cours de boucle, laissant une **sortie partielle** dans `www/dice/img/`. Copie `trait_lionne` gardée par `not os.path.exists` (idempotent). | OK |

## (c) Findings

- **effets2.py:117-141 | cosmétique (état incohérent, dev)** | `main` vérifie `os.path.isdir(ICONES)`/`PORTRAITS` mais **pas** l'existence de chaque fichier de `CAPITAINES`/`TRAITS` avant de commencer à écrire. Un nom manquant lève `FileNotFoundError` (via `Image.open` dans `inscrire`) après que plusieurs `cap_*.png`/`trait_*.png` ont déjà été écrits → `www/dice/img/` dans un état partiel. **Contraste notable** : le successeur `effets3.py` a précisément ajouté un pré-contrôle `manquants` (tout vérifié avant toute écriture) pour corriger ce défaut ; `effets2.py` ne l'a pas.
- **effets2.py:90 | cosmétique** | `Image.open(src)` sans garde → traceback brut si un source manque (CLI développeur).
- **Grille** : pas d'async ; entrées = tables codées en dur + fichiers de `~/Downloads` (pas de client hostile) ; pas de garde anti-écrasement (écrit directement `www/dice/img/`), mais l'admin lance l'outil sciemment.

**Verdict : OK** (findings cosmétiques, outil CLI développeur ; l'écriture partielle sur source manquant est corrigée dans effets3.py).
