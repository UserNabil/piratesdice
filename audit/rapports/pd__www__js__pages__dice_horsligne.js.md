# Rapport d'audit — pd/www/js/pages/dice_horsligne.js

Fichier lu en entier par tranches (1-200, 200-400, 400-607). Rôle : moteur de
partie HORS LIGNE (`PartieHorsLigne`) + IA déterministe. Il doit produire la MÊME
suite de coups que `dice-server/src/game/horsligne.js` / `match.js`, sinon les
parties honnêtes sont rejetées à la vérification serveur.

## a) Liste des fonctions/méthodes

| nom | ligne |
|---|---|
| coupDeLaMachine (module) | 58 |
| opts (module) | 88 |
| PartieHorsLigne.constructor | 99 |
| get etat | 139 |
| auJournal | 142 |
| noter | 167 |
| instantane | 173 |
| lancer | 236 |
| poser | 245 |
| passerLaMain | 355 |
| peutJouer | 395 |
| effet | 407 |
| effetFace | 544 |
| facesPossibles | 559 |
| tourDeLaMachine | 569 |
| parler | 585 |
| verdict | 596 |

Écart de comptage : le lot annonce 38, je recense 17 fonctions/méthodes nommées
+ ~3 arrows inline (`s` dans instantane l.174 et verdict l.597, `.map` l.426). La
métrique auto sur-compte (probablement chaque branche/return). Aucune méthode
manquée.

## b) Analyse par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| coupDeLaMachine | choisit la meilleure colonne (déterministe, sans RNG) | aucun tirage (contrat respecté) ; renvoie -1 si rien, géré | OK |
| opts | assemble les options de score d'un siège | aucun | OK |
| constructor | initialise l'état de partie | défauts sur capitaines/parures/noms ; `generateur(graine)` robuste ; déstructure un arg supposé objet | OK |
| get etat | renvoie `this` | aucun | OK |
| auJournal | journal complet ou null si incomplet | garde `journalIncomplet` (pas de préfixe envoyé) | OK |
| noter | ajoute au journal, plafond 600 | marque incomplet au lieu de tronquer | OK |
| instantane | snapshot au format serveur | déclare la forme complète ; slices défensifs | OK |
| lancer | tire le dé (1 seul, journalisé) | gardes finie/tour/dé | OK |
| poser | pose le dé, applique destructions/effets | bornes colonne (`Number.isInteger`+bornes), gel, isColumnFull ; fin `||` corrigée | OK |
| passerLaMain | change le tour, consomme gel/coque | miroir du serveur ; garde protegeTours | OK |
| peutJouer | l'effet peut-il partir ? | restreint à B002/B003 (voir findings) | OK |
| effet | joue un effet | garde B002/B003 rend 11 branches MORTES + commentaire contradictoire | FAILLE (cosmétique) |
| effetFace | joue le dé pipé B012 | validation face stricte (±1, bornes) ; ne touche pas la RNG | OK |
| facesPossibles | faces atteignables | garde null/undefined | OK |
| tourDeLaMachine | tour IA complet | col<0 → passerLaMain (pas de table figée) | OK |
| parler | pique/taunt | `Math.random()` volontaire hors RNG graine (non journalisé) — contrat préservé | OK |
| verdict | résultat final | aucun | OK |

## c) Findings détaillés

### FAILLE 1 — effet() : 11 branches de code MORT + commentaire contradictoire
- dice_horsligne.js:416 `if (identifiant !== 'B002' && identifiant !== 'B003') return null;`
- Branches rendues inatteignables : B001 (l.423), B007 (l.431), B005 (l.450),
  B011 (l.454), B006 (l.458), B009 (l.470), B010 (l.478), B013 (l.490),
  B015 (l.497), B014 (l.503), B016 (l.513). Seule la branche B002/B003 (l.440)
  s'exécute jamais.
- Gravité : cosmétique (aucun crash, aucune partie bloquée) — MAIS risque latent
  de divergence.
- Le commentaire lignes 409-415 décrit une règle DIFFÉRENTE de celle qu'applique
  le code : il dit « DEUX EFFETS NE SE JOUENT PAS HORS LIGNE » (B004 longue-vue,
  B008 tour rallongé), ce qui suggère « tout sauf B004/B008 ». Le garde réel fait
  l'inverse : « rien SAUF B002/B003 ». La règle voulue (confirmée par le
  commentaire de `peutJouer` l.397-400 : « SEULS LES DEUX EFFETS DE BASE SE JOUENT
  ICI… Le verificateur du serveur refuse aux memes conditions ») est bien
  B002/B003 seulement ; le corps volumineux qui suit est du résidu d'une version
  antérieure. Pas de rejet de partie honnête aujourd'hui (rien de non-B002/B003
  n'est jamais journalisé), mais un mainteneur qui relâche le garde en se fiant
  au commentaire périmé réactiverait 11 branches non testées → divergence
  client/serveur = parties honnêtes rejetées (exactement le scénario « 167
  parties refusées » cité dans le fichier).

### Observation 2 — peutJouer ne connaît pas B012 (effet possiblement indisponible)
- dice_horsligne.js:401 `if (identifiant !== 'B002' && identifiant !== 'B003') return false;`
- `effetFace` (l.544) implémente pourtant le dé pipé B012 hors ligne avec une
  justification explicite (« hors ligne aussi », l.539-543). Si la couche d'UI
  (dice_solo.js, hors de ce lot) interroge `peutJouer('B012')` pour décider
  d'offrir cet effet, il serait grisé alors qu'il est jouable via `effetFace` +
  `facesPossibles`. Confiance moyenne (dépend d'un fichier hors lot). Gravité :
  cosmétique (effet possédé peut-être indisponible hors ligne), jamais bloquant.

Points positifs vérifiés : contrat RNG respecté (IA et `parler` ne consomment pas
la graine ; seuls quarts+dés le font, dans l'ordre) ; condition de fin `||`
alignée sur le serveur ; plafond de journal 600 avec marquage « incomplet » ;
bornes d'entrée solides (colonne, face, cellule via retours ok). Pas d'async, pas
de timer/listener retenu, pas d'accès concurrent (moteur synchrone mono-instance).

Statut fichier : FAILLES(1) [cosmétique — code mort + commentaire trompeur]
