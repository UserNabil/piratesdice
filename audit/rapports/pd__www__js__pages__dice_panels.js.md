# Rapport d'audit — pd/www/js/pages/dice_panels.js

Fichier lu en entier par tranches (1-200, 200-400, 400-600, 600-800, 800-974).
Rôle : les panneaux du rail — règles (modale), campagne, boutique (achat/parures),
hauts faits (liste/fiche/récolte), classement. Beaucoup d'`innerHTML` + appels API
asynchrones via le wrapper `api()`.

## a) Liste des fonctions

| nom | ligne | | nom | ligne |
|---|---|---|---|---|
| api (async) | 25 | | recompense | 547 |
| ouvrirRegles (export) | 54 | | nomObjet | 570 |
| etoilesDuMasque | 106 | | vignetteDe | 580 |
| objectifDe | 110 | | ligneSucces | 586 |
| ficheNiveau | 116 | | passeLeFiltre | 646 |
| renderCampagne (export) | 152 | | jaugeLarge | 653 |
| shopText | 217 | | renderSucces (export) | 659 |
| enPartie | 224 | | ouvrirFicheSucces (export) | 771 |
| renderShop (async, export) | 244 | | brancherTri | 834 |
| estParure | 377 | | brancherRecolte | 878 |
| estMotif | 384 | | medaille (export) | 906 |
| porte | 388 | | peindreClassement | 916 |
| vignette | 399 | | renderRanking (async, export) | 952 |
| tarif | 415 | | | |
| seuilDEffet | 453 | | | |
| bouton | 473 | | | |
| barre | 534 | | | |

Écart de comptage : le lot annonce 113 ; je recense ~30 fonctions nommées + un
grand nombre d'arrows inline (handlers onclick/onkeydown, `.map`, `.filter`,
`.forEach`, `regle`/`article`/`trier`/`envoyer`/`fermer`/`surTouche`/`surRetour`).
Métrique auto sur-comptée. Aucune fonction manquée.

## b) Analyse par fonction (résumé ; détails en c)

| nom | rôle | risques | statut |
|---|---|---|---|
| api | appel serveur qui ne plante pas | garde `!S.net` + try/catch → renvoie null, toast | OK |
| ouvrirRegles | modale des règles | garde anti-doublon ; `keydown` retiré dans `fermer` | OK |
| etoilesDuMasque/objectifDe | helpers campagne | masque borné 0-3 ; repli i18n | OK |
| ficheNiveau | fiche d'un niveau | `trogne` (src) non `esc` ; garde `S.net.ready` sur jouer ; pas de pd-back | OK (voir c) |
| renderCampagne | liste des paliers | `esc` sur cap/identify ; repli outOfReach si `!S.net` | OK |
| shopText/enPartie | helpers boutique | repli i18n ; garde phase | OK |
| renderShop | boutique + achat | `S.shop.length` supposé ; try/catch achat ; api()→null géré | OK (voir c) |
| estParure/estMotif/porte | catégorisation | gardes `p &&` | OK |
| vignette/vignetteDe | URLs d'images | identifiants (src) non `esc` | OK (voir c) |
| tarif | devise+prix, null si invendable | gère `null`/`undefined` (piège `< null` évité) | OK |
| seuilDEffet | seuil d'un effet | table serveur + repli fermé-par-défaut | OK |
| bouton | bouton d'article (3 états) | `esc` sur identify/seuil ; prix numérique | OK |
| barre/jaugeLarge | jauges | `Math.max/min` bornent | OK |
| recompense/nomObjet | récompense d'un haut fait | `esc` sur titre ; vignetteDe (src) non `esc` | OK (voir c) |
| ligneSucces | ligne de haut fait | `esc` sur identify/nom/txt ; valeurs numériques | OK |
| passeLeFiltre | filtre succès | exige `=== false` explicite (serveur muet géré) | OK |
| renderSucces | page des hauts faits | repli outOfReach si `!S.net` ; `famillesFermees` persistant | OK |
| ouvrirFicheSucces | fiche d'un haut fait | pd-back retiré dans `fermer` ; pas de garde anti-doublon | OK (voir c) |
| brancherTri/brancherRecolte | filtres/récolte | boutons se désarment ; `if(!S.net)` | OK |
| medaille | médaille/rang | rang numérique ; `esc` alt | OK |
| peindreClassement | tableau classement | `esc` sur display_name/pseudo (noms joueurs !) | OK |
| renderRanking | classement relu | cache d'abord ; `body.isConnected` ; null géré | OK |

## c) Findings détaillés

Aucune FAILLE bloquante. Observations de faible gravité :

1. Gap d'échappement dans les URLs `src` — gravité : cosmétique/injection
   (serveur de confiance). Plusieurs helpers interpolent un identifiant serveur
   dans un `src="..."` SANS `esc()`, alors que les MÊMES identifiants sont `esc`
   dans les attributs `data-*` voisins :
   - dice_panels.js:401-403 `vignette` : `.../skins/D000_' + p.identify + '/...'`
   - dice_panels.js:580-584 `vignetteDe` : `.../skins/' + identify + '/...'`
   - dice_panels.js:122-124 `ficheNiveau` `trogne` : `.../cap_' + n.capitaine`
     et `.../sbires/' + n.sbire`, inséré l.128 `src="${trogne}"`.
   Si le serveur (compromis) ou un catalogue renvoyait un identifiant contenant
   `">…`, on sortirait de l'attribut → XSS. En pratique ce sont des codes de
   catalogue contraints (S001, B004, read…) fournis par un serveur de confiance :
   exploitabilité quasi nulle, mais l'incohérence avec les `data-*` mérite d'être
   notée (défense en profondeur). Les noms de JOUEURS du classement, eux, SONT
   correctement `esc` (l.928/932) — le point le plus sensible est couvert.

2. Modales — incohérences mineures (cosmétique/UX) :
   - `ficheNiveau` (l.116) ne câble pas l'événement `pd-back` (bouton retour
     Android) alors que `ouvrirFicheSucces` et `ouvrirRegles` le font : le retour
     Android ne referme pas la fiche de niveau.
   - `ouvrirFicheSucces` (l.771) n'a pas de garde anti-doublon (contrairement à
     `ouvrirRegles` l.55) : un double-tap empile deux voiles. Chaque voile retire
     bien son propre écouteur `pd-back` à sa fermeture, donc pas de fuite ; seule
     la superposition est gênante.

3. `renderShop` (l.244) suppose `S.shop` tableau (`products.length` l.256/rel).
   Si `S.shop` était `undefined`, le try/catch attrape et affiche `esc(e.message)`
   — une chaîne d'erreur JS brute pour l'utilisateur. `S.shop` est normalement
   initialisé à `[]`. Gravité : cosmétique.

Points positifs : `api()` ne jette jamais (garde + try/catch → null + toast) ;
achats idempotents côté UI (bouton désarmé, re-render) ; `renderRanking` ne peint
pas dans une boîte détachée ; répliques outOfReach au lieu d'écrans figés quand
`S.net` est nul ; `tarif` évite le piège `coins < null` ; répétitions d'étoiles
bornées (`etoilesDuMasque` ≤ 3) ; noms de joueurs échappés.

Statut fichier : OK.
