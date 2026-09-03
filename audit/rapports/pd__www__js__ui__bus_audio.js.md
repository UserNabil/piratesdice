# Rapport d'audit — pd/www/js/ui/bus_audio.js

Chemin réel : `/Users/develop/piratesdice/www/js/ui/bus_audio.js`
Lignes : 300. Lu en entier (2 tranches de 200).

Rôle du fichier : bus audio Web Audio (AudioContext + GainNodes) contournant le
fait qu'`element.volume` est ignoré sur iOS. Deux chemins : effets courts décodés
en AudioBuffer, musique branchée via `createMediaElementSource`.

## a) Liste de toutes les fonctions

| nom | ligne |
|-----|-------|
| contexte() | 40 |
| canal(nom) | 54 |
| liberer(param) | 84 |
| viser(param, valeur) | 96 |
| niveauCanal(nom, facteur) | 110 |
| poserLeGuetteur() | 121 |
| reveil() [arrow interne] | 123 |
| reveiller() | 137 |
| dormir() | 145 |
| lire(url) | 161 |
| decoder(c, brut) | 174 |
| charger(nom, url) [async] | 193 |
| jouerTampon(nom, nomCanal, volume, vitesse) | 205 |
| brancherElement(el, nomCanal) | 235 |
| debrancherElement(el) | 252 |
| niveauElement(propre, valeur) | 260 |
| fondre(propre, depart, arrivee, secondes) | 274 |

Écart de comptage : le lot annonce 30 fonctions ; je compte 16 fonctions nommées
+ 1 arrow interne (`reveil`). L'écart (≈13) vient des callbacks fléchés anonymes :
exécuteurs de `Promise` (`lire`, `decoder`), `x.onload`/`x.onerror`,
`source.onended`, les callbacks de `decodeAudioData`, `.then`/`.catch` de
`resume`. Métrique auto gonflée par les `=>`. Pas de fonction nommée manquante.

## b) Analyse par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| contexte | Crée l'AudioContext au premier besoin. | `try/catch` autour de la création, `ctx=null` sur échec ; retourne null si pas d'API | OK |
| canal | Crée/retourne le GainNode d'un canal. | garde `!c` → null | OK |
| liberer | Libère un AudioParam avant de le piloter. | garde `!ctx` ; try/catch imbriqué (cancelAndHold → cancelScheduled) | OK |
| viser | Pose une valeur en rampe de 20 ms. | try `setTargetAtTime` → catch `param.value` → catch silence ; ctx garanti par les appelants | OK |
| niveauCanal | Règle le niveau d'un canal. | garde `!g` ; `Math.max(0, Number(facteur)||0)` valide l'entrée | OK |
| poserLeGuetteur | Pose les écouteurs de réveil au 1er geste. | garde `geste`/`document` ; écouteurs retirés une fois `running` (point 6 OK) | OK |
| reveil | Handler de réveil, se retire quand le contexte tourne. | appelle `reveiller` (gardé), pas de throw | OK |
| reveiller | Reprend le contexte suspendu. | try/catch + `.catch` sur la promesse `resume` (point 2 OK) | OK |
| dormir | Suspend le bus quand l'app passe derrière. | try/catch autour de `suspend` | OK |
| lire | Charge une URL en ArrayBuffer via XHR (fetch cassé en capacitor://). | Promise : onerror → reject ; throw dans l'exécuteur → rejet ; awaité par `charger` sous try/catch | OK |
| decoder | Décode l'audio (formes callback ET promesse). | try/catch → reject ; garde `rendu` anti-double-résolution | OK |
| charger | Décode un fichier court une fois. | garde `!c`/déjà chargé ; try/catch silencieux avec repli `<audio>` ; check `!brut.byteLength` | OK |
| jouerTampon | Joue un tampon sur un canal, renvoie true/false. | try/catch global → false ; `onended` déconnecte les nœuds (point 6 OK) ; volume clampé [0,1] | OK |
| brancherElement | Branche un `<audio>` (une seule fois via WeakMap). | garde ; WeakMap anti-double-source ; try/catch → null | OK |
| debrancherElement | Coupe et oublie les liens d'un élément. | garde `!lien` ; try/catch ; `branches.delete` (point 6 OK) | OK |
| niveauElement | Règle le niveau propre d'un élément branché. | garde `!propre||!ctx` ; `Math.max(0, Number(valeur)||0)` | OK |
| fondre | Fondu à puissance constante entre deux gains. | garde ; triple repli (courbe → rampe → valeur) sous try/catch imbriqués | OK |

## c) Findings détaillés

Aucune faille détectée. Fichier exceptionnellement défensif.

Notes non bloquantes :
- Grille point 1/2 (exceptions & rejets) : chaque appel Web Audio susceptible de
  jeter (`AudioParam` en automation, `createMediaElementSource` répété,
  `decodeAudioData`, `resume`) est enveloppé, et les promesses (`lire`,
  `decoder`, `resume`) ont leur rejet capté.
- Grille point 6 (ressources) : les nœuds éphémères se déconnectent sur
  `onended` (`jouerTampon`), les éléments branchés via `debrancherElement`, et
  les écouteurs de réveil se retirent une fois le contexte `running`.
- Grille point 7 (concurrence) : `charger` a des points d'`await`, mais le seul
  écrit partagé (`tampons.set(nom, buffer)`) est idempotent — deux appels
  concurrents pour le même `nom` refont au pire un décodage, sans casser
  d'invariant.
- `fondre` avec `secondes` NaN dégrade proprement via les catches jusqu'à poser
  la valeur cible directement (pas de fondu mais pas de crash) — cosmétique, non
  bloquant.

## Statut fichier : OK
