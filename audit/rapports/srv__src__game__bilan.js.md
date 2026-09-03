# Rapport d'audit — srv/src/game/bilan.js

Fichier : `/Users/develop/dice-server/src/game/bilan.js` (131 lignes)
Métrique lot : 7 fonctions. **Compte réel : 3 fonctions nommées + arrow-callbacks** (`find((e) => …)` ligne 57, etc.). L'écart vient des arrows.

## a) Liste des fonctions

| nom | ligne |
|-----|-------|
| neuf | 23 |
| vide | 37 |
| absorber | 50 |
| arrow (find annonce) | 57 |

## b) Grille par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| neuf | crée un bilan vierge pour un siège | pur constructeur d'objet | OK |
| vide | crée la paire de bilans | idem | OK |
| absorber | lit une salve d'effets et met à jour les compteurs | `cible`/`victime` sont bornés 0..1, mais `auteur` issu de `e.par` n'est PAS borné avant `bilan[auteur].detruits += n` | FAILLE (faible, latente) |
| arrow find | repère l'annonce `kind:'bonus'` | pur | OK |

## c) Findings détaillés

### F1 — `absorber` : `auteur` (via `e.par`) indexé sans borne (gravité : crash process / état incohérent, latent)
`/Users/develop/dice-server/src/game/bilan.js:90-95`
```js
const auteur = typeof e.par === 'number' ? e.par : (parSoi ? cible : 1 - cible);
bilan[cible].perdus += n;
if (auteur !== cible) {
  bilan[auteur].detruits += n;
  if (n > bilan[auteur].bordee) bilan[auteur].bordee = n;
}
```
`cible` est soigneusement validé (`cible < 0 || cible > 1` → break ligne 76), et `victime` de même dans les branches `freeze`/`gelcol`. Mais `auteur` accepte n'importe quel `e.par` numérique sans le borner à {0,1}. Si une salve portait `par` hors {0,1} (par ex. `2`, `-1`), `bilan[auteur]` vaut `undefined` et `undefined.detruits += n` lève un `TypeError`. `absorber` est appelé depuis `src/game/match.js:499` (`compteurs.absorber(this.bilanFx, fx)`) sur des effets **générés par le moteur**, pas directement par le client — la probabilité réelle est donc faible. Mais c'est la seule branche où l'index de tableau échappe à la validation systématique du reste de la fonction ; une régression future qui poserait un `par` erroné ferait planter le traitement d'effets au milieu d'un tour. À aligner sur la garde des autres branches (`if (auteur < 0 || auteur > 1) …`).

## Verdict
1 FAILLE (gravité max : crash process / état incohérent, latente — entrée moteur, non client).
