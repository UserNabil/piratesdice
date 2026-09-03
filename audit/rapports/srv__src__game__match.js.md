# Rapport d'audit — srv/src/game/match.js

Fichier : `/Users/develop/dice-server/src/game/match.js` (1575 lignes)
Métrique lot : 107 fonctions. **Compte réel : ~46 méthodes de classe** ; les ~60 restantes sont des arrow-callbacks (`map`/`filter`/`reduce`/`findIndex`, les callbacks de `later`, `etape`, `serialize`). Écart normal.

## a) Liste des fonctions (nom | ligne)

constructor 51 | seat 166 | dejaVue 188 | addSeat 199 | trait 209 | suivreProtection 226 | suivreProtections 244 | scoreOpts 255 | takeDie 264 | freeBonusOf 282 | freeLeft 292 | freeRerollLeft 296 | later 300 | clearTimers 315 | serialize 320 | snapshot 331 | annonceBonus 475 | push 497 | bilan 511 | begin 519 | headStart 524 | maybeStartPlaying 555 | roll 576 | place 591 | passerLaMain 722 | activateBonus 812 | pickCell 942 | mood 1065 | pickFace 1104 | cancelBonus 1139 | noter 1156 | replay 1169 | remember 1189 | awake 1198 | setPauseHumaine 1206 | armAway 1260 | setConnected 1228 | playForAway 1307 | aiStillPlaying 1331 | aiBonus 1342 | aiPlace 1437 | driveAi 1474 | forfeit 1516 | finish 1527 | destroy 1569

## b) Grille par fonction (méthodes clés)

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| later | planifie un callback différé | **try/catch autour de `fn()`, garde `this.dead`, retire le timer du Set** — modèle exemplaire | OK |
| serialize | sérialise les commandes | `then(fn,fn)` + queue qui avale les erreurs → une commande qui jette ne casse pas la file | OK |
| dejaVue | idempotence des commandes | Map bornée à 256, valide `typeof===string` | OK |
| roll | lance le dé | valide phase/tour/dé déjà lancé | OK |
| place | pose un dé | valide `Number.isInteger(column)` + bornes + colonne gelée | OK |
| passerLaMain | change de main (seul endroit) | nettoie gel/longue-vue/pending/coque ; `turnId++` | OK |
| activateBonus | arme/joue un effet | valide phase/tour/pending/spec/capitaine/plafond ; **`await consume` puis mutation sans re-check tour** (chemin payant non-visé) | FAILLE |
| pickCell | applique un effet à cible | valide `Number.isInteger(cell)` bornes ; **`await consume` puis `apply` sans re-check tour/phase/pending** | FAILLE |
| pickFace | choisit la face (B012) | valide face ∈ pending.faces ; **`await consume` puis `apply` sans re-check** | FAILLE |
| armAway | arme la veille d'absence | gardes pause/pauseHumaine/IA/phase ; `later(playForAway)` | OK |
| playForAway | saute le tour d'un absent | **re-valide phase/tour/seat** à l'exécution du timer | OK |
| driveAi | pilote l'IA | **chaque étape try/catch (`etape`) + re-check `aiStillPlaying` + filet de pose** | OK |
| aiBonus | effet joué par l'IA | valide `Number.isInteger` sur cell/premiere/face, rejoue check/checkCell | OK |
| aiPlace | pose de l'IA | **lit le refus de `place()` et retombe sur une colonne libre / finish** | OK |
| finish | finalise la partie | garde `settled` (une seule fois, sans `await`) ; **ignore le retour de `hooks.finish`** | OK (voir F2) |
| forfeit | déclare forfait | valide `seatIndex ∈ {0,1}` | OK |
| mood | humeur + réponse IA | réponse IA via `later` protégé | OK |
| push | diffuse l'état | `hooks.broadcast` non protégé localement (voir F3) | OK |
| noter/remember | journal/trail | bornés (200 / 64) | OK |
| setConnected | pause/reprise sur (dé)connexion | `driveAi` au retour ; mute `paused`/`turn` hors file (voir F1) | OK |

Les autres méthodes (constructor, seat, addSeat, trait, suivreProtection(s), scoreOpts, takeDie, free*, snapshot, annonceBonus, bilan, begin, headStart, maybeStartPlaying, cancelBonus, replay, awake, setPauseHumaine, aiStillPlaying, clearTimers, destroy) : sans faille — validations de bornes présentes, pas d'async non gardé, timers libérés dans `awake`/`clearTimers`/`destroy`.

## c) Findings détaillés

### F1 — Course TOCTOU : effet appliqué hors tour pendant `await hooks.consume` (gravité : état incohérent)
`/Users/develop/dice-server/src/game/match.js:942-1053` (`pickCell`), `:1104-1137` (`pickFace`), `:890-901` (`activateBonus`, chemin payant non-visé)

