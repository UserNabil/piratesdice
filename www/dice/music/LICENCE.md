# D'où vient cette musique, et ce qu'on a le droit d'en faire

⛔ **CE FICHIER N'EST PAS UNE FORMALITE.** Une musique dont on ne sait pas d'où
elle vient est une musique qu'on ne peut pas défendre — et elle part dans un
binaire signé, sur deux boutiques. À chaque piste ajoutée ou remplacée :
d'où elle vient, qui l'a faite, et sous quelle licence. Une ligne, ici, au
moment où on la copie.

## État au 2026-08-28 — les pistes sont celles de l'admin

| fichier | durée | débit | source |
|---|---|---|---|
| `music_menu.m4a` | 222,4 s (boucle à 220,8 s) | AAC 127 kb/s, stéréo 48 kHz | « Tavern Waltz », composée par l'admin (`~/Downloads/dice_music`) |
| `music_game_01.m4a` | 83,6 s (boucle à 81,6 s) | AAC 119 kb/s, stéréo 48 kHz | « Windswept Return », composée par l'admin (idem) |

Aucune licence tierce, aucune redevance, aucune attribution due : les deux
morceaux sont de l'auteur du jeu. C'est la situation la plus simple possible, et
c'est celle qu'on voulait.

Les cinq `.m4a` de remplacement qui vivaient ici — placeholders synthétiques
sans provenance ni licence — ont été retirés le même jour.

## Ce qui a été fait aux fichiers, et pourquoi

Les sources sont deux MP3 stéréo 48 kHz (202 et 186 kb/s) de 239,8 s et 120,0 s.
Aucun des deux ne bouclait : **le premier s'éteint sur ses deux dernières
secondes, le second fait un fondu de quatre**, puis chacun laisse ~1,1 s de
silence. En lecture bouclée, on entendait la musique mourir puis repartir.

Le point de coupe n'a pas été choisi à l'oreille ni sur un tempo supposé — un
tempo estimé à 2 bpm près décale la jointure d'un demi-temps au bout d'une
minute. Il a été **mesuré** : on cherche l'endroit où la fin ressemble le plus au
début, sur deux critères — le dessin des attaques (précision rythmique) et la
couleur harmonique (l'accord de la fin mène-t-il à celui du début).

| | point retenu | écart au reste | gardé |
|---|---|---|---|
| Tavern Waltz | 220,789 s | 3,4 σ | 93 % |
| Windswept Return | 81,600 s | 4,0 σ | 68 % |

Pour Windswept, un point à 65,4 s notait mieux (4,8 σ) mais jetait 45 % du
morceau : 81,6 s est le compromis, et il reste largement au-dessus du lot.

La jointure est recousue par un fondu croisé à puissance constante (1,6 s et
2,0 s). Vérification, trois tours bout à bout :

| | saut de niveau au raccord | pires transitions du morceau |
|---|---|---|
| piste brute bouclée | 23,7 dB / 26,5 dB | ~11 dB |
| après recouture | **2,2 dB / 5,4 dB** | ~10,5 dB |

Le raccord est rentré dans le bruit ordinaire du morceau : il ne s'entend plus.

⚠️ **CHAQUE FICHIER GARDE `fondu` SECONDES DE MATIÈRE APRÈS SON POINT DE
BOUCLE**, et c'est volontaire : le raccord n'est pas cuit dans le fichier, il est
calculé au vol par le jeu, qui croise deux lecteurs. Raison mesurée dans
l'application : `audio.loop = true` **cale ~450 ms** dans WKWebView, tampon
plein et sans aucun déplacement de tête de lecture. Un fichier auto-bouclant
aurait donc été parfait sur le papier et troué à l'oreille. Ne pas raccourcir un
fichier à son point de boucle en croyant bien faire — la matière en trop est le
recouvrement.

⚠️ **Les masters sont les MP3 d'origine**, conservés hors du dépôt. Si les
pistes doivent être refaites, repartir de là — jamais de ces `.m4a`, qui sont
déjà un second encodage. Le script qui fabrique les boucles est reproductible
et documenté ; il vit dans le scratchpad de la session, à recopier dans
`outils/` s'il doit resservir.

## Pour les remplacer

Tout est écrit dans `store/PROMPTS_MUSIQUE.md` : les prompts, les durées, le
service à prendre, ses deux pièges de licence, et les replis. Mêmes noms, mêmes
durées, AAC-LC 96 kbps mono minimum — le code ne bouge pas.

## Les bruitages, eux, sont d'ailleurs

`www/dice/sfx/` vient d'une autre source et suit son propre régime. Ne pas
confondre les deux dossiers dans une note de licence.
