# Audit — pd/www/js/boot.js

Fichier : `/Users/develop/piratesdice/www/js/boot.js` — 768 lignes.
Nature : démarrage de l'application (Capacitor/WebView) : session, barre d'état, bouton RETOUR, liens d'invitation, modale de réglages, garde anti-sortie, boucle de reconnexion.
Fonctions annoncées : 93. Recomptées : **20 `function` nommées + ~49 fonctions fléchées** (handlers `oninput`/`onclick`/`onchange`, callbacks `addListener`/`map`/`filter`, arrows locales `code`/`dedans`/`ouvrirDedans`/`peindre`/`dit`/`fire`…). Le total ≈ 93 correspond à la métrique qui compte chaque `=>`. Pas d'écart de fonction manquante.

## a) Liste des fonctions (nommées + arrows notables)

| nom | ligne |
|-----|-------|
| reglerBarreEtat (async) | 41 |
| host | 53 |
| splashOff (async) | 70 |
| wireArrierePlan | 87 |
| brancherLiens | 106 |
| code (arrow, dans brancherLiens) | 110 |
| wireBackButton | 127 |
| fire (arrow) | 128 |
| versionLisible | 166 |
| row | 173 |
| volRow | 186 |
| settingsMarkup | 206 |
| dit (arrow) | 232 |
| openSettings | 338 |
| close/back (arrows) | 348-349 |
| peindre (arrow) | 368 |
| demuter | 417 |
| addHeaderButtons | 517 |
| fermerLesPortes | 556 |
| dedans / ouvrirDedans (arrows) | 557 / 564 |
| wireMotion | 612 |
| start (async) | 623 |
| pretAAfficher | 676 |
| direEchec | 711 |
| relancer | 741 |
| essayer | 749 |
| + handlers UI inline | 360-495, 763-766 |

