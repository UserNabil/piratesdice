# Rapport d'audit — srv/src/game/rediffusion.js

Fichier : `/Users/develop/dice-server/src/game/rediffusion.js` (282 lignes)
Métrique lot : 24 fonctions. **Compte réel : 2 fonctions nommées + arrows** (`scoreOpts`, `images` ; arrows `tourPasse` l.86, `photo` l.95, `find` l.214). L'écart avec 24 vient de l'approximation (probablement les nombreux tests `typeof … === 'number'`).

## a) Liste des fonctions

| nom | ligne |
|-----|-------|
| scoreOpts | 44 |
| images | 56 |
| tourPasse (arrow) | 86 |
| photo (arrow) | 95 |

## b) Grille par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| scoreOpts | options de score (quarts/boost/curse) | pur | OK |
| images | rejoue un journal → suite d'images de rediffusion | journal = donnée SERVEUR (DB) ; guards de forme + version ; `rules.*` bornés | OK |
| tourPasse | expiration des coques au changement de main | interne {0,1} | OK |
| photo | pousse une image d'état complet | lit des champs `coup.*` avec garde `typeof` | OK |

## c) Findings détaillés

Aucune FAILLE. Fonction pure de rejeu, alimentée par le journal écrit par le serveur (`Match.replay()`), pas par une entrée client directe. Observations :

- **Robustesse.** `images` garde la forme du journal (l.57 : null / `v<2` / `coups` non-tableau), les quarts (l.65-66), et chaque coup (`typeof object`, `s ∈ {0,1}`). Les branches d'effet sont gardées par `typeof c.case === 'number'` / `typeof c.premiere === 'number'` avant tout `rules.columnOf(...)`. Les helpers `rules.*` bornent leur colonne (`clearColumn`, `swapQuarters`) ou renvoient `cell:-1` (`place` via `freeCellInColumn` sur une colonne hors plage) — testé : un `c.c` ou `c.case` hors plage ne jette pas, il produit un no-op. Aucun `await`, aucun timer, aucun état partagé (grids/quarts/protege sont locaux à l'appel) : deux rediffusions concurrentes n'interfèrent pas.

- **Vigilance (cosmétique) — garde de version laxiste.** `if (!journal || Number(journal.v) < 2 || …) return null` (l.57) : si `journal.v` est absent ou non numérique, `Number(v)` vaut `NaN` et `NaN < 2` est **faux**, donc le journal N'EST PAS rejeté par le contrôle de version et part au rejeu. L'intention (« on ne rejoue que le format 2 ») n'est tenue que pour un `v` explicitement < 2 (les v1). Comme les journaux sont estampillés `v: 2` par `Match.replay()`, le cas ne se présente pas en pratique ; à durcir en `!(Number(journal.v) >= 2)` si l'on veut rejeter aussi un `v` manquant/corrompu. Aucun impact sécurité (donnée serveur), pas de crash.

## Verdict
OK (0 FAILLE).
