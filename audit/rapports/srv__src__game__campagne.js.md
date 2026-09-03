# Rapport d'audit — srv/src/game/campagne.js

Fichier : `/Users/develop/dice-server/src/game/campagne.js` (96 lignes)
Métrique lot : 11 fonctions. **Compte réel : 8 fonctions nommées + arrow** (`defs.find((d) => …)` ligne 77) ≈ 9. Écart = arrows/approximation.

## a) Liste des fonctions

| nom | ligne |
|-----|-------|
| sbireDe | 27 |
| etoiles | 36 |
| orDesEtoiles | 46 |
| compterEtoiles | 52 |
| etoilesDuPalier | 57 |
| palierOuvert | 67 |
| niveauOuvert | 74 |
| paliersCompletes | 84 |

## b) Grille par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| sbireDe | hash stable playerId+identify → nom de sbire | `String()` sur tout ; hash borné `% 20` | OK |
| etoiles | masque d'étoiles gagnées par la partie | `def` non gardé : `def.contrainte2` jette si `def` null ; `releve` gardé `\|\| {}` | OK (def = donnée serveur) |
| orDesEtoiles | or des étoiles nouvelles | bitwise, borné sur 3 | OK |
| compterEtoiles | compte les bits du masque | pur | OK |
| etoilesDuPalier | somme les étoiles d'un palier | `defs` doit être itérable, `progression.get` doit exister | OK (structures serveur) |
| palierOuvert | palier ouvert si le précédent a assez d'étoiles | idem | OK |
| niveauOuvert | niveau ouvert selon palier + victoire précédente | `defs.find`/`progression.get` | OK |
| paliersCompletes | indices des paliers 15/15 | boucle bornée 1..15 | OK |

## c) Findings détaillés

Aucune FAILLE.

Notes de vigilance :
- Module **purement calculatoire** : aucune I/O, aucun réseau, aucun `await`, aucun timer, aucun état mutable partagé (les constantes sont en lecture seule). Le commentaire d'en-tête revendique cette pureté et elle est respectée.
- `etoiles`, `etoilesDuPalier`, `niveauOuvert` déréférencent `def`/`defs`/`progression` sans garde null. Ces objets sont les **définitions de campagne construites côté serveur** et une `Map` de progression, pas des entrées client directes ; un `def`/`progression` absent lèverait un `TypeError` chez l'appelant, mais rien dans le lot ne montre un chemin où un client hostile fournirait ces structures. À confirmer côté gateway (hors lot) que l'id de niveau reçu du client est bien résolu en `def` valide avant d'arriver ici.

## Verdict
OK (0 FAILLE).