## b) Analyse fonction par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| reglerBarreEtat | passe la barre d'état en overlay/DARK | try/catch, garde `if (!bar)` | OK |
| host | renvoie #dicewrap ou body | aucun | OK |
| splashOff | cache le splash natif | try/catch | OK |
| wireArrierePlan | coupe le son en arrière-plan | callback listener sans try/catch (S.sfx.taire() pourrait lever) | OK (mineur) |
| brancherLiens | branche les liens d'invitation | `code` a un try/catch ; listener `appUrlOpen` : `rejoindreParLien` non protégé (rejet possible non géré) | OK (mineur) |
| code | extrait+assainit le code d'invitation | try/catch, filtre `[^A-Z0-9]` | OK |
| wireBackButton | rend le bouton RETOUR inoffensif | listeners permanents (voulus) ; corps non try/catch | OK |
| versionLisible | version affichable | **assainit** `build` via `[^0-9a-z.]` avant HTML | OK |
| row | gabarit d'une ligne HTML | insère `label`/`body` bruts (données app, pas client) | OK |
| volRow | ligne de volume HTML | valeurs numériques/traductions | OK |
| settingsMarkup | HTML de la modale réglages | **`nomVif` (nom serveur) injecté dans innerHTML via `who`/`t()` sans échappement HTML explicite** (seule l'attribut `value` échappe les `"`) | FAILLE |
| openSettings | monte la modale, branche tout | listener `pd-back {once}` non retiré si fermeture par la croix/le voile → **fuite d'écouteur** ; `data-erase`/`signOut` sans try/catch (échec silencieux) | FAILLE |
| peindre | repeint une ligne de volume | suppose les sous-éléments présents (garantis par le markup) | OK |
| demuter | lève la coupure générale | gardes présentes | OK |
| addHeaderButtons | ajoute le bouton réglages | garde anti-doublon (id) | OK |
| fermerLesPortes | empêche la sortie de l'app | try/catch partout ; `ouvrirDedans` avale ses erreurs ; sécurité positive | OK |
| wireMotion | secouer = lancer | **`S.state.dice[S.seat]` sans garde si `dice` undefined** → throw dans canRoll | OK (fragile) |
| start | orchestre le démarrage | rejets remontent à `essayer().catch` (bon) ; `brancherStudio().then` sans `.catch` ; **non ré-entrant** (voir F1) | FAILLE (concurrence) |
| pretAAfficher | attend la 1re peinture | **plafond 3 s** (Promise.race) + `.catch` polices — bien fait | OK |
| direEchec | carte d'échec + compte à rebours | `setInterval` s'auto-nettoie (contains) ; masque l'adresse/erreur brute | OK |
| relancer | reprogramme une tentative | clear du timer précédent (anti-doublon de timer) | OK |
| essayer | start() + backoff | `.then/.catch` complet, backoff exponentiel plafonné | OK |

## c) Findings détaillés

### F1 — start()/essayer() ré-entrants : deux démarrages concurrents dupliquent écouteurs et session
`boot.js:623` (start), `boot.js:749` (essayer), `boot.js:763-766` (déclencheurs)
```javascript
function essayer() { return start().then(...).catch(...); }
window.addEventListener('online', () => { retente = RETENTE_MIN; relancer(0); });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && carteEchec) { retente = RETENTE_MIN; relancer(0); }
});
```
Gravité : **état incohérent**.
`relancer` empêche deux *timers* simultanés (il `clearTimeout` le précédent), mais **rien n'empêche un `start()` de démarrer alors qu'un `start()` précédent est encore en cours d'`await`** (signIn/openDice sur le réseau). Si l'événement `online` survient pendant qu'un `start()` est suspendu sur une requête lente, `relancer(0)` programme un `essayer()` immédiat → un second `start()` s'exécute en parallèle. Or plusieurs étapes de `start()` ne sont **pas idempotentes** : `wireBackButton` (631), `wireArrierePlan` (632), `brancherLiens` (641), `fermerLesPortes` (640, réajoute un écouteur de clic en capture et réécrase `window.open`), `wireMotion` (643) ajoutent chacun un nouvel écouteur à chaque appel. Conséquences : un lien d'invitation traité DEUX fois (`rejoindreParLien` double), un « secouer » qui envoie deux `roll`, des écouteurs `backButton`/`appStateChange` empilés. `addHeaderButtons` est le seul protégé (garde par id). Il manque un verrou « un seul démarrage en vol » (drapeau `enCours` testé en tête de `start`/`essayer`).

### F2 — Nom d'affichage inséré dans innerHTML sans échappement HTML explicite (XSS potentiel)
`boot.js:212-213` puis `boot.js:261` (via `row`)
```javascript
const nomVif = (S.me && S.me.name) || acc.name;
const who = acc.google ? t('set.signedInAs', { name: nomVif }) : t('set.guest');
...
${row(t('set.account'), `<span class="pd-row-val">${who}</span>`)}
```
Gravité : **état incohérent (XSS in-page potentiel)**.
`settingsMarkup()` est posé via `wrap.innerHTML` (ligne 341). Le nom du joueur (`nomVif`, fourni par le serveur) transite par `t('set.signedInAs', {name})` puis est concaténé dans le HTML **sans échappement `<`/`>`/`&`**. Le champ de saisie du pseudo, lui, échappe explicitement les guillemets (ligne 275, `replace(/"/g,'&quot;')`) et `versionLisible` assainit le build (ligne 169) — mais ce chemin-ci ne bénéficie d'aucune protection équivalente. Si l'interpolation de `t()` (i18n.js, hors lot) n'échappe pas, un nom contenant `<img src=x onerror=…>` exécute du script dans la page, avec accès à la socket/session. Atténuations existantes : le serveur valide les pseudos (longueur/caractères/insultes, cf. commentaire ligne 270-273) et `fermerLesPortes` neutralise la navigation sortante et `window.open` (limite l'exfiltration, sans empêcher l'exécution en page). À sécuriser côté client par un échappement HTML systématique du nom, ou à confirmer que `t()` échappe ses interpolations.

### F3 — Fuite d'écouteur `pd-back` dans openSettings
`boot.js:348-352`
```javascript
const close = () => { if (oublier) oublier(); wrap.remove(); };
const back = (ev) => { ev.preventDefault(); close(); };
document.addEventListener('pd-back', back, { once: true });
wrap.onclick = (ev) => { if (ev.target === wrap) close(); };
wrap.querySelector('[data-close]').onclick = close;
```
Gravité : **fuite ressource (mineure) / cosmétique**.
L'écouteur `pd-back` `{once:true}` n'est retiré **que s'il se déclenche**. Fermer la modale par la croix (`[data-close]`) ou en touchant le voile appelle `close()` mais **ne fait pas `removeEventListener('pd-back', back)`**. À chaque cycle ouvrir/fermer par ces voies, un écouteur `pd-back` survit, capturant un `wrap` déjà retiré. Au prochain appui RETOUR, `fire()` (128) dispatche `pd-back` : tous les écouteurs résiduels se déclenchent (chacun `preventDefault()` + `close()` no-op), `defaultPrevented` passe à vrai, et `wireBackButton` **saute l'action réelle** (retour à l'accueil) une fois. Correctif : retirer l'écouteur dans `close()`.

### F4 — Rejets async avalés / actions échouant en silence
`boot.js:487`, `boot.js:489-495`, `boot.js:663`
```javascript
if (outBtn) outBtn.onclick = async () => { await signOut(); location.reload(); };
...
wrap.querySelector('[data-erase]').onclick = async () => {
  close();
  if (!await uiConfirm(...)) return;
  await eraseAccount();     // pas de try/catch
  toast(t('set.erased'), 'ok');
  setTimeout(() => location.reload(), 900);
};
...
brancherStudio().then((la) => { ... });   // pas de .catch
```
Gravité : **cosmétique → action silencieuse**.
`data-erase` et `data-signout` n'ont pas de `try/catch` : si `eraseAccount()`/`signOut()` rejettent (réseau, refus serveur), la promesse rejette sans message, le `toast` et le `reload` ne s'exécutent pas — le joueur a confirmé l'effacement et ne voit rien se passer. `brancherStudio().then(...)` sans `.catch` (663) laisse un rejet non géré (hors chemin critique). `inBtn`/`signIn` (480-484), lui, gère bien (try/catch + réactivation).

### F5 — wireMotion: accès non gardé à S.state.dice
`boot.js:616`
```javascript
canRoll: () => !!(myTurn() && S.state && S.state.dice[S.seat] === null),
```
Gravité : **cosmétique (fragile)**.
`S.state` est bien testé, mais si `S.state` existe sans `dice` (état partiel envoyé par le serveur), `S.state.dice[S.seat]` lève un TypeError dans le callback `canRoll`, appelé par le module `motion` (hors lot) à chaque évaluation de secousse. Dépend de la robustesse de `startMotion`. Une garde `S.state.dice &&` fiabiliserait.
