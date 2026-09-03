# Rapport d'audit — pd/www/js/pages/dice_lobby.js

Fichier lu en entier par tranches (1-200, 200-400, 400-600, 600-800, 800-962).
Rôle : le « pont » — choix du capitaine (bandeau + fiche feuilletable), menu des
modes, salon privé (hébergeur/invité), partage/lien d'invitation, file d'attente.
Aucune règle de jeu ici ; le serveur tranche, l'écran montre et envoie.

## a) Liste des fonctions

| nom | ligne | | nom | ligne |
|---|---|---|---|---|
| known | 51 | | wireCaptains | 486 |
| listeCapitaines | 63 | | lancerAttente | 547 |
| parties | 70 | | arreterAttente | 554 |
| seuilDe | 74 | | attenteDepassee | 559 |
| capitaineOuvert (export) | 80 | | oublierAttente (export) | 564 |
| captainOf | 88 | | peindreReseau (export) | 587 |
| captainArt (export) | 92 | | renderMenu (export) | 626 |
| portraitFiche (export) | 110 | | renderRoom | 786 |
| traitArt (export) | 114 | | lienDeSalon (export) | 870 |
| captainName (export) | 118 | | publierSalon (async) | 874 |
| captainTrait (export) | 122 | | rejoindreParLien (export) | 910 |
| mine | 126 | | reprendreLienEnAttente (export) | 926 |
| captainStrip | 144 | | copyCode | 933 |
| captainCard | 173 | | onRoom (export) | 941 |
| offreDe | 232 | | onRoomFail (export) | 950 |
| texte | 239 | | resetLobby (export) | 957 |
| ficheCapitaine | 244 | | | |
| ouvrirFiche (export) | 348 | | | |
| adopter | 457 | | | |
| repeindreCapitaines (export) | 473 | | | |

Écart de comptage : le lot annonce 105, je recense 36 fonctions nommées + un grand
nombre d'arrows inline (peindre, aller, fermer, surRetour, apercu, demarrer,
annuler, relacher, go, .map/.forEach/handlers pointer/touch/keydown). La métrique
auto sur-compte massivement (chaque `=>`). Aucune fonction manquée.

## b) Analyse par fonction (résumé ; détails en c)

| nom | rôle | risques | statut |
|---|---|---|---|
| known / captainOf | whitelist d'ids capitaines | assainit vers id connu ou défaut | OK |
| listeCapitaines | liste serveur filtrée / secours | `filter(known)` → ids sûrs pour l'HTML | OK |
| parties / seuilDe / offreDe / texte / mine | accès aux données capitaine | gardes `&&`/`Number()`/find→défaut | OK |
| capitaineOuvert | capitaine débloqué ? | double chemin (campagne/parties) ; serveur retranche | OK |
| captainArt/portraitFiche/traitArt/captainName/captainTrait | URLs/textes | via captainOf assaini | OK |
| captainStrip/captainCard/ficheCapitaine | HTML des médaillons/fiche | interpolations `esc` ou ids whitelistés | OK |
| ouvrirFiche | fiche feuilletable + gestes | listeners sur `back` (GC au remove) + `pd-back` retiré dans `fermer` | OK |
| adopter | porter un capitaine | garde `capitaineOuvert` ; `if(S.net)` avant send | OK |
| repeindreCapitaines | repeint le seul bandeau | garde `!bloc` ; rebrancle wireCaptains | OK |
| wireCaptains | clic court=choisir / maintien=fiche | timer par bouton, clearTimeout dans annuler/relacher ; timer résiduel possible après repeinte (edge) | OK |
| lancerAttente/arreterAttente/attenteDepassee/oublierAttente | file d'attente 2 min | garde `attenteTimer||!redessiner` (pas d'accumulation) ; clear sur sorties | OK |
| peindreReseau | repeint ce qui dépend du réseau | gardes `!carte`/`!bandeau` ; renvoie false si pont absent | OK |
| renderMenu | dessine le menu du pont | `const horsLigne` en tête (ReferenceError corrigée) ; `#dc-unqueue` send non gardé | FAILLE |
| renderRoom | salon privé hôte/invité | sanitise le code ; `#dc-room-go/create` send non gardé | FAILLE |
| publierSalon | partage natif ou presse-papier | async : await sous try/catch, cancel géré, .catch sur clipboard | OK |
| lienDeSalon | URL d'invitation | `encodeURIComponent(code)` | OK |
| rejoindreParLien | rejoindre depuis deeplink | assainit + slice(0,5) + garde `S.state` (pas pendant une partie) | OK |
| reprendreLienEnAttente | rejoue l'invitation mise de côté | garde `!salonAttendu` | OK |
| copyCode | copie le code | garde clipboard + .catch | OK |
| onRoom/onRoomFail/resetLobby | messages serveur salon | `msg.code||''` ; map raison→toast avec défaut | OK |