Le garde de tour est évalué AVANT l'`await`, la mutation d'état APRÈS, sans re-vérification :
```js
async pickCell(seatIndex, cell) {
  if (this.turn !== seatIndex) return 'not your turn';           // (check)
  ...
  const owned = await this.hooks.consume(seatIndex, this.pending.identify);  // (yield)
  ...
  const out = spec.apply(this, seatIndex, cell, targetSeat, premiere);       // (use — pas de re-check)
  ...
}
```
Les commandes sont sérialisées (`match.serialize(async () => await fn(...))`, gateway.js:1209), **mais les timers ne le sont pas** : `armAway` a planifié `later(() => this.playForAway(seatIndex), awayDuree)` (l.1287), un `setTimeout` qui vit hors de la file. Pendant que `pickCell` est suspendue sur `await this.hooks.consume` (un appel DB), la boucle d'événements peut exécuter ce timer :
- `playForAway` (l.1307) voit encore `this.turn === seatIndex` → saute le tour → `passerLaMain` (l.722) fait `turnId++`, `this.turn = victim`, **`this.pending = null`**, dégèle, rearme pour l'adversaire.
- puis `consume` se résout, `pickCell` reprend : elle applique `spec.apply` (mute les grilles), incrémente `bonusUsed`/`bonusJoues`, et `push` l'effet — **alors que c'est désormais le tour de l'adversaire**, `pending` déjà vidé. L'inventaire a été débité.

Pire cas : si ce timer est la 3ᵉ absence, `playForAway` appelle `forfeit → finish` (l.1516,1527) qui pose `settled = true`, `phase = OVER`, `clearTimers()`. La reprise de `pickCell` applique alors un effet **sur une partie déjà finalisée** ; `push` ne teste que `this.dead`, pas `settled`/`phase`. `setConnected` (déclenché par un socket, hors file lui aussi) peut de même passer la partie en pause pendant l'`await`.

Fenêtre : `hooks.consume` doit être en vol au moment où le timer expire. Un client hostile peut la maximiser en armant un effet payant et en retardant `pickCell`/`pickFace` jusqu'au bord du délai d'absence. Le chemin GRATUIT (`gratuit`) est synchrone (pas d'`await`) et n'est donc PAS concerné — seuls les effets payants (B002/B003 et achats) rejoignent la course. Correctif attendu : re-vérifier `this.turn === seatIndex && this.phase === PLAYING && this.pending && this.pending.seat === seatIndex && !this.settled` APRÈS l'`await`, avant `apply`.

### F2 — `finish` ignore l'échec du règlement (gravité : état incohérent / joueur lésé)
`/Users/develop/dice-server/src/game/match.js:1561-1566`
```js
this.hooks.finish({ match: this, reason: reason || 'normal', scores, results: [result0, 1 - result0] });
```
`finish` pose `settled = true` et `reglement = EN_COURS` puis appelle `hooks.finish` **sans observer son retour** (volontairement synchrone — le commentaire interdit d'y glisser un `await`). Si le règlement (transaction Elo/pièces/hauts faits, côté gateway) échoue, rien ici ne le rattrape : la partie reste `EN_COURS` avec `settled` déjà vrai, les récompenses ne sont jamais écrites, et aucune reprise n'est visible dans match.js. La responsabilité de la robustesse retombe entièrement sur `hooks.finish` (gateway.settle, hors lot) — à confirmer qu'il isole ses erreurs et fait avancer `reglement` jusqu'à `FAIT` même en cas d'échec partiel. Point 8 de la grille (retour d'erreur ignoré par l'appelant).

### F3 — `push` propage une exception de `hooks.broadcast` (gravité : partie bloquée, faible)
`/Users/develop/dice-server/src/game/match.js:497-501`
```js
push(fx) {
  if (this.dead) return;
  compteurs.absorber(this.bilanFx, fx);
  this.hooks.broadcast((seat) => ({ t: 'state', state: this.snapshot(seat), fx: fx || [] }));
}
```
Si `hooks.broadcast` (ou `snapshot`, ou `compteurs.absorber` — cf. rapport bilan.js sur `e.par` non borné) jette, l'exception remonte au milieu de la mutation d'état de l'appelant (`place`, `passerLaMain`, `activateBonus`…). Dans les chemins passant par `serialize` (avalé) ou `later`/`etape` (attrapé), c'est absorbé ; ailleurs (`maybeStartPlaying`, `mood`, `pickCell` après consommation) une pose partiellement appliquée pourrait laisser la table dans un état intermédiaire non diffusé. Dépend de la robustesse de `hooks.broadcast` (gateway, hors lot), qui doit isoler les erreurs par socket. Faible, mentionné pour complétude.

## Points forts (défenses notables)
- `later` (l.300) : try/catch + garde `this.dead` + libération du timer — le cœur de la protection des callbacks différés.
- `driveAi` (l.1474) : chaque étape isolée par `etape` (try/catch), re-vérification `aiStillPlaying` avant chaque étape, et filet de pose forcée — la table ne reste pas morte si une étape jette.
- `playForAway`/`aiStillPlaying` re-valident l'état à l'exécution : un timer périmé est un no-op.
- `finish` garantit une seule finalisation sans `await` (commentaire explicite contre l'ajout d'un `await`).
- `turnId` + `dejaVue` + garde de session dans `inMatch` ferment le rejeu de commandes.

## Verdict
3 FAILLES (gravité max : état incohérent). F1 est la plus sérieuse (course timer/await, exploitable par un client qui temporise). F2/F3 dépendent en partie de code hors lot (gateway).
