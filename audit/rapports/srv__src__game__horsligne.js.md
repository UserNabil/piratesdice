# Rapport d'audit — srv/src/game/horsligne.js

Fichier : `/Users/develop/dice-server/src/game/horsligne.js` (356 lignes)
Métrique lot : 19 fonctions. **Compte réel : 2 fonctions nommées + 2 arrows = 4** (`refus`, `verifier`, `tourPasse`, `opts`). **Écart majeur signalé** : la métrique 19 sur-compte largement (probablement les nombreux `return refus(...)` / blocs `if (c.t===...)`) — recompté, aucune fonction cachée (grep `function`/`=>` : 4 constructions).

## a) Liste des fonctions

| nom | ligne |
|-----|-------|
| refus | 49 |
| verifier | 61 |
| tourPasse (arrow, dans verifier) | 107 |
| opts (arrow, dans verifier) | 327 |

## b) Grille par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| refus | fabrique un objet de rejet | pur | OK |
| verifier | rejoue et valide un journal de partie hors ligne (entrée CLIENT HOSTILE) | dés verrouillés par la graine, tour/pose/effet validés, partie complète exigée, score recalculé ; ne jette pas sur entrée malformée | OK |
| tourPasse | fait expirer les coques au changement de main | interne, bornes {0,1} | OK |
| opts | options de score par siège | pur | OK |

## c) Findings détaillés

Aucune FAILLE. C'est le point d'entrée le plus exposé du lot (journal fourni par un client potentiellement modifié) et il est écrit défensivement. Observations :

- **Robustesse hostile confirmée.** `verifier` rejette proprement (retourne `refus`, ne jette jamais) : journal absent/non-tableau (l.62), trop long (l.64), siège inconnu (l.65), coup illisible (l.116), siège illisible (l.118), dé annoncé ≠ dé de la graine (l.131), double tour (l.129), pose sans lancer / valeur non lancée / **colonne validée `Number.isInteger`+bornes** (l.138-140), colonne pleine/gelée, effet inconnu/joué deux fois/hors des deux effets de base, plafond d'effets (l.213), partie trop courte (l.314) et **partie inachevée** (l.325, exige qu'un plateau soit plein). Le score final est RECALCULÉ (`totalScore`, l.328), jamais lu du journal. Un client hostile ne peut donc pas gonfler son score au-delà de ce que permettent des dés verrouillés par la graine et des coups légaux — la seule faiblesse (l'adversaire IA est tenu par le téléphone hors ligne) est documentée et assumée (pas de classement, plafond quotidien).

- **Branches d'effet mortes (maintenabilité, pas sécurité).** La garde l.201 (`if (c.b !== 'B002' && c.b !== 'B003') return refus`) rejette tout effet hors B002/B003. La longue chaîne `else if` B005/B006/B007/B009/B010/B011/B012/B013/B014/B015/B016 (l.216-293) est donc **inatteignable**. Ces branches valident pourtant `Number.isInteger(c.case)` — elles sont prêtes si un jour on élargit la garde. Seule la branche réellement atteinte (B002/B003, l.219-223) **ne vérifie PAS `Number.isInteger(c.case)`** avant `rules.clearCell(grids[victime], c.case)`. Analysé : un `c.case` fractionnaire (ex. 1.5) passe la borne de `clearCell` mais y est un **no-op** (`compact` reconstruit sur indices entiers), donc rien n'est détruit — ce qui est neutre voire défavorable au tricheur (le dé adverse reste). Aucun gain, aucune corruption, aucun throw. Pas une faille, mais à aligner sur les autres branches par cohérence.

- **Pureté / concurrence.** `verifier` est une fonction pure : état local uniquement (grids, des, joues, protege…), aucun timer, aucun `await`, aucun état partagé entre appels. Deux vérifications concurrentes ne partagent rien.

- **Note cross-fichier (hors lot).** L'appelant `gateway.onHorsLigne` (gateway.js:666) n'entoure PAS `horsligne.verifier(...)` d'un try/catch — mais `verifier` ne jette pas sur entrée client (seule `tirage.generateur` sur une graine serveur malformée le pourrait, hors de ce fichier), et un rejet éventuel remonte au `dispatch(...).catch` (gateway.js:180). Sans conséquence attribuable à ce fichier.

## Verdict
OK (0 FAILLE). Fichier défensif exemplaire pour l'entrée hostile.