## c) Findings détaillés

### FAILLE 1 — `#dc-unqueue` : `S.net.send` non gardé (exception non attrapée)
- dice_lobby.js:655 `$('#dc-unqueue').onclick = () => { arreterAttente(); S.net.send({ t: 'cancel' }); };`
- Gravité : cosmétique (exception dans un handler, avalée par le dispatch DOM ;
  le jeu ne plante pas, la partie n'est pas bloquée).
- Contrairement au handler `relancer` juste en dessous (l.659-665) qui garde
  `if (S.net)` avant chaque envoi, l'annulation appelle `S.net.send` sans garde.
  Si la socket est tombée pendant l'attente (`S.queued` vrai, `S.net` null),
  cliquer « Annuler » lève un TypeError. `arreterAttente()` s'exécute avant, donc
  le minuteur est bien arrêté ; l'erreur reste sans conséquence fonctionnelle
  visible, mais elle échappe à toute capture (grille point 1). Probabilité faible
  (l'état en file implique normalement une socket vivante).

### FAILLE 2 — renderRoom : `S.net.send` non gardé (join/create)
- dice_lobby.js:837 `S.net.send({ t: 'room', action: 'join', code });` (dans `go`)
- dice_lobby.js:843 `$('#dc-room-create').onclick = () => S.net.send({ t: 'room', action: 'create' });`
- Gravité : cosmétique. Le bouton « Annuler » du salon garde `if (attente && S.net)`
  (l.822), mais rejoindre/créer déréférencent `S.net` sans garde. Si la socket
  tombe pendant qu'on est dans le salon privé, ces clics lèvent un TypeError non
  attrapé. Le salon n'est atteignable qu'avec une socket prête (dc-friend
  l'exige), donc probabilité faible.

### Observations non-faille (maintenance / edge)
- Fragilité DOCUMENTÉE (l.19-24) : `CAPTAIN_IDS`/`known()` filtre la liste serveur ;
  un capitaine ajouté côté serveur mais oublié ici n'apparaîtrait JAMAIS, sans
  message. Le fichier s'en avertit lui-même. Gravité : cosmétique (maintenance).
- `wireCaptains` : un maintien en cours au moment d'un `repeindreCapitaines`
  laisse un `setTimeout` résiduel qui peut ouvrir une fiche après le repeint. Le
  timer se déclenche une seule fois (pas de fuite). Gravité : cosmétique, edge.

Points positifs vérifiés : toutes les interpolations HTML sont `esc()` ou reposent
sur des ids whitelistés (`known`/`captainOf`) — pas de XSS ; deeplink et code de
salon assainis (`[^A-Z0-9]`, longueur 5) ; `publierSalon` gère l'annulation du
partage sans fausse confirmation ; `pd-back` (bouton retour Android) retiré à la
fermeture ; minuteur d'attente sans accumulation ; `horsLigne` déclaré en tête de
`renderMenu` (l'ancien ReferenceError « pont vide » est corrigé).

Statut fichier : FAILLES(2) [cosmétique — S.net.send non gardés]
