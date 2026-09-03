# Audit — srv/test/shop_lock.test.js

Fichier : `/Users/develop/dice-server/test/shop_lock.test.js` — 60 lignes.
Nature : test unitaire (`node:test`) de `Gateway.enPartie` — la boutique se ferme pendant une partie, garde posée sur le JOUEUR et non la session.

`nb_fonctions` annoncé : 8. Compté : 8. **Concordant.**

## a) Liste des fonctions

| nom | ligne |
|---|---|
| `passerelle(sessions)` (helper) | 17 |
| arrow `.map((s, i) => [i, s])` | 19 |
| cb test « bourse libre quand le joueur n est a aucune table » | 23 |
| cb test « bourse bloquee des qu une partie est en cours » | 28 |
| cb test « une partie finie ou morte ne bloque plus rien » | 33 |
| cb test « la garde porte sur le JOUEUR, pas sur la session » | 40 |
| cb test « la partie d un autre joueur ne ferme pas ma bourse » | 50 |
| cb test « une session sans joueur identifie ne fait rien planter » | 55 |

## b) Analyse par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| `passerelle` | fabrique une `Gateway` par `Object.create(Gateway.prototype)` et lui greffe une `Map` de sessions | contourne le constructeur : seul `sessions` est peuplé. `enPartie` ne lit que `this.sessions`, donc OK aujourd'hui ; pattern fragile si `enPartie` venait à lire un autre champ (TypeError). Cosmétique/maintenance, pas un défaut runtime | OK |
| arrow `.map` | indexe chaque session par sa position | aucun | OK |
| cb l.23 | vérifie `enPartie=false` sans table | aucun — l'échec d'assert est le but même du test | OK |
| cb l.28 | vérifie `enPartie=true` partie en cours | aucun | OK |
| cb l.33 | vérifie qu'une partie `settled`/`dead` ne bloque plus | aucun | OK |
| cb l.40 | vérifie que la garde suit le joueur (2 sessions, achat sur l'autre onglet) | aucun ; couvre bien l'invariant métier | OK |
| cb l.50 | vérifie qu'un autre joueur ne ferme pas ma bourse | aucun | OK |
| cb l.55 | vérifie `player:null`, `''`, `undefined` ne plantent pas | aucun ; couvre explicitement le point 4 de la grille (entrées null/vides) sur `enPartie` | OK |

Passage de la grille (8 points) : tests synchrones sans I/O, sans timer, sans ressource ni état partagé concurrent — points 1/2/3/5/6/7/8 sans objet. Point 4 (entrées null/undefined/hors bornes) : explicitement couvert par `enPartie` et son test l.55. Aucune Promise, aucun `await`, aucun callback différé.

## c) Findings détaillés

Aucune faille. Le fichier est un test de garde correct et complet pour son objet.

Note (non-faille, cosmétique) : `Object.create(Gateway.prototype)` court-circuite le constructeur ; le test tient uniquement parce que `enPartie` n'accède qu'à `this.sessions`. À signaler comme dépendance implicite, sans gravité.

**Statut fichier : OK**
