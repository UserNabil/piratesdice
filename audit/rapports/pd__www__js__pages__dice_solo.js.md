# Rapport d'audit — pd/www/js/pages/dice_solo.js

Chemin réel : `/Users/develop/piratesdice/www/js/pages/dice_solo.js`
Lignes : 314. Lu en entier (2 tranches de 200).

Rôle du fichier : « serveur de poche » — un faux serveur local qui fait tourner
une partie hors ligne en parlant exactement le même protocole (`roll`, `place`,
`bonus`, `cell`, `face`…) que `S.net`, pour que `dice_match.js` ne sache pas
qu'il est hors ligne.

## a) Liste de toutes les fonctions

| nom | ligne |
|-----|-------|
| constructor(partie, handlers) | 55 |
| get ready() | 68 |
| fermer() | 70 |
| plusTard(fn, ms) | 76 |
| pousser(fx) | 83 |
| avecVisee() | 104 |
| conclure() | 138 |
| faireJouerLaMachine() | 163 |
| send(msg) | 178 |
| ouvrirPartieHorsLigne(config, handlers) | 305 |

Écart de comptage : le lot annonce 21 fonctions ; je compte 10 méthodes/fonctions
nommées. L'écart vient des fonctions fléchées passées à `setTimeout`/`plusTard`
(callbacks aux lignes 77, 164-167, 168) et des entrées littérales du `Map`
`A_CIBLE` (non-fonctions). La métrique auto est gonflée par les `=>`. Pas de
fonction nommée manquante.

## b) Analyse par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| constructor | Initialise l'état du faux serveur (partie, handlers, set d'horloges, drapeau mort, effet en attente). | aucun | OK |
| get ready | Toujours prêt tant que pas mort. | aucun | OK |
| fermer | Marque mort et libère tous les `setTimeout` (clearTimeout + clear du Set). | aucun — libération correcte des timers | OK |
| plusTard | Enveloppe `setTimeout` qui s'auto-retire du Set et n'exécute `fn` que si pas mort. | corps `fn()` non protégé (point 3) — voir Finding 1 | FAILLE |
| pousser | Diffuse l'état (`on.state`) sauf si mort ou pas de handler. | `avecVisee()` et `on.state()` peuvent jeter ; non attrapé, mais appelé souvent depuis les callbacks différés → voir Finding 1 | OK |
| avecVisee | Construit l'instantané du moteur + le champ `pending` de visée. Gère null/undefined de `premiere`. | lecture d'état ; validation nulle correcte | OK |
| conclure | Émet le message `over` de fin de partie avec `horsLigne:true`. | `on.over()` peut jeter ; propagé au callback différé | OK |
| faireJouerLaMachine | Programme le tour de l'IA après un délai, se rappelle en chaîne. | exception non attrapée dans le callback → chaîne de tours IA interrompue → partie figée. Finding 1 | FAILLE |
| send | Porte d'entrée unique : `switch` sur `msg.t`, route vers le moteur. | entrées locales (écran, pas réseau hostile) ; validation déléguée au moteur ; retour ignoré par l'appelant (mineur) | OK |
| ouvrirPartieHorsLigne | Ouvre la partie, crée le faux serveur, émet `match`, lance l'IA. | `handlers.match()` peut jeter ; appel synchrone à l'ouverture | OK |

## c) Findings détaillés

### Finding 1 — Callback différé non protégé : la chaîne de tours de l'IA peut figer la partie hors ligne
- Emplacement : `plusTard` `dice_solo.js:76-80` ; `faireJouerLaMachine` `dice_solo.js:163-172`.
- Gravité : partie bloquée.
- Extrait :
```js
plusTard(fn, ms) {
  const h = setTimeout(() => { this.horloges.delete(h); if (!this.mort) fn(); }, ms);
  this.horloges.add(h);
  return h;
}
...
faireJouerLaMachine() {
  if (this.mort || this.partie.finie) return;
  if (this.partie.tour === this.partie.moi) return;
  this.plusTard(() => {
    const fx = this.partie.tourDeLaMachine();
    this.pousser(fx || []);
    if (this.partie.finie) this.plusTard(() => this.conclure(), 700);
    else this.faireJouerLaMachine();
  }, PAUSE_MACHINE);
}
```
- Pourquoi c'est un risque : le corps du callback différé n'est protégé par
  aucun `try/catch`. Si `this.partie.tourDeLaMachine()` jette (ou si
  `pousser` → `avecVisee` → `this.partie.instantane()` / `facesPossibles`
  jette, ou si le handler `on.state` de l'écran jette), l'exception part dans
  le contexte du timer, non attrapée. Or c'est précisément dans ce callback que
  se trouve le rappel `this.faireJouerLaMachine()` qui enchaîne le tour suivant :
  une seule exception coupe la chaîne, l'IA ne rejoue plus jamais, et la partie
  hors ligne reste figée sur le tour de la machine sans aucune voie de
  récupération (aucun message d'erreur, aucun `over`). Grille point 1 (exception
  jetée dedans, attrapée nulle part) et point 3 (callback différé, corps non
  protégé). À comparer avec `send()` qui, lui, est appelé depuis l'écran (pile
  synchrone) et dont une exception remonterait au moins à l'appelant.

## Statut fichier : FAILLES(1) [partie bloquée]
