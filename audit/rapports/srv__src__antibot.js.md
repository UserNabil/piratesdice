# srv/src/antibot.js

Ecart avec le lot : nb_fonctions=18. Recompte manuel : 6 fonctions nommees
(`moyenne`, `ecartType`, `intervalles`, `plusLonguePlage`, `noter`, `expliquer`)
+ ~5 fleches inline (reduce/sort/map). La metrique auto (18) est nettement
surevaluee (elle gonfle sur `=>` et methodes). Pas d'impact : toutes couvertes.

Module PUR, sans I/O, sans DB, sans reseau (exigence explicite de l'en-tete).

## a) Fonctions
| nom | ligne |
|-----|-------|
| moyenne | 65 |
| ecartType | 70 |
| intervalles | 86 |
| plusLonguePlage | 101 |
| noter | 122 |
| expliquer | 168 |

## b) Par fonction
| nom | role | risques | statut |
|-----|------|---------|--------|
| moyenne(xs) | moyenne arithmetique | garde `!xs.length` -> 0 ; pas de division par zero | OK |
| ecartType(xs) | ecart-type (echantillon) | garde `xs.length<2` -> 0 (evite /(n-1) avec n=1) | OK |
| intervalles(horodatages) | intervalles <=120s entre commandes | dans `noter` toujours un tableau ; expose pour tests, un non-tableau leverait sur `.length` mais aucun appel de prod ne le fait | OK |
| plusLonguePlage(horodatages,pauseMs) | plus longue plage sans pause | garde `length<2` -> 0 ; `pauseMs||defaut` | OK |
| noter(activite) | score 0-100 + signaux | TRES defensif : `activite||{}`, `Array.isArray` sinon [], `Number(a.parties)||0` ; gere null/undefined/entrees hostiles sans lever | OK |
| expliquer(note) | phrase lisible des signaux | latence : `!note` gere null/undefined, mais un objet TRONQUE (`{}` sans `.signaux`) ferait lever `note.signaux.length` (TypeError). Attrape par le SEUL appelant (voir finding) | OK |

## Analyse detaillee (grille)
- **Exception (pt 1)** : `expliquer({})` peut lever un TypeError, MAIS l'unique appelant
  `gateway.js:1804-1817` enveloppe `noter(...)`+`expliquer(...)` dans un try/catch qui
  logge et NE TOUCHE PAS au reglement (« Un score de suspicion ne doit JAMAIS couter son
  reglement au joueur »), et lui passe toujours la sortie de `noter` (qui a `signaux:[]`).
  L'exception est donc attrapee ET inatteignable avec les entrees reelles.
- **Entrees hostiles (pt 4)** : `noter` neutralise null/undefined/non-tableau/non-nombre.
  Les horodatages viennent de `s.session.frappes` (timestamps cote serveur), non forgeables.
- **Ressources / concurrence / rejets** : sans objet — fonction pure, synchrone.

## c) Findings (latent, non bloquant)
`srv/src/antibot.js:169` — gravite : cosmetique (crash local attrape). `expliquer` garde
`!note` mais pas `!note.signaux` : `expliquer({})` (objet truthy sans `signaux`) leve
`Cannot read properties of undefined (reading 'length')`. Non atteignable en prod (seul
appelant fournit la sortie de `noter` et l'entoure d'un try/catch qui protege la partie).
Incoherence defensive a durcir si `expliquer` devenait appele ailleurs.

## Statut : OK
