# Rapport d'audit — pd/www/js/pages/dice_replay.js

Fichier lu en entier par tranches (1-200, 200-326). Rôle : le journal de bord —
liste des parties rejouables et le LECTEUR de rediffusion (pas à pas, piste,
lecture auto). Le client ne recalcule rien : les images viennent du serveur
(`game/rediffusion.js`).

## a) Liste des fonctions

| nom | ligne |
|---|---|
| stopper | 38 |
| fermerLecteur (export) | 42 |
| quand | 51 |
| ligneHistoire | 63 |
| renderReplays (export) | 80 |
| ouvrirRejeu (export) | 113 |
| image | 218 |
| peindre | 229 |
| phrase | 264 |
| lancer | 291 |
| basculer | 299 |
| majBouton | 307 |

Écart de comptage : le lot annonce 40, je recense 12 fonctions nommées + les
arrows inline (handlers onclick/oninput, `.map`/`.forEach`, `nom`/`bouton`/`dit`).
Métrique auto sur-comptée. Rien manqué.

## b) Analyse par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| stopper | arrête l'horloge | garde `lecteur && lecteur.horloge` + clearInterval | OK |
| fermerLecteur | ferme le lecteur, nettoie | stopper + `lecteur=null` + retire la classe | OK |
| quand | date localisée d'un ISO | garde `!iso` + `isNaN` + try/catch fallback | OK |
| ligneHistoire | ligne d'historique | `esc` sur adversaire (nom joueur) ; `p.resultat`/`p.id` non `esc` (enum/num serveur) | OK |
| renderReplays | liste des rejeux | repli outOfReach si `!S.net` ; `if(S.net)` sur send | OK |
| ouvrirRejeu | monte le lecteur | garde `!partie||!Array.isArray(images)||!length` ; `moi` normalisé ; `nom()` gardé ; noms `esc` | OK |
| image | image courante | accès direct (contexte lecteur garanti) | OK |
| peindre | pose une image | clamp de l'index ; gardes `if(board)`/`if(piste)`/`if(legende)` ; fait confiance à `im.grids/colonnes` | OK |
| phrase | légende d'une image | `esc` partout ; fait confiance à `im.totaux/t/...` | OK |
| lancer | démarre l'horloge | stopper d'abord ; borne `>= length-1 → stopper` ; intervalle ≥120ms | OK |
| basculer | play/pause | relance depuis 0 si à la fin | OK |
| majBouton | icône play/pause/replay | garde `!b`/`img` ; setAttribute (pas d'innerHTML) | OK |

## c) Findings détaillés

Aucune FAILLE.

Observations de faible gravité :

1. `peindre`/`phrase` — dice_replay.js:229/264 — gravité : cosmétique. Les deux
   font confiance à la structure de l'image serveur (`im.grids`, `im.colonnes`,
   `im.totaux`, `im.victime`…) sans try/catch. Une image malformée lèverait dans
   le callback de `setInterval` (`lancer`, l.291) qui n'est pas enveloppé : le
   `setInterval` continue de battre, donc l'erreur se répéterait à chaque tick.
   Données produites par un serveur de confiance (`rediffusion.js`) → probabilité
   très faible. Les gardes `if(board)` couvrent un `im.victime` hors bornes.

2. Injection — dice_replay.js:67-68 `dc-hist-'+p.resultat` et `data-rejouer="'+p.id+'"`
   non `esc`. `p.resultat` est un enum serveur (win/loss/draw) inséré dans un
   attribut `class`, `p.id` est numérique dans `data-*`. Serveur de confiance,
   valeurs contraintes → risque quasi nul. Le champ SENSIBLE (nom d'adversaire,
   contrôlé par un autre joueur) EST correctement `esc` (l.70), de même que les
   noms de joueurs du lecteur (l.153, `phrase` l.266).

Ressource VÉRIFIÉE (pas de fuite) : l'horloge (`lecteur.horloge`, setInterval)
n'est arrêtée que via `stopper`/`fermerLecteur`, mais le shell (`dice.js`) appelle
bien `fermerLecteur()` à la fermeture (l.1278), au retour accueil (l.1265) ET au
changement d'onglet (l.1286 `if (S.panel !== name) fermerLecteur()`). Le scénario
« horloge qui tourne derrière un panneau fermé, sons dans le vide » — que
l'en-tête du fichier redoute — est donc effectivement couvert. `ouvrirRejeu`
appelle aussi `fermerLecteur` en tête (l.116), évitant deux horloges concurrentes.

Statut fichier : OK.
