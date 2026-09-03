# Rapport d'audit — pd/www/js/ui/toast.js

Chemin réel : `/Users/develop/piratesdice/www/js/ui/toast.js`
Lignes : 63. Lu en entier.

Rôle du fichier : bandeaux « toast » en bas d'écran, avec anti-spam (un message
identique dans la fenêtre ranime le bandeau existant au lieu d'en empiler un
second).

## a) Liste de toutes les fonctions

| nom | ligne |
|-----|-------|
| host() | 7 |
| toast(msg, type) | 34 |

Écart de comptage : le lot annonce 8 fonctions ; je compte 2 fonctions nommées +
≈6 callbacks fléchés anonymes (`requestAnimationFrame`, les `setTimeout` de
disparition, imbriqués). Métrique auto gonflée par les `=>`. Rien manquant.

## b) Analyse par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| host | Crée/retourne le conteneur `#pd-toasts`. | pas de throw ; idempotent | OK |
| toast | Affiche un bandeau, ou ranime le dernier si texte identique. | `String(msg==null?'':msg)` valide l'entrée ; `textContent` (pas d'innerHTML → pas d'injection) ; `clearTimeout` avant re-arme (point 6 OK) ; `isConnected` garde le ranimage | OK |

## c) Findings détaillés

Aucune faille détectée.

Notes non bloquantes :
- Grille point 4 : le message est inséré via `note.textContent` (ligne 54), pas
  `innerHTML` — aucune injection possible même avec un message composé de contenu
  serveur. `msg` null/undefined est neutralisé en chaîne vide.
- Grille point 6 : les minuteries de disparition sont annulées (`clearTimeout`)
  avant d'être ré-armées lors d'un ranimage, et l'élément est retiré du DOM en
  fin de vie. Pas de fuite de timer ni de nœud.
- Grille point 3 : les corps de `setTimeout`/`requestAnimationFrame` ne font que
  des opérations DOM sûres (`classList`, `remove()` idempotent) qui ne peuvent
  pratiquement pas jeter.

## Statut fichier : OK
