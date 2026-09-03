# Audit — pd/app/js/ui/bus_audio.js (300 lignes)

Fichier lu EN ENTIER (2 tranches). Lot annonce **30 fonctions** ; **~18 nommées** + arrows/callbacks (reveil, onended, promesses XHR/decode). Écart dû au compteur auto.

## (a) Fonctions

| nom | ligne |
|---|---|
| contexte() (export) | 40 |
| canal(nom) (export) | 54 |
| liberer(param) | 84 |
| viser(param, valeur) | 96 |
| niveauCanal(nom, facteur) (export) | 110 |
| poserLeGuetteur() | 121 |
| (arrow) reveil | 124 |
| reveiller() (export) | 137 |
| dormir() (export) | 145 |
| lire(url) | 161 |
| decoder(c, brut) | 174 |
| charger(nom, url) (export async) | 193 |
| jouerTampon(nom, nomCanal, volume, vitesse) (export) | 205 |
| (arrow) source.onended | 222 |
| brancherElement(el, nomCanal) (export) | 235 |
| debrancherElement(el) (export) | 252 |
| niveauElement(propre, valeur) (export) | 260 |
| fondre(propre, depart, arrivee, secondes) (export) | 274 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| contexte | crée l'AudioContext une fois | try/catch→`ctx=null` ; garde `!AC` | OK |
| canal | GainNode par canal, mis en cache | garde `!c` ; création idempotente | OK |
| liberer | libère un AudioParam avant écriture | double try/catch imbriqué, ne jette jamais | OK |
| viser | pose une valeur en 20 ms | try/catch→repli `param.value` →renonce sans jeter | OK |
| niveauCanal | niveau d'un canal | garde `!g` ; `Math.max(0, Number()||0)` | OK |
| poserLeGuetteur | réveille au 1er geste | retire les 3 listeners une fois `running` | OK |
| reveiller | `ctx.resume()` | `p.catch` géré + try/catch | OK |
| dormir | `ctx.suspend()` | try/catch | OK |
| lire | XHR arraybuffer (capacitor://) | onerror→reject ; `send()` dans l'exécuteur → rejet auto si jette ; consommé par `charger` (try/catch) | OK |
| decoder | decodeAudioData (callback + promesse) | try/catch→reject ; double-résolution ignorée par la Promise | OK |
| charger | décode un effet une fois | try/catch silencieux (repli `<audio>`) ; garde `!brut.byteLength` ; `tampons.has` — voir note concurrence | OK |
| jouerTampon | joue un tampon décodé | try/catch→false ; `onended` déconnecte les nœuds → pas de fuite de graphe ; volume clampé [0,1] | OK |
| brancherElement | branche un `<audio>` une seule fois | WeakMap `branches` empêche le 2e `createMediaElementSource` (qui jetterait) ; try/catch→null | OK |
| debrancherElement | coupe les liens d'un élément | garde `!lien` ; try/catch ; `branches.delete` | OK |
| niveauElement | niveau propre d'un élément | gardes ; clamp | OK |
| fondre | fondu puissance constante | triple repli try/catch (courbe→rampe→valeur) ne jette jamais ; `Number()||0`, `Math.max(0.02,…)` | OK |

## (c) Findings

- **Aucune faille.** Fichier exceptionnellement défensif : chaque opération sur le graphe audio est enrobée d'un try/catch qui renonce en silence (intention documentée : ne pas faire tomber l'abonnement). Ressources bien gérées — `jouerTampon` déconnecte les nœuds à `onended` (l.222), `brancherElement`/`debrancherElement` tiennent une WeakMap, les listeners du guetteur sont retirés une fois le contexte `running`.
- Concurrence (point 7, cosmétique) : deux `charger(nom, …)` concurrents peuvent tous deux passer le test `tampons.has(nom)` (l.195) avant que l'un ne remplisse la Map (décodage async entre-deux) → double décodage, le second écrase le premier. Travail dupliqué, aucun invariant cassé.
- Entrées (point 4) : volumes/vitesses passés par `Number()||0` puis clampés → un argument hostile/NaN ne casse rien.

**Verdict : OK**
