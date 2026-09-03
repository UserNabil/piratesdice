# Rapport d'audit — pd/www/js/ui/volumes.js

Chemin réel : `/Users/develop/piratesdice/www/js/ui/volumes.js`
Lignes : 97. Lu en entier.

Rôle du fichier : détient les deux niveaux de curseur (effets, musique) en
pour-cent, les persiste en localStorage, et notifie les abonnés. Ne joue aucun
son et ne connaît ni `S`, ni `Sfx`, ni `Musique`.

## a) Liste de toutes les fonctions

| nom | ligne |
|-----|-------|
| borne(v, defaut) | 45 |
| lire() | 51 |
| volumes() | 62 |
| facteur(canal) | 71 |
| reglerVolume(canal, pourCent) | 77 |
| surVolume(fn) | 93 |

Écart de comptage : le lot annonce 10 fonctions ; je compte 6 fonctions nommées
+ l'arrow de désabonnement (`() => abonnes.delete(fn)`). Métrique auto gonflée
par les `=>`. Aucune fonction nommée manquante.

## b) Analyse par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| borne | Borne une valeur en [0,100] entier, défaut si non finie. | `Number`+`Math.round`+`isFinite` neutralisent NaN/undefined ; clamp (point 4 OK) | OK |
| lire | Lit les niveaux depuis localStorage. | try/catch JSON.parse ; `\|\| '{}'` / `\|\| {}` ; valeurs bornées → repli sur défauts si corrompu | OK |
| volumes | Renvoie une copie des deux positions. | init paresseuse ; renvoie une copie (pas la ref interne) | OK |
| facteur | Facteur à appliquer pour un canal. | canal inconnu → NaN, dégradé en 0 par `bus_audio` (Math.max(0,Number()\|\|0)) ; canaux réels = enum interne | OK |
| reglerVolume | Écrit un niveau et prévient les abonnés. | `borne` valide l'entrée ; setItem sous try/catch ; CHAQUE abonné appelé sous try/catch isolé (point 3/8 OK) | OK |
| surVolume | Abonne, appelle `fn(null,null)`, rend le désabonnement. | appel initial sous try/catch ; renvoie une fonction de désabonnement (point 6 OK) | OK |

## c) Findings détaillés

Aucune faille détectée. Fichier très défensif.

Notes non bloquantes :
- Grille point 4 : toutes les entrées passent par `borne` (NaN/undefined/hors
  bornes → défaut ou clamp) ; le stockage corrompu est rattrapé dans `lire`.
- Grille point 3/8 : `reglerVolume` enveloppe chaque notification d'abonné dans
  son propre try/catch — un abonné qui jette n'empêche pas les autres d'être
  prévenus ni l'écriture d'aboutir.
- Grille point 6 : `surVolume` renvoie une fonction de désabonnement ; la
  libération effective dépend de l'appelant (hors de ce fichier).
- `facteur`/`reglerVolume` avec un `canal` inconnu produisent au pire un NaN
  dégradé en silence en aval et une clé parasite en storage — sans casse ; les
  canaux sont un enum interne (`effets`/`musique`).

## Statut fichier : OK
