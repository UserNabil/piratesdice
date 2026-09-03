# Rapport d'audit — pd/www/js/ui/studio.js

Chemin réel : `/Users/develop/piratesdice/www/js/ui/studio.js`
Lignes : 100. Lu en entier.

Rôle du fichier : outil de DÉVELOPPEMENT. « L'oreille » de l'aperçu : interroge
un atelier local (`localhost:8123` / `10.0.2.2:8123`) 5×/s et applique les
variables CSS reçues sur `#dicewrap`. S'arrête après 3 échecs (aucun coût sur un
vrai téléphone où personne ne répond à localhost).

## a) Liste de toutes les fonctions

| nom | ligne |
|-----|-------|
| appliquer(vars) | 38 |
| demander() [async] | 53 |
| chercherAtelier() [async] | 70 |
| brancherStudio() [async] | 88 |

Écart de comptage : le lot annonce 8 fonctions ; je compte 4 fonctions nommées
(aucune fonction fléchée dans ce fichier — il utilise `await`, pas `.then`).
L'écart est une sur-estimation de la métrique auto (probablement les boucles
`for...of` ou les `async function` comptées double). Aucune fonction manquante.

## b) Analyse par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| appliquer | Pose les variables CSS reçues sur `#dicewrap`, retire celles disparues. | garde `!wrap` ; `setProperty`/`removeProperty` (pas d'exécution de code) ; source = atelier local dev uniquement | OK |
| demander | Récupère l'état de l'atelier et applique le delta. | try/catch couvre fetch+json (point 2 OK) ; `d.vars||{}` ; coupe l'interval après 3 échecs (point 6 OK) | OK |
| chercherAtelier | Cherche l'atelier sur les hôtes connus, une tentative chacun. | try/catch par hôte → `null` ; pas de throw propagé | OK |
| brancherStudio | Branche l'aperçu, arme l'interval de sondage. | `!base` → false ; interval stocké dans `minuterie` (voir note non bloquante) | OK |

## c) Findings détaillés

Aucune faille. Outil de développement sans impact en production : sur un vrai
appareil, `chercherAtelier` renvoie `null`, `brancherStudio` renvoie `false`,
aucun interval n'est armé.

Notes non bloquantes :
- Grille point 4 : `appliquer` fait `wrap.style.setProperty(nom, vars[nom])` avec
  des noms/valeurs venant de la réponse JSON de l'atelier. `setProperty`
  n'exécute pas de code (au pire une valeur CSS ignorée), et la source est un
  serveur local de dev — pas de surface d'injection exploitable.
- Grille point 6 : un double appel à `brancherStudio` écraserait `minuterie`
  sans `clearInterval` du premier, orphelinant un interval de sondage (fuite
  d'outil de dev uniquement, jamais atteinte en production). L'appelant unique
  après premier rendu rend le cas théorique.
- Grille point 7 : `setInterval(demander, 200)` peut lancer des `demander`
  concurrents si l'atelier répond en >200 ms ; effet au pire cosmétique
  (application de variables dans le désordre), sans casse d'invariant de jeu.

## Statut fichier : OK
