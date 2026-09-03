# Rapport d'audit — srv/src/game/captains.js

Fichier : `/Users/develop/dice-server/src/game/captains.js` (208 lignes)
Métrique lot : 10 fonctions. **Compte réel : 8 fonctions nommées + arrows** (`CAPTAINS.map((c) => …)` ligne 138) ≈ 9. Écart = arrows/approximation.

## a) Liste des fonctions

| nom | ligne |
|-----|-------|
| has | 141 |
| get | 145 |
| traitOf | 149 |
| seuilOf | 154 |
| ouvert | 166 |
| offreDe | 171 |
| seuilDEffet | 185 |
| pick | 196 |

## b) Grille par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| has | l'id est-il un capitaine connu | `typeof id === 'string'` avant `.has` | OK |
| get | capitaine par id, sinon défaut | retourne TOUJOURS un capitaine valide (fallback DEFAULT_ID) | OK |
| traitOf | trait d'un id | `get()` ne rend jamais undefined | OK |
| seuilOf | seuil (parties) d'un id | `\|\| 0` | OK |
| ouvert | capitaine débloqué pour N parties | valide `Number(parties) \|\| 0` ; barrière serveur du déblocage | OK |
| offreDe | effet offert par un capitaine | `\|\| null` | OK |
| seuilDEffet | parties requises pour acheter un effet | boucle sur table constante, min si doublon | OK |
| pick | capitaine aléatoire (IA) | `Math.min(len-1, floor(r*len))` borne l'index même si rng≥1 | OK |

## c) Findings détaillés

Aucune FAILLE.

Notes de vigilance :
- Module de **lecture seule** sur des tables constantes (`CAPTAINS`, `BY_ID`, `OFFRE_PAR_TRAIT`) : pas d'état mutable partagé, pas d'async, pas de timer.
- **Défense entrée hostile solide** : `get()` (ligne 145) est le pivot — il retombe sur `DEFAULT_ID` pour tout id inconnu, si bien que `traitOf`/`seuilOf`/`offreDe` ne peuvent jamais déréférencer `undefined` quel que soit l'id envoyé par le client. `ouvert()` (barrière serveur du déblocage de capitaine, revendiquée « la seule barrière qui compte ») valide `parties` via `Number()` et refuse tout id non connu. `pick()` borne son index. Aucun chemin où une entrée client mène à un crash ou à un déblocage non mérité ici.
- `seuilDEffet` est appelé par la route boutique (`src/http.js:196`) pour verrouiller la vente d'un effet ; il tolère un `identify` inconnu (retourne seuil 0) — cohérent avec B002/B003 « offerts d'entrée » — pas une faille, mais à garder à l'esprit : un identify inconnu n'est pas verrouillé par CE gate (le verrou d'existence de l'effet se fait ailleurs, dans store.purchase*).

## Verdict
OK (0 FAILLE).
