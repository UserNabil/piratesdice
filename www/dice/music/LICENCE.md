# D'où vient cette musique, et ce qu'on a le droit d'en faire

⛔ **CE FICHIER N'EST PAS UNE FORMALITE.** Cinq `.m4a` sont arrivés ici sans une
ligne sur leur provenance : ni dans le dépôt, ni dans leurs métadonnées. Une
musique dont on ne sait pas d'où elle vient est une musique qu'on ne peut pas
défendre — et elle part dans un binaire signé, sur deux boutiques. À chaque
piste ajoutée ou remplacée : service, date, numéro d'abonnement, date de
téléchargement. Une ligne, ici, au moment où on la copie.

## État au 2026-08-28

| fichier | durée | débit mesuré | provenance |
|---|---|---|---|
| `music_menu.m4a` | 96 s | 61 kbps | pack fourni par l'admin, `~/Downloads/pirates_dice_audio_pack` |
| `music_game_01.m4a` | 120 s | 58 kbps | idem |
| `music_game_02.m4a` | 120 s | 59 kbps | idem |
| `music_game_03.m4a` | 120 s | 59 kbps | idem |
| `music_victory.m4a` | 4 s | 43 kbps | idem |

Tous en AAC mono 44,1 kHz, atome `iTunSMPB` présent (le gapless est donc porté
par le conteneur). Mesures faites à `afinfo`.

⚠️ **CE SONT DES PLACEHOLDERS, ET C'EST LEUR AUTEUR QUI LE DIT.** Le README du
pack :

> *Music is a synthetic approximation of a restrained maritime chamber-folk
> palette. For a final commercial soundtrack, replace the procedural instrument
> timbres with recorded/live or dedicated music-generation renders while keeping
> the same filenames and durations.*

Des timbres synthétisés proceduralement : aucun réglage ne les transformera en
folk de chambre joué. Et **aucune licence ne les accompagne** — c'est le point
qui bloque, pas le style. Tant que cette ligne n'est pas remplie, ces cinq
fichiers ne devraient pas partir dans une version publique.

## Pour les remplacer

Tout est écrit dans `store/PROMPTS_MUSIQUE.md` : les prompts, les durées, le
service à prendre, ses deux pièges de licence, et les replis. Mêmes noms, mêmes
durées, AAC-LC 96 kbps mono minimum — le code ne bouge pas.

## Les bruitages, eux, sont d'ailleurs

`www/dice/sfx/` vient d'une autre source et suit son propre régime. Ne pas
confondre les deux dossiers dans une note de licence.
