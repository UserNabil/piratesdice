# Audit — srv/test/file_attente.test.js (86 lignes)

Fichier de test lu en entier. Framework `node:test`. Lot annonce **11 fonctions**,
**~11 trouvées** (écart 0 : `socket`, `send`(méthode), `passerelle`, `startVersus`
(arrow stub), `joueur` (arrow), 6 rappels `test`, 1 `.map` arrow l.51 — la métrique
tombe juste au rappel de comptage).

## (a) Fonctions

| nom | ligne |
|---|---|
| `socket` | 13 |
| `send` (méthode de socket) | 14 |
| `passerelle` | 17 |
| `startVersus` (stub arrow) | 22 |
| `joueur` | 26 |
| test « deux inconnus s apparient tout de suite » | 28 |
| test « deux joueurs qui viennent de s affronter… » | 35 |
| test « un troisieme joueur est pris a la place » | 45 |
| test « passe le delai, le duel redevient possible » | 54 |
| test « le balayage apparie… ne boucle pas sur un refus » | 62 |
| test « une socket morte est retiree de la file » | 79 |

## (b) Ce que ça couvre / fiabilité

| nom | rôle | risques | statut |
|---|---|---|---|
| `socket` | faux WebSocket (`readyState`, `OPEN`, capture des `send`) | aucun | OK |
| `passerelle` | instancie `Gateway.prototype` par `Object.create`, câble `queue`/`dernierDuel`/`appariements` et **stub `startVersus`** | teste les VRAIES méthodes `premierAdversaire` et `balayerLaFile` (bon) ; mais `startVersus` réel n'est jamais exercé (par conception, isolation) | OK |
| `joueur` | fabrique `{ws, player:{id}}` | aucun | OK |
| tests l.28-52 | apariement immédiat, refus d'un rematch récent, saut vers un tiers | assertions présentes et déterministes (`strictEqual`, `deepStrictEqual` sur la file résiduelle) | OK |
| test l.54 | passé le délai, rematch de nouveau permis, via `Date.now() - 120000` | **couplé au constant réel `REMATCH_MS=90000`** : 120000 > 90000 donc vert. Fragile SI on relève REMATCH_MS au-delà de 120 s (le test casserait sans que la logique soit fausse). Pas flaky (offset relatif à `Date.now()`). | OK (note) |
| test l.62 | `balayerLaFile` n'apparie pas deux ennemis récents et ne boucle pas ; puis délai passé → 1 appariement | assertions sur `appariements.length` et `queue.length` ; couvre l'anti-boucle | OK |
| test l.79 | socket morte (`readyState=3`) purgée au passage | assertion sur file vidée | OK |

## (c) Findings

- **file_attente.test.js (global) | couverture manquante — pas faussement vert mais trou** :
  la vraie `premierAdversaire` (gateway.js:1324) a une branche **repli** (`PATIENCE_REMATCH_MS=6000`)
  qui, après assez d'attente, RETOURNE le même adversaire récent (« on préfère le
  même adversaire à aucun », gateway.js:1346-1356). Aucun test ne fixe
  `enFileDepuis`, donc `attente=0 < 6000` : cette branche — la plus risquée — n'est
  **jamais exercée**. Les tests l.35/45/62 ne prouvent QUE le refus, pas la reprise
  après patience. Un bug dans le repli passerait tous ces tests au vert.
- **file_attente.test.js:57,73-74 | cosmétique** | `Date.now() - 120000` : valeur
  en dur couplée à `REMATCH_MS`. Documenter le lien ou dériver du constant.
- Pas de `setTimeout`/async/`await` : aucun risque de timing réel. Assertions toutes présentes.

**Verdict : OK (1 trou de couverture noté : branche repli/patience non testée)**
