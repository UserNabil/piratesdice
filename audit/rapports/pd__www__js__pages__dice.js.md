# Audit — pd/www/js/pages/dice.js (1597 lignes)

Fichier lu en entier (4 tranches). Lot annonce **153 fonctions**. **40 fonctions nommées** (déclarations `function`) + ~113 callbacks/arrows (l'objet de handlers `DiceNet` ~30 flèches, les assignations `UI.*`, et les callbacks `forEach`/`setTimeout`/`.then`) ≈ 153 (grep « function-like » = 156). Écart cohérent.

## (a) Fonctions nommées (nom | ligne)

peindreOnglets|93 · shellMarkup|101 · build|205 · reveiller|350 · openDice|410 · connect|423 · rendreLaMain|708 · connectFailed|736 · enPartie|788 · arreterRelance|798 · relancerPlusTard|803 · requestClose|831 · closeDice|855 · onKey|869 · toggleFull|896 · syncFull|910 · nombre|954 · tailleBourse|968 · palierCourant|982 · etoilesPalier|987 · capitaineDuPalier|991 · fermerDeroulantCampagne|997 · objectifCampagne|1001 · missionAtteinte|1014 · renderWalletMissions|1074 · renderWalletCampagne|1097 · basculerDeroulantCampagne|1136 · renderWallet|1170 · showMenu|1225 · ouvrirPanneau|1244 · togglePanel|1252 · animerOnglet|1349 · rafraichirRang|1380 · peindreBulles|1403 · marquerOnglets|1426 · refreshPanel|1439 · envoyerLesParties|1457 · graineLocale|1480 · jouerHorsLigne|1490 · initDice|1546

Callbacks notables : objet handlers `new DiceNet({...})` l.423-703 (welcome, me, captains, jetons, campagne, campagne.resultat, horsligne, historique, rejouer, succes, reclame, queued, idle, room, roomfail, match, state, over, error, denied, closed) ; assignations `UI.*` dans initDice (l.1546-1596) ; `setInterval` sentinelle l.383 ; écouteurs `online/visibilitychange/pageshow/focus` l.395-408.

## (b) Par fonction (risques notables)

| nom | rôle | risques | statut |
|---|---|---|---|
| peindreOnglets | éteint les onglets réseau hors ligne | gardes DOM ; forEach sûr | OK |
| shellMarkup | gabarit HTML du shell | `esc(t(...))` dans attributs `"..."`; `${o.art}`/`${o.id}` viennent de la constante ONGLETS | OK |
| build | construit le shell une fois, charge sons/musique, câble les boutons | idempotent (`S.built`) ; `surVolume` posé après `peindreMute` (zone morte évitée, commenté) ; keydown/fullscreenchange non retirés (vie app) | OK |
| reveiller | relance/reprend la connexion au retour réseau/veille | gardes `S.open/S.net/S.poche`; `close()` en try/catch | OK |
| connect | ouvre la socket DiceNet + handlers | protège l'offline (`S.poche`) ; roue seulement au 1er lancement ; `try/catch` autour de `net.connect` (l.296-297) ; garde `if (S.net===net)` | OK (voir #4) |
| onKey | raccourcis clavier de jeu | **`S.state.dice[S.seat]` sans vérifier `dice`** — voir #1 | FAILLE (mineur) |
| toggleFull | plein écran | `requestFullscreen().catch(()=>{})` ; `exitFullscreen` en try/catch | OK |
| closeDice | ferme l'overlay + socket | `exitFullscreen` try/catch ; `S.net.close()` ; remet l'état | OK |
| requestClose | demande de fermeture (confirme si partie vive) | `uiConfirm(...).then(...)` **sans `.catch`** (l.837) | OK (mineur) |
| nombre | formate un montant (abrège, toLocaleString) | `Number(n)||0`, `Math.max(0,...)`; `toLocaleString` en try/catch | OK |
| missionAtteinte | évalue une mission d'étoile sur l'état courant | gardes `(st.grids&&st.grids[me])||[]`; `Math.max.apply` protégé par `!cs.length` | OK |
| renderWallet* | peint le bandeau (bourse/rang/missions/campagne) | repli `cale.moi()` hors ligne ; `esc()` + `nombre()` (numérique) dans les gabarits | OK |
| basculerDeroulantCampagne | menu déroulant paliers + fermeture au clic ailleurs | `setTimeout(...,0)` pose l'écouteur `pointerdown` capture, retiré à la fermeture | OK |
| togglePanel | ouvre/ferme/bascule un panneau | `S.sfx.play` suppose `S.sfx` (créé en build, toujours avant) ; jette le cache à l'ouverture | OK |
| animerOnglet | anime l'icône d'onglet (APNG) | `minuteursOnglet` Map + `clearTimeout` par art (pas de collision) | OK |
| rafraichirRang | relit le rang via REST | `typeof S.net.rest==='function'` ; try/catch → garde l'ancien | OK |
| jouerHorsLigne | lance une partie IA locale | pose `S.poche`/`S.net` ; restaure `S.net=vrai` dans `over/idle` ; `auJournal()` nul géré | OK (voir #5) |
| initDice | câble les crochets `UI.*` | assignations simples | OK |

## (c) Findings

1. **dice.js:888 et 891 (onKey) | état incohérent (mineur / client hostile)** | `if (S.state.dice[S.seat] === null) ...` puis `... && S.state.dice[S.seat] !== null` | Le garde l.885 vérifie `phase==='playing'` et `turn===seat` mais PAS l'existence du tableau `S.state.dice`. Un état 'playing' malformé/hostile sans `dice` fait lever un TypeError dans le gestionnaire `keydown` (avalé par le navigateur ; la touche ne fait rien). Serveur normalement autoritaire (dice présent). Gravité : état incohérent, mineur.
2. **dice.js:382-408 | cosmétique / fuite (par conception)** | `setInterval(()=>{...},3000)` sentinelle resync + écouteurs `online/visibilitychange/pageshow/focus` jamais retirés | Vie de l'app (module chargé une fois). Si `S.net.send` levait, l'exception s'échappe du callback d'intervalle (non fatale, l'intervalle continue). Acceptable.
3. **dice.js:837 (requestClose) | cosmétique** | `uiConfirm(...).then((yes)=>{...})` sans `.catch` | rejet éventuel de `uiConfirm` → rejet non géré. `uiConfirm` (dialogs.js) résout normalement. Low.
4. **dice.js:427-703 (connect/handlers) | état incohérent (mineur, mitigé)** | le handler `welcome` (l.461-501) utilise `S.net.send(...)` au lieu de `net.send(...)` | Si `reveiller()` a remplacé `S.net` pendant l'attente, `welcome` parlerait sur la nouvelle socket. Les gardes `if (S.net !== net) return` (closed, l.469) et le drapeau `S.poche` couvrent l'essentiel des courses. Mineur.
5. **dice.js:1490-1543 (jouerHorsLigne) | état incohérent (mineur)** | `const poche = ouvrirPartieHorsLigne(...)` avant `S.poche/S.net = poche` | si `ouvrirPartieHorsLigne` lève, `S.net` reste le vrai serveur (OK) ; dans le handler `over`, `poche.partie.auJournal()` lèverait si `poche.partie` absent (dépend de dice_solo.js, hors lot). Low.

## Note sécurité (positif)

Tous les gabarits `innerHTML` de dice.js échappent les données dynamiques via `esc()` **dans des attributs à guillemets doubles** (couverts par `&quot;`), et les `vars` passées à `t()` sont numériques (`nombre()`, index de palier) → **pas d'XSS exploitable ici**. La faille latente reste dans la primitive `esc` (dom.js, apostrophe) et la substitution non échappée de `t()` (i18n.js:86). Fichier globalement très défensif (fetch bornés, backoff, gardes DOM systématiques).

**Verdict : FAILLES(1) [état incohérent]** (onKey ; le reste est cosmétique/mitigé)
