# Rapport d'audit — pd/www/js/pages/dice_state.js

Chemin réel : `/Users/develop/piratesdice/www/js/pages/dice_state.js`
Lignes : 397. Lu en entier (2 tranches de 200).

Rôle du fichier : l'unique copie de l'état du jeu de dés (objet `S`), plus les
utilitaires de parures/skins d'images, l'estampillage des commandes de partie,
le préchargement des assets et quelques helpers DOM.

## a) Liste de toutes les fonctions

| nom | ligne |
|-----|-------|
| arrondiDeCase(skin) | 123 |
| identifiant(s) [arrow const] | 141 |
| skinOf(seat) | 152 |
| maParure(jeu, motif) | 162 |
| dieArt(skin) | 171 |
| bonusArt(identify) | 175 |
| marque() | 201 |
| envoyerCoup(payload) | 216 |
| preloadAssets() | 286 |
| fxUrl(file, lifeMs) | 299 |
| screen(name) | 375 |
| boardOf(seat) | 389 |
| myTurn() | 395 |

Écart de comptage : le lot annonce 20 fonctions ; je compte 13 fonctions/consts
fléchées nommées. L'écart correspond aux callbacks fléchés anonymes dans
`STILL_FILES.forEach`, `FX_FILES.forEach`, les `.then`/`.catch` de `fetch`, le
`setTimeout` de `fxUrl` et le `forEach` de `screen`. Métrique auto gonflée par
les `=>`. Pas de fonction nommée manquante.

## b) Analyse par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| arrondiDeCase | Calcule l'arrondi du logement d'une case selon la parure du dé. | valide `typeof skin === 'string'` ; repli sur valeurs d'origine ; calcul pur | OK |
| identifiant | Valide qu'une chaîne est un id `[A-Z0-9]{1,8}`, sinon `null`. | garde d'entrée correcte (null/non-string → null) | OK |
| skinOf | Déduit le dossier d'images du siège depuis `S.state.players[seat]`. | `S.state`/`players`/`p` gardés par `&&` ; validation par `identifiant` ; seat hors borne → `undefined` géré | OK |
| maParure | Combinaison parure+motif pour soi hors partie. | validation par `identifiant` | OK |
| dieArt | Construit le chemin du dossier d'images d'une parure. | concat simple, repli sur dossier d'origine | OK |
| bonusArt | Chemin de l'icône d'un effet, repli `bonus_reroll.png`. | lookup avec repli | OK |
| marque | Identifiant unique de commande (compteur + random base36). | pas de crypto mais l'usage ne l'exige pas ; non concurrent (mono-thread) | OK |
| envoyerCoup | Estampille (`cmd`, `turnId`) et envoie une commande via `S.net.send`. | garde `!S.net` → `false` (les appelants s'y fient) ; `turnId` posé seulement si entier ; retour propagé | OK |
| preloadAssets | Précharge les images fixes (new Image) et les FX en blobs (fetch). | rejet de `fetch`/`blob()` capté par `.catch` ; erreurs `new Image` silencieuses (cosmétique, repli d'URL existe) ; garde `warmed` anti-rejeu | OK |
| fxUrl | Rend une URL neuve à chaque appel (blob→objectURL) pour relancer l'APNG. | objectURL révoqué via `setTimeout(revoke, lifeMs)` (libération présente) ; repli `?t=Date.now()` si pas de blob | OK |
| screen | Bascule l'écran actif et la classe `dc-en-partie`. | gardes d'existence DOM (`if (el)`, `if (coque)`) | OK |
| boardOf | Retrouve le plateau d'un siège dans le DOM. | garde `game` ; querySelector paramétré par `seat` (entier interne) | OK |
| myTurn | Vrai si le joueur peut agir. | lecture d'état bornée par `&&` | OK |

## c) Findings détaillés

Aucune faille détectée.

Notes non bloquantes (aucune n'atteint le seuil d'une faille) :
- `preloadAssets` gère correctement les rejets de promesse (`.catch` en fin de
  chaîne `fetch → blob`), donc pas de rejet non capté (grille point 2 OK).
- `fxUrl` libère bien l'objectURL par `setTimeout` (grille point 6 OK) ; le
  corps du callback (`URL.revokeObjectURL`) est trivial et ne peut pratiquement
  pas jeter.
- `envoyerCoup`/`skinOf`/`maParure` s'appuient sur `identifiant`, qui neutralise
  les entrées non conformes en amont (grille point 4 OK). Les payloads
  proviennent de l'UI locale, pas d'un client réseau hostile.

## Statut fichier : OK
