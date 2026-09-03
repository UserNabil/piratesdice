# Rapport — srv/src/gateway.js (1861 lignes)

La passerelle WebSocket : sessions, file d'attente, salons privés, cycle de vie des parties (création/reprise/abandon/règlement), reprise après coupure, mode hors ligne, campagne, et déclenchement de l'entraînement IA. C'est le cœur temps réel, exposé aux messages clients.

## a) Fonctions (nom | ligne)
- `send` (top-level) | 88
- `Gateway.constructor` | 94
- `attach` | 120
- `balayerLesMuets` | 138
- `close` | 153
- `onConnection` | 160
- `onClose` | 190
- `park` | 221
- `trouverTableVivante` | 270
- `livrerFinEnAttente` | 301
- `resume` | 312
- `dequeue` | 362
- `tropVite` | 380
- `dispatch` | 389
- `onHello` | 435
- `publicPlayer` | 488
- `sendWallet` | 501
- `onPauseAway` | 515
- `onResync` | 521
- `onSkin` | 541
- `onMotif` | 551
- `onSucces` | 558
- `onReclamer` | 592
- `onJetons` | 624
- `onHorsLigne` | 654
- `reglerHorsLigne` | 710
- `onHistorique` | 756
- `onRejouer` | 790
- `onCaptain` | 824
- `onRename` | 850
- `capitainesCampagne` | 874
- `onCampagne` | 883
- `onCampagneJouer` | 902
- `sessionDuJoueur` | 958
- `purgeRooms` | 969
- `closeRoomOf` | 980
- `freshCode` | 988
- `onRoom` | 999
- `onRoomCreate` | 1028
- `onRoomJoin` | 1037
- `onRelancer` | 1102
- `enPartie` | 1156
- `inMatch` | 1183
- `onPlay` | 1232
- `engager` | 1293
- `premierAdversaire` | 1324
- `balayerLaFile` | 1369
- `onCancelQueue` | 1379
- `onLeave` | 1384
- `newMatch` | 1392
- `seatFromSession` | 1426
- `startSolo` | 1448
- `startVersus` | 1475
- `bindSession` | 1485
- `announce` | 1490
- `broadcast` | 1512
- `settle` | 1520
- `maybeTrain` | 1837

**Écart de comptage** : 59 fonctions/méthodes nommées recensées contre 165 annoncées. L'écart (~106) correspond aux ~62 arrow-functions/callbacks (`=>`) inline (hooks de `newMatch`, callbacks `serialize(() => …)`, `.map/.filter/.some`, handlers d'événements `ws.on(...)`, `child.on(...)`, `setInterval`/`setTimeout`) plus les fonctions imbriquées, tous comptés par la métrique auto. Fichier lu EN ENTIER (10 tranches).

