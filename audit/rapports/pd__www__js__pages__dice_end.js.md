# Rapport d'audit — pd/www/js/pages/dice_end.js

Fichier lu en entier (272 lignes). Rôle : construit la carte de fin de partie
(verdict, score, rang, pièces, étoiles de campagne, hauts faits) à partir du
message `over` reçu du serveur.

## a) Liste des fonctions

| nom | ligne |
|---|---|
| hautsFaits | 41 |
| objectifTexte | 67 |
| etoilesCampagne | 72 |
| onOver | 92 |

Écart de comptage : le lot annonce 17, je recense 4 fonctions nommées. Le reste
(≈13) sont des arrow-fonctions inline (map l.51/83, `.find` l.213, handlers
`leave` l.203, `onclick` l.214/223/266) comptées par la métrique auto. Aucune
fonction manquée.

## b) Analyse par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| hautsFaits | HTML du bandeau des 3 hauts faits gagnés | `Array.isArray` garde ; `m.maudits`/gains numériques insérés sans `esc` (l.56) mais serveur-only | OK |
| objectifTexte | libellé traduit d'un objectif, repli sur code | `dit && !dit.startsWith` gère undefined | OK |
| etoilesCampagne | HTML des 3 étoiles de campagne | `if(!c) return''` ; champs manquants → bitwise 0, cosmétique | OK |
| onOver | rend et arme la carte de fin, câble les boutons | accès non gardé à `m.scores[0/1]` et `$('#dc-over')` ; exception avalée par le routeur → carte jamais affichée | FAILLE |

## c) Findings détaillés

### FAILLE 1 — onOver : `m.scores` / élément DOM non gardés (partie bloquée)
- dice_end.js:142 `<div class="dc-over-score">${m.scores[0]} <span>—</span> ${m.scores[1]}</div>`
- dice_end.js:115 `const el = $('#dc-over');` puis l.138 `el.innerHTML = ...`
- Gravité : partie bloquée.
- `onOver` n'a aucun try/catch interne et le commentaire lignes 183-194 confirme
  que le routeur de messages AVALE les exceptions levées ici (« levait une
  exception a chaque VICTOIRE, avalee par le routeur de messages — la carte
  etait construite, complete, et jamais allumee »). Si le message `over` arrive
  sans `scores` (ou `scores` non-tableau), `m.scores[0]` lève un TypeError ; de
  même si `#dc-over` est absent, `el.innerHTML` lève. L'exception est avalée :
  la carte de fin n'est jamais allumée (`el.classList.add('on')` l.195 non
  atteint) et surtout `UI.leaveMatch = leave` (l.204) n'est jamais posé, donc le
  joueur peut rester coincé sur l'arène sans moyen de sortir vers le menu.
- C'est exactement le point 4/5 de la grille : entrée serveur non validée qui,
  si elle est absente/malformée, laisse le joueur bloqué. Probabilité faible en
  serveur de confiance (le `over` porte toujours `scores`), mais la fonction
  n'oppose aucune défense et l'historique du fichier montre que ce chemin a déjà
  échoué silencieusement une fois (la `rain()` non importée).

### Observations mineures (non bloquantes)
- dice_end.js:56 `m.maudits` et l.142 `m.scores[*]` insérés dans l'HTML sans
  `esc()`. Valeurs numériques fournies par le serveur : pas de XSS réaliste tant
  que le serveur n'est pas compromis. Gravité : cosmétique.
- dice_end.js:229/251/264 : retours de `S.net.send(...)` ignorés. Pour l.264 un
  garde `!S.net || !S.net.ready` (l.260) bascule en hors-ligne avant, donc pas
  de silence. Pour `relancer`/`campagne.jouer`, un envoi perdu ne rend aucun
  feedback, mais le contexte (socket prête) le rend improbable. Gravité :
  cosmétique.

Statut fichier : FAILLES(1) [partie bloquée]
