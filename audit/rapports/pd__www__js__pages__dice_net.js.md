# Rapport d'audit — pd/www/js/pages/dice_net.js

Fichier lu en entier (227 lignes). Rôle : `DiceNet`, l'unique lien WebSocket +
REST vers le serveur de jeu (token HMAC, ping applicatif, détection de socket à
demi-morte, reprise). Module réseau critique.

## a) Liste des fonctions/méthodes

| nom | ligne |
|---|---|
| DiceNet.constructor | 40 |
| get ready | 50 |
| get vivant | 58 |
| get enCours | 65 |
| connect (async) | 73 |
| dispatch | 123 |
| send | 129 |
| startPing | 156 |
| perdue | 173 |
| stopPing | 188 |
| close | 192 |
| rest (async) | 200 |
| diceStatus (async, module) | 225 |

Écart de comptage : le lot annonce 25, je recense 13 méthodes/fonctions nommées
(getters compris) + les arrows internes (done, ws.onopen/onmessage/onerror/onclose,
callback setInterval, callback guard). La métrique auto compte chaque `=>`. Rien
de manqué.

## b) Analyse par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| constructor | initialise l'état de la liaison | pas d'I/O ; `handlers||{}` | OK |
| get ready | socket ouverte ? | pur | OK |
| get vivant | ouverte ET entendue récemment | pur (anti socket à demi-morte) | OK |
| get enCours | en cours d'ouverture ? | pur | OK |
| connect | jeton → socket → hello, résout au welcome | garde `settled`/`done` (pas de double-settle) ; `new WebSocket` try/catch ; timer `guard` borné et nettoyé partout ; JSON.parse gardé | OK |
| dispatch | route un message vers son handler | handler sous try/catch (log) ; `this.on[msg.t]` sans hasOwnProperty (voir c) | OK |
| send | envoie si prête, sinon false | garde `!ready` + try/catch | OK |
| startPing | ping périodique + détection de mort | stopPing d'abord ; `perdue()` si silence | OK |
| perdue | termine soi-même une liaison morte | détache les handlers AVANT close ; garde `!ws` ; `ws=null` avant close | OK |
| stopPing | arrête l'intervalle | garde `!pinger` | OK |
| close | fermeture volontaire | `closedByUs=true` ; try/catch close | OK |
| rest | appel REST porteur du même token | garde `!session` ; `no-store` ; JSON.parse gardé ; `!r.ok`→throw (propagé à l'appelant) | OK |
| diceStatus | santé du service | `getOr` avec repli — ne jette jamais | OK |

## c) Findings détaillés

Aucune FAILLE.

Une observation de très faible gravité :

1. `dispatch` — dice_net.js:124 `const fn = this.on[msg.t];` — gravité :
   cosmétique. La recherche du handler ne filtre pas les propriétés héritées : un
   `msg.t` hostile égal à `'constructor'`/`'toString'`/`'hasOwnProperty'` trouve
   une fonction héritée de `Object.prototype` et `fn(msg)` l'appelle ; un
   `'__proto__'` donne un objet non appelable et `fn(msg)` jette. Effet réel :
   nul ou une exception — le tout est enveloppé dans le try/catch (l.125) qui
   journalise et poursuit. C'est une lecture, pas une écriture : aucune pollution
   de prototype possible. `this.on` reste un objet de handlers de confiance.
   Un `Object.prototype.hasOwnProperty.call(this.on, msg.t)` fermerait la porte,
   mais l'impact actuel ne le justifie pas.

Points positifs remarquables : les rejets asynchrones de `connect`/`rest` sont
PROPAGÉS (pas avalés) — contrat correct pour une couche de liaison, l'appelant
gère ; le garde `settled` empêche tout double resolve/reject et neutralise un
`onclose`/`onerror` tardif après un welcome réussi ; le timer `guard` est nettoyé
dans les cinq chemins de sortie ; `perdue` détache les handlers avant de fermer
pour ne pas laisser une socket zombie détruire une liaison neuve — exactement le
genre de course inter-connexions qui piège ce type de code ; les frames JSON
malformées sont ignorées sans casser la boucle ; l'intervalle de ping est toujours
`stopPing()` avant d'être réarmé (pas d'accumulation).

Statut fichier : OK.
