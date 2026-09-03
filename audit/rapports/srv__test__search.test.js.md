# Audit — srv/test/search.test.js (227 lignes)

Fichier de test lu en entier. Framework `node:test`. Lot annonce **26 fonctions**,
**~20 comptées** (2 helpers `randomGrid`/`tauxContreGlouton` + 11 rappels `test` +
plusieurs arrows inline `filter`/`map`/`reduce`. La métrique auto gonfle via `=>` ;
écart signalé, non bloquant).

## (a) Fonctions

| nom | ligne |
|---|---|
| `randomGrid` | 11 |
| test « le chemin rapide … identique aux regles » | 20 |
| test « le score rapide est identique … » | 44 |
| test « une seule colonne jouable … sans chercher » | 56 |
| test « prefere finir la partie en tete » | 69 |
| test « detruit la pile adverse plutot qu empiler » | 85 |
| test « l evaluation voit la menace » | 95 |
| test « traits rapides … identiques a l evaluation » | 116 |
| test « la clef de transposition distingue … » | 137 |
| `tauxContreGlouton` | 165 |
| test « la recherche ecrase … le glouton » | 195 |
| test « un jeu de poids absurde est refuse » | 210 |
| test « le duel de qualification … coherent et symetrique » | 220 |

## (b) Ce que ça couvre / fiabilité

| nom | rôle | risques | statut |
|---|---|---|---|
| `randomGrid` | grille aléatoire semée | pur (RNG injecté) | OK |
| l.20/44/116 | **tests d'équivalence** chemin rapide `search.*` vs `rules.*`/`eval.*` sur 4000/2000/3000 tirages semés (`mulberry32`) ; tolérance `<1e-12` sur les traits | déterministes (seed fixe) ; forte valeur anti-régression ; l.41 exige un échantillon `>3000` | OK |
| l.56/69/85 | comportements ciblés (coup forcé profondeur 0, préférer finir en tête, détruire 45 pts) | assertions `strictEqual`/`includes` précises | OK |
| l.95 | l'éval voit la menace ; l.107 **garde** que les deux positions adverses ont le MÊME score (sinon on mesurerait autre chose) | bonne conception ; assertion `sheltered > exposed` | OK |
| l.137 | injectivité de `positionKey` sur 4000 positions | property test ; couverture probabiliste (4000 ≪ espace) mais non faussement vert | OK |
| `tauxContreGlouton` / l.195 | **benchmark statistique** recherche vs glouton, 5 graines × 300 parties, seuil `moyenne >= 0.55` | voir findings (dépendance vitesse machine via `timeMs`) | OK (note fragilité) |
| l.210 | `sanitizeWeights` refuse mauvais cardinal/null/valeurs absurdes, accepte un jeu valide | pur, assertions exactes | OK |
| l.220 | duel de qualification symétrique : poids identiques → score dans `]0.3, 0.7[` | assertion robuste à la vitesse (symétrie indépendante de la profondeur) ; `timeout:120000` | OK |

## (c) Findings

- Aucun test faussement vert : tout appelle les **vrais** modules
  (`search`/`eval`/`ai`/`selfplay`/`rules`) avec RNG semé et assertions présentes.
- **search.test.js:195-208 | fragilité machine (potentiel faux ROUGE, et régression fine masquée)** :
  le benchmark borne la recherche par le TEMPS (`timeMs: 30`), pas par un nombre
  d'itérations. Le taux de victoire mesuré dépend donc de la **vitesse de la machine**
  et de sa charge : sur un CI lent/chargé, 30 ms achètent moins de profondeur et le
  taux peut glisser vers le seuil 0,55 (l'en-tête reconnaît « dix millisecondes
  n'achètent plus la même profondeur »). Robuste sur machine rapide (mesuré ~58 %),
  mais c'est un test perf à seuil : il ne détecte que les **grosses** régressions —
  une baisse 58 %→56 % passe toujours au vert. `timeout: 120000` confirme le coût.
  Non flaky sur l'aléa (5 graines fixes), flaky sur le temps.
- **search.test.js:220-227 | cosmétique** | idem `timeMs: 4`, mais l'assertion ne
  porte que sur la **symétrie** (mirror match ≈ 50 %), invariante à la profondeur :
  robuste à la vitesse. Bien conçu.
- Pas de `setTimeout`, pas d'`await` (tout synchrone) ; seule dépendance externe =
  le budget temps des deux bancs ci-dessus.

**Verdict : OK (fragilité notée : le banc l.195 dépend de la vitesse machine et ne
capte que les grosses régressions)**
