# Audit — srv/test/horsligne.test.js (195 lignes)

Fichier de test lu en entier. Framework `node:test`. Lot annonce **22 fonctions**,
**~22 trouvées** (13 rappels `test` + `partieHonnete` + `avec` + de nombreux
`.map`/`.filter`/arrow inline l.68/83/91/140/141 + comparateurs de boucle. Écart ~0,
métrique cohérente au comptage des `=>`).

## (a) Fonctions

| nom | ligne |
|---|---|
| `partieHonnete` | 30 |
| test « une partie honnete est acceptee… RECALCULE » | 52 |
| test « des de annonces plus hauts… refuse au premier » | 64 |
| test « le meme journal sous une autre graine ne passe pas » | 75 |
| test « une pose dans une colonne pleine est refusee » | 81 |
| test « poser sans avoir lance, ou lancer deux fois… » | 89 |
| test « une partie ecourtee ne rapporte rien » | 97 |
| test « un journal trop long est refuse avant… » | 103 |
| test « la longue-vue est refusee hors ligne… » | 108 |
| test « le meme tirage des deux cotes… » | 114 |
| test « hors ligne, seul un effet de base passe… » | 131 |
| `avec` (arrow interne l.139) | 139 |
| test « jouer deux fois de suite est refuse » | 160 |
| test « une partie qu on abandonne… est refusee » | 183 |
| test « le plafond de lignes est au-dessus… » | 192 |

## (b) Ce que ça couvre / fiabilité

| nom | rôle | risques | statut |
|---|---|---|---|
| `partieHonnete` | rejoue une partie complète depuis une graine via VRAIS `tirage`+`rules` (s'arrête quand un plateau est plein) ; `jusqua` fabrique exprès une partie inachevée | helper complexe : un bug ici ferait échouer les tests (pas faussement vert) ; bien commenté | OK |
| l.52 | partie honnête acceptée + score **recalculé serveur** (`poses>=24`, `totaux>0`, `resultat∈{0,.5,1}`) | assertions présentes ; `totaux[i]>0` dépend de la graine 4242 mais déterministe | OK |
| l.64-112 | fraudes : dés gonflés (`/de annonce/`), mauvaise graine, colonne pleine (`/colonne pleine/`), pose sans lancer (`/pose sans lancer/`), partie courte (`/trop courte/`), journal trop long (`/trop long/`), longue-vue B004 (`/longue-vue/`) | **chaque test vérifie le MOTIF de refus** (`assert.match(vu.refus, /…/)`), pas juste `ok===false` : très robuste | OK |
| l.114 | déterminisme du RNG : deux graines identiques → mêmes dés, graines différentes → dés différents | assertions `deepStrictEqual`/`notDeepStrictEqual` | OK |
| l.131 | seuls B002/B003 passent la porte hors-ligne ; B007/B005/B011/B006/B012 refusés (`/ne se joue pas hors ligne/`) | boucle avec message par cas ; l.150 assertion NÉGATIVE bien cadrée (B003 ne doit pas être bloqué par CETTE porte, peut échouer plus loin) | OK |
| l.160 | jouer deux tours de suite refusé (`/deux tours de suite/`) — anti « jouer les 12 dés seul » | assertion forte | OK |
| l.183 | partie abandonnée en cours (`/inachevee/`) | assertion sur le motif | OK |
| l.192 | garde sur le constant `MAX_COUPS >= 400` | protège contre une coupure sous la longueur réelle (276) | OK |

## (c) Findings

- Aucun test faussement vert. Tout appelle le **vrai** `src/game/horsligne.verifier`
  avec des graines déterministes ; les assertions vérifient le **motif exact** du
  refus (`assert.match(vu.refus, …)`) — le contraire d'un test qui se contenterait
  de `assert.ok(!vu.ok)`. C'est le fichier de test le plus rigoureux du lot.
- Pas d'async, pas de `setTimeout`, aucune dépendance à l'horloge ni à l'aléa non
  semé. Reproductible.
- **horsligne.test.js:60 | cosmétique** | `assert.ok(vu.totaux[0] > 0 && vu.totaux[1] > 0)`
  couple la graine 4242 à un résultat où les deux camps marquent. Déterministe ;
  un changement de règle qui mettrait un camp à 0 le casserait (détection correcte,
  pas faux positif). Noté par exhaustivité.
- **horsligne.test.js:150-152 | cosmétique** | assertion négative `!/…/.test(refus || '')` :
  passe aussi si `verifier` renvoie `ok:true` (refus indéfini) OU un autre refus.
  C'est l'intention documentée (on ne teste QUE cette porte), donc correct — mais
  une régression qui rendrait B003 accepté à tort ailleurs ne serait pas vue ICI.

**Verdict : OK**