## b) Grille par fonction
| nom | rôle | risques | statut |
|-----|------|---------|--------|
| send | envoie un JSON si la socket est ouverte | garde readyState + try/catch (mort en écriture avalé) | OK |
| constructor | initialise Maps/Sets d'état | pas d'I/O | OK |
| attach | monte le WS + heartbeat | `setInterval(...).unref()` ; **corps du tick non try/caught** (finding #1) | FAILLE |
| balayerLesMuets | termine les sessions muettes | `ws.terminate()` try/caught ; `onClose` NON gardé, dans le tick (finding #1) | FAILLE |
| close | arrêt : clearInterval, destroy matches, wss.close | libère timer et matches | OK |
| onConnection | pose les handlers de socket | parse JSON try/catch, valide `msg.t` string, `dispatch(...).catch()` gère les rejets | OK |
| onClose | démonte la session, gare la table | idempotent (supporte double appel) ; garde `place.session === session` | OK |
| park | met une table de côté + timer d'abandon | clearTimeout de l'ancienne ; **corps du setTimeout non try/caught** (finding #1) | FAILLE |
| trouverTableVivante | place vivante du joueur | garde settled/dead/kind/OPEN | OK |
| livrerFinEnAttente | remet un verdict gardé | delete avant contrôle d'âge ; `send` sûr | OK |
| resume | rassoit le joueur à sa table | garde settled/dead ; corps du timer d'abandon (via park) non gardé | OK |
| dequeue | retire de la file | pur | OK |
| tropVite | limite le débit (40 msg/s) | fenêtre glissante ; anti-flood | OK |
| dispatch | routeur des messages | rate-limit d'abord ; exige `hello` avant tout ; défaut → erreur ; rejets remontés à onConnection.catch | OK |
| onHello | authentifie, envoie l'accueil | `verifyToken`; `pingMs` borné 1000..60000 ; `capitainesCampagne(...).catch(()=>[])` ; `ensurePlayer`/Promise.all rejets → onConnection.catch | OK |
| publicPlayer | vue publique du joueur | `captains.has(...)` sinon défaut | OK |
| sendWallet | repousse bourse+inventaire | garde `!fresh` ; rejets remontés/parfois `.catch(()=>{})` par l'appelant | OK |
| onPauseAway | pause humaine | garde `!m/settled/dead` ; `!!(msg&&msg.on)` | OK |
| onResync | renvoie l'état courant | garde siège 0/1 ; sinon livrerFinEnAttente | OK |
| onSkin | porter une parure | `typeof msg.skin==='string'`, `slice(0,16)` ; possession vérifiée en base | OK |
| onMotif | porter un motif | idem onSkin | OK |
| onSucces | liste des hauts faits | lecture try/caught → liste vide ; `valeur` plafonnée à la cible | OK |
| onReclamer | récupère les hauts faits ouverts | `slice(0,200)` ; try/catch → 'claim failed' ; sendWallet awaité | OK |
| onJetons | remet des jetons hors ligne | try/catch → jetons vides | OK |
| onHorsLigne | vérifie/règle les parties hors ligne | `slice(0,5)` ; token + `horsligne.verifier` (finding #4) ; règlement try/caught, crédit annulé si panne | OK (faible) |
| reglerHorsLigne | règle une partie hors ligne comme un solo | `compteursDe` try/caught ; `settleMatch` awaité (rejet remonté à onHorsLigne.try) | OK |
| onHistorique | journal de bord | lecture try/caught → liste vide | OK |
| onRejouer | rediffusion d'une partie | lecture try/caught ; garde `!ligne`/`!images` | OK |
| onCaptain | change de capitaine | `captains.has` + `ouvert` OU campagne ; refus en partie ; `setCaptain` | OK |
| onRename | change de pseudo | longueur 2-10, regex unicode `\p{L}\p{N}`, insulte, unicité — **validation serveur complète** | OK |
| capitainesCampagne | capitaines gagnés en campagne | `.filter(Boolean)` ; rejets remontés | OK |
| onCampagne | tableau de campagne | reads base ; rejets remontés à dispatch.catch | OK |
| onCampagneJouer | lance un niveau | `niveauOuvert` (cadenas serveur) ; quitte l'ancienne table (siège capturé avant effacement) ; garde `engagement` + finally | OK |
| sessionDuJoueur | session vivante d'un joueur | préfère OPEN, repli sinon | OK |
| purgeRooms | expire les salons (TTL) | non périodique (appelé sur onRoom/onRelancer) | OK |
| closeRoomOf | ferme les salons du joueur | pur sur Map | OK |
| freshCode | code de salon unique | Math.random (finding mineur) ; 200 essais puis null | OK |
| onRoom | crée/rejoint/annule un salon | quitte la table (siège capturé avant effacement) ; défaut → erreur | OK |
| onRoomCreate | crée un salon | `freshCode` null → erreur | OK |
| onRoomJoin | rejoint un salon | code assaini + longueur ; refuse sa propre room / même joueur ; inscrit APRÈS acceptation ; une table par joueur | OK |
| onRelancer | rejouer avec le même ami | garde dispo + `engagement` des deux ; une table par joueur | OK |
| enPartie | le joueur est-il en partie ? (par joueur) | garde settled/dead | OK |
| inMatch | passage unique des commandes de partie | vérifie appartenance/siège/turnId/`dejaVue` ; `frappes` borné à 4000 ; **valeurs msg.* déléguées à Match** (finding #3) | OK |
| onPlay | demander à jouer | forfait de l'ancienne (siège capturé avant effacement) ; `engagement` marqueur synchrone anti-course + finally | OK |
| engager | crée solo/multi ou met en file | `getPlayer` awaité ; mode borné à solo/multi | OK |
| premierAdversaire | choisit un adversaire dans la file | nettoie les sockets mortes ; anti-rematch avec repli patience | OK |
| balayerLaFile | ré-apparie la file (tick) | borné 4 tours ; **`startVersus` non try/caught dans le tick** (finding #1) | FAILLE |
| onCancelQueue | quitte la file | pur | OK |
| onLeave | quitter une partie | garde `!match`/settled ; forfait via serialize | OK |
| newMatch | fabrique un Match + hooks | hooks `consume`/`balance`/`finish` : `finish` `.catch()`, `consume` `.catch(()=>{})` — rejets gérés | OK |
| seatFromSession | construit un siège humain | revalide le seuil de capitaine | OK |
| startSolo | table solo/campagne | lit `CAPTAINS[palier-1]` (voir note) ; addSeat/begin | OK |
| startVersus | table multi | addSeat/begin ; appelé aussi depuis un tick (finding #1) | OK |
| bindSession | lie session↔match↔siège | trivial | OK |
| announce | annonce la table aux 2 sièges | garde kind/session | OK |
| broadcast | diffuse (payload peut être fn du siège) | garde kind/session ; `send` sûr | OK |
| settle | règle la partie (Elo, or, hauts faits, étoiles, verdict) | try/catch partout sur les suppléments ; verdict gardé si socket morte ; **queue partielle hors try + destroy en fin** (finding #2) | OK (faible) |
| maybeTrain | fork le process d'entraînement | garde `training`/cooldown/pending ; `child.on('exit'/'error')` réarme le drapeau ; refresh `.catch()` | OK |

## c) Findings

### 1 — Les callbacks différés (heartbeat + timers de garde) ne sont pas protégés — gravité : crash process (latent)
`attach` (L123-126) :
```js
this.heartbeat = setInterval(() => { this.balayerLesMuets(); this.balayerLaFile(); }, HEARTBEAT_MS);
```
Ni le tick, ni `balayerLesMuets` (L138 → appelle `this.onClose(session)` sans try/catch), ni `balayerLaFile` (L1369 → `this.startVersus` → `match.begin()`), ni les corps de `setTimeout` de `park` (L241-249 : `match.serialize`/`match.setConnected`/`match.forfeit`) ne sont enveloppés dans un try/catch. **`index.js` n'installe QUE `process.on('unhandledRejection')`, PAS `process.on('uncaughtException')`.** Une exception synchrone jetée dans l'un de ces callbacks de timer remonte donc comme `uncaughtException` non gérée → **arrêt du process**, ce qui tue toutes les parties en cours (pas seulement la session fautive). Le déclenchement dépend de la capacité de `onClose`/`park`/`startVersus`/`match.serialize`/`match.begin` à jeter de façon synchrone (code de `game/match.js`, hors lot) : c'est donc un risque latent, mais la surface est réelle et un simple `try/catch` par tick/timer (comme le fait déjà `send`) l'éliminerait. C'est le seul chemin du fichier qui n'est pas bordé par le filet `dispatch(...).catch()` / `finish(...).catch()`.

### 2 — `settle` : la destruction du match est atteinte seulement si aucune exception n'échappe aux sections awaitées — gravité : fuite ressource (conditionnel)
Les blocs lourds de `settle` sont chacun try/caught (compteurs L1605-1623, settleMatch L1650-1668, étoiles campagne L1677-1714, poserCompteurs L1700-1713 par siège, collector.store L1785, antibot L1803). Mais la **boucle finale « over »** (L1715-1783) contient des appels non gardés — notamment `match.snapshot(i)` (L1771) — et la queue conclusive
```js
match.reglement = REGLEMENT.FAIT; match.destroy(); this.matches.delete(match.id);
```
ne s'exécute qu'après toutes les `await`. Si `match.snapshot(i)` (ou un autre appel de cette section) jette, `settle` rejette → rattrapé par le `.catch` du hook `finish` (log), MAIS `match.destroy()`/`matches.delete()` ne tournent jamais : le match **reste dans `this.matches`** (fuite mémoire + faussage de la jauge `matches` de `/health`) et `reglement` n'est jamais `FAIT`. Probabilité faible (snapshot sur un match fini valide), mais la conclusion de partie n'a pas la même robustesse défensive que les suppléments qu'elle protège.

### 3 — Valeurs de commande non validées dans la passerelle, déléguées à Match — gravité : dépend de match.js (informational)
`dispatch` route vers `inMatch` en passant les valeurs brutes du client :
```js
case 'place':  return this.inMatch(session, (m, seat) => m.place(seat, msg.column), msg);
case 'bonus':  return this.inMatch(session, (m, seat) => m.activateBonus(seat, msg.identify), msg);
case 'cell':   return this.inMatch(session, (m, seat) => m.pickCell(seat, msg.cell), msg);
case 'face':   return this.inMatch(session, (m, seat) => m.pickFace(seat, msg.face), msg);
case 'mood':   return this.inMatch(session, (m, seat) => m.mood(seat, msg.mood), msg);
```
`inMatch` valide l'appartenance, le siège, `turnId` et l'idempotence (`dejaVue`), mais **jamais** `msg.column`/`identify`/`cell`/`face`/`mood` eux-mêmes. La robustesse face à un client hostile (colonne hors bornes, cell négative, identify inconnu) repose **entièrement** sur les gardes d'état de `game/match.js` (documenté L1197-1201). Ce n'est pas une faille de la passerelle, mais c'est la surface « messages client non validés » : à corréler avec l'audit de `match.js` (hors lot). Si une de ces méthodes de Match jette au lieu de renvoyer une erreur, c'est bordé par `dispatch(...).catch()` (pas de crash), mais le point 3 de la grille n'est satisfait que sous cette hypothèse.

### 4 — `horsligne.verifier` appelé sans try/catch sur un journal client — gravité : partie hors ligne non réglée (faible)
`onHorsLigne` (L720) :
```js
const vu = horsligne.verifier(p.journal, Number(jeton.seed), 0, config);
```
`p.journal` vient du client. Si `verifier` jette sur un journal biscornu (au lieu de rendre `{ok:false}`), l'exception avorte tout le paquet de ≤5 parties et le handler de message renvoie un « server error » générique au lieu d'un refus par entrée. Le reste de la boucle (`consommerJeton`, `settleMatch`) est bien `.catch`é/try-caught ; seule cette vérification ne l'est pas. Dépend de la robustesse de `game/horsligne.js` (hors lot).

### 5 — Croissance mémoire lente de `dernierDuel` et `finEnAttente` — gravité : fuite ressource (faible)
`this.dernierDuel` (écrit dans `settle` L1547-1548) et `this.finEnAttente` (écrit L1779) sont indexés par `playerId`. `finEnAttente` est bien supprimé lors de la reprise (`livrerFinEnAttente` fait `delete` avant même le contrôle d'âge), et `dernierDuel` est réécrit à chaque duel — mais **aucun balayage périodique** ne purge les entrées de joueurs qui ne reviennent jamais. Sur un serveur à longue durée de vie avec un grand nombre de joueurs distincts, ces deux Maps croissent sans borne (une entrée persistante par joueur jamais revenu). Le contrôle `FIN_GARDEE_MS` n'empêche que la livraison, pas l'accumulation. Croissance lente, non critique, mais réelle.

## Observations (non-failles)
- **`freshCode` (L988)** utilise `Math.random` (pas `crypto`) pour un code de 5 signes sur un alphabet de 24 (~8 M combinaisons, TTL 15 min). Deviner un salon vivant permet seulement de s'asseoir comme adversaire d'un inconnu — valeur faible, compromis assumé.
- **Anti-abus solides et documentés** : garde « une table par JOUEUR » (pas par socket) contre le double-solde ; marqueur `engagement` synchrone contre la course de double-table ; `tropVite` contre le flood ; capture du siège avant effacement pour ne pas déclarer vainqueur le déserteur ; `dejaVue`/`turnId` contre le rejeu de commande ; cadenas capitaine/campagne/boutique côté serveur.
- **Robustesse de fin de partie** : `settle` est conçu pour ne JAMAIS priver le joueur de son verdict à cause d'un supplément (compteurs/rediffusion/hauts faits/étoiles tous enfermés), et garde le verdict (`finEnAttente`) si la socket est morte — bonne discipline.
- **`maybeTrain`** isole correctement l'entraînement CPU-lourd dans un process forké (confirme la mitigation des findings selfplay/trainer).

Statut : FAILLES(5) [crash process]
