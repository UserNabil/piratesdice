# Les icônes à générer — planches de 25, prêtes à découper

Quatre planches de vingt-cinq icônes couvrent les cent hauts faits, plus une petite planche pour
les pièces d'interface qui manquent encore. Chaque planche se génère avec le MÊME contrat de
style : c'est ce qui fait que les cent icônes se ressemblent, et une famille d'icônes qui ne se
ressemble pas est une famille d'icônes ratée.

⛔ **LE POINT QUI FAIT TOUT ÉCHOUER SI ON L'OUBLIE : l'isolement.** La planche est découpée par un
programme qui repère les dessins à leurs pixels opaques. Deux icônes qui se touchent, une ombre
qui bave sur la voisine, un cadre ou une grille dessinée — et le découpage rend une bouillie. La
consigne est donc répétée en majuscules dans chaque prompt, et elle n'est pas négociable.

---

**A. CONTRAT DE STYLE — il se colle en tête de CHAQUE planche, sans y changer un mot**

```
Sticker-style game icon sheet, 5 columns by 5 rows, 25 separate icons on ONE transparent background.

STYLE, identical for all 25: bold cartoon vector, thick dark navy outline (#241540) around every
shape, a clean white sticker rim around each icon, glossy highlights, subtle halftone dot shading.
Palette: gold #FFC61A and #FFE479, royal purple #7A3FD4, sky blue #3FA9F5, off-white #FFF6E0,
deep navy #241540. Warm golden-age-of-piracy props. Chunky, readable at 40 pixels.

⛔ CRITICAL — THE SHEET WILL BE CUT APART BY A PROGRAM:
- Each icon must be FULLY ISOLATED: no icon touches, overlaps or shares any pixel with another.
- Leave a wide empty margin between icons — at least 15% of one icon's width on every side.
- Background must be FULLY TRANSPARENT everywhere between the icons. No grid, no frame, no lines,
  no panels, no cards, no drop shadow falling outside an icon's own white rim.
- No text, no numbers, no letters, no captions anywhere in the image.
- Exactly 25 icons, arranged left to right, top to bottom, in the order listed below.
- Every icon centred in its own cell, all icons the same apparent size.
- Square image, 2048 x 2048 or larger.
```

---

## Planche 1 — succès A001 à A025

**Nom du fichier à me rendre : `succes_1.png`**

**B. LES 25 SUJETS, dans l'ordre de lecture (gauche → droite, haut → bas)**

```
 1. a worn leather sailor boot standing upright, neutral background
 2. a salt crusted wooden dice cup, neutral background
 3. a weathered captain tricorn hat, neutral background
 4. a single bitten gold doubloon, neutral background
 5. a wooden plaque studded with rows of coins, neutral background
 6. a blacksmith anvil with a worn hammer, neutral background
 7. a small canvas sail bulging with wind, neutral background
 8. a coiled rope tied with seven knots, neutral background
 9. a polished cutlass with an unmarked blade, neutral background
10. a bronze clockwork gear beside a single die, neutral background
11. a shattered brass gear split in two, neutral background
12. a wax sealed scroll rolled shut, neutral background
13. a tall stack of folded pirate flags, neutral background
14. a wooden crow nest platform atop a mast, neutral background
15. a black flag hoisted back to the masthead, neutral background
16. a dented steel helmet set upright, neutral background
17. a worn leather glove on a ship wheel, neutral background
18. a tall tower of three stacked dice
19. four dice spaced apart on wooden planks
20. three identical wooden dice stacked, plain background
21. three golden dice showing six pips, neutral background
22. three grey dice each showing one pip
23. two small brass dice showing two and three
24. six dice in a row showing one through six
25. two stacks of three matching dice, neutral background
```

**C. À quoi ils correspondent** — c'est cette table qui me sert à les nommer après découpe.

| # | fichier | succès | ce qu'il récompense |
|---|---|---|---|
| 1 | `A001.png` | **Le pied marin** | Terminez dix parties du début à la fin. |
| 2 | `A002.png` | **Tanné par le sel** | Terminez cinquante parties du début à la fin. |
| 3 | `A003.png` | **Vieux loup de mer** | Terminez deux cent cinquante parties du début à la fin. |
| 4 | `A004.png` | **Première prise** | Gagnez votre première partie. |
| 5 | `A005.png` | **Le tableau de chasse** | Gagnez vingt-cinq parties. |
| 6 | `A006.png` | **Cent fois sur le métier** | Gagnez cent parties. |
| 7 | `A007.png` | **Vent en poupe** | Gagnez trois parties de suite. |
| 8 | `A008.png` | **Sept marées** | Gagnez sept parties classées de suite. |
| 9 | `A009.png` | **L'invaincu** | Gagnez douze parties classées de suite. |
| 10 | `A010.png` | **Contre la ferraille** | Battez la machine dix fois. |
| 11 | `A011.png` | **Casseur de rouages** | Battez la machine cinquante fois. |
| 12 | `A012.png` | **Le nom sur la liste** | Remportez votre première partie classée. |
| 13 | `A013.png` | **Pavillons pris** | Remportez vingt-cinq parties classées. |
| 14 | `A014.png` | **La vigie** | Montez de cent cinquante points de classement au-dessus de votre départ. |
| 15 | `A015.png` | **Retour au sommet** | Reprenez votre meilleur classement après l'avoir perdu de cinquante points. |
| 16 | `A016.png` | **Le quatrième assaut** | Gagnez enfin, après trois défaites de suite. |
| 17 | `A017.png` | **Jamais quitté le pont** | Terminez vingt parties d'affilée sans jamais abandonner. |
| 18 | `A018.png` | **La tour** | Envoyez vos trois premiers dés dans la même colonne. |
| 19 | `A019.png` | **Le tour du pont** | Commencez une partie en posant vos quatre premiers dés dans quatre colonnes différentes. |
| 20 | `A020.png` | **Trois d'un coup** | Empilez trois dés de la même valeur dans une même colonne. |
| 21 | `A021.png` | **Trois fois six** | Empilez trois six dans une même colonne : la plus grosse colonne du jeu. |
| 22 | `A022.png` | **Rien que des un** | Empilez trois un dans une même colonne, pour la beauté du geste. |
| 23 | `A023.png` | **Les petits calibres** | Réussissez un triple de deux et un triple de trois, même dans des parties différentes. |
| 24 | `A024.png` | **Un de chaque** | Réussissez un triple de chaque valeur, du un au six, au fil de vos parties. |
| 25 | `A025.png` | **Double salve** | Réussissez deux triples dans une même partie, dans deux colonnes différentes. |

---

## Planche 2 — succès A026 à A050

**Nom du fichier à me rendre : `succes_2.png`**

**B. LES 25 SUJETS, dans l'ordre de lecture (gauche → droite, haut → bas)**

```
 1. a leather dice cup with three matching dice
 2. three dice showing three, four and five in a row
 3. three dice showing three different faces, neutral background
 4. four short stacks of paired dice on wood
 5. two dice showing six beside one showing five
 6. a small crate spilling dice showing six
 7. a modest stack of silver coins with one die
 8. an open treasure chest full of gold coins
 9. a golden die resting on an admiral's crown
10. three dice on a freshly repaired deck plank
11. a single red die cracked open
12. a boarding axe over two split dice
13. three shattered dice lying in a row
14. a golden six die pierced by a nail
15. a curved cutlass over scattered broken dice
16. a heavy cleaver embedded in a chopping block
17. four splintered wooden posts standing in a row
18. a smoking bronze cannon beside one die
19. a die crushed under a heavy anchor
20. two crossed daggers over a cracked die
21. a frost covered die next to a cleaver
22. a golden crown resting on a cleaver
23. a neat tower of stacked ivory dice
24. a wooden mallet beside four carved dice
25. a flawless polished steel shield
```

**C. À quoi ils correspondent** — c'est cette table qui me sert à les nommer après découpe.

| # | fichier | succès | ce qu'il récompense |
|---|---|---|---|
| 1 | `A026.png` | **Trois d'entrée** | Vos trois premiers dés tombent dans la même colonne et montrent la même valeur. |
| 2 | `A027.png` | **Trois marches** | Complétez une colonne avec trois valeurs qui se suivent. |
| 3 | `A028.png` | **Pas deux pareils** | Terminez une partie sans deux dés identiques dans une même colonne. |
| 4 | `A029.png` | **Tout par deux** | Terminez une partie avec au moins deux dés identiques dans chacune de vos quatre colonnes. |
| 5 | `A030.png` | **À un poil près** | Complétez une colonne avec deux six et un cinq. |
| 6 | `A031.png` | **La cargaison de six** | Ayez cinq six à la fois sur votre plateau. |
| 7 | `A032.png` | **Butin honnête** | Terminez une partie avec au moins 70 points. |
| 8 | `A033.png` | **Le coffre plein** | Terminez une partie avec au moins 100 points. |
| 9 | `A034.png` | **Le trésor de l'amiral** | Terminez une partie avec au moins 130 points. |
| 10 | `A035.png` | **Le pont refait** | Perdez deux dés d'un coup dans une colonne, puis terminez cette colonne par un triple. |
| 11 | `A036.png` | **Premier sang** | Détruisez un premier dé adverse en posant le vôtre. |
| 12 | `A037.png` | **Deux d'un coup** | Détruisez deux dés adverses d'une seule pose. |
| 13 | `A038.png` | **La colonne rasée** | Rasez une colonne adverse entière d'une seule pose : trois dés. |
| 14 | `A039.png` | **Le six de trop** | Posez un six et détruisez un six adverse. |
| 15 | `A040.png` | **L'écumeur** | Détruisez quatre dés adverses dans la même partie. |
| 16 | `A041.png` | **Le boucher** | Détruisez huit dés adverses dans la même partie. |
| 17 | `A042.png` | **Aux quatre vents** | Détruisez au moins un dé dans chacune des quatre colonnes, dans la même partie. |
| 18 | `A043.png` | **Salve d'ouverture** | Détruisez un dé dès votre toute première pose de la partie. |
| 19 | `A044.png` | **Le dernier mot** | Gagnez une partie en détruisant un dé sur votre toute dernière pose. |
| 20 | `A045.png` | **Œil pour œil** | Détruisez un dé en réponse immédiate à une destruction subie. |
| 21 | `A046.png` | **Gel et couperet** | Gelez l'adversaire et détruisez un dé pendant le tour qu'il a perdu. |
| 22 | `A047.png` | **Le boucher couronné** | Gagnez une partie en détruisant au moins trois dés adverses, et plus que lui. |
| 23 | `A048.png` | **Le bâtisseur** | Gagnez une partie complète sans détruire le moindre dé adverse. |
| 24 | `A049.png` | **Le charpentier** | Gagnez une partie complète sans détruire un seul dé ni jouer le moindre effet. |
| 25 | `A050.png` | **Pas une égratignure** | Gagnez une partie complète sans perdre un seul dé. |

---

## Planche 3 — succès A051 à A075

**Nom du fichier à me rendre : `succes_3.png`**

**B. LES 25 SUJETS, dans l'ordre de lecture (gauche → droite, haut → bas)**

```
 1. a splintered mast beam still upright
 2. a folded white flag over two dice
 3. a heap of splintered dice fragments
 4. a bronze medal resting on a broken die
 5. an axe blade with three fresh notches
 6. a leather dice cup with one die
 7. a worn sponge eraser on a blank slate
 8. a bone die split cleanly in two
 9. a polished brass spyglass, fully extended
10. a golden die inside a thin halo ring
11. a die frozen inside a block of ice
12. a small chest holding six carved charms
13. an empty leather coin pouch, drawstring open
14. a red silk ribbon around a tumbling die
15. a frosted slow-match fuse curled on wood
16. a red lacquered spyglass with jade inlay
17. a silver celtic knot charm on a die
18. a rolled calico flag with crossed sabers
19. five small wooden ship figureheads in a row
20. a frozen pewter goblet rimmed with ice
21. a gold feather tipping a brass balance scale
22. five folded pirate flags stacked neatly
23. a cracked mirror shard reflecting one die
24. an ice-crusted cutlass standing upright in wood
25. an open coin purse spilling gray sand
```

**C. À quoi ils correspondent** — c'est cette table qui me sert à les nommer après découpe.

| # | fichier | succès | ce qu'il récompense |
|---|---|---|---|
| 1 | `A051.png` | **Debout dans l'épave** | Gagnez une partie après avoir perdu six dés. |
| 2 | `A052.png` | **La paix des braves** | Terminez une partie complète sans la moindre destruction, des deux côtés. |
| 3 | `A053.png` | **Le charnier** | Détruisez 250 dés adverses au fil de vos parties. |
| 4 | `A054.png` | **Du sang au classement** | Gagnez un match classé en détruisant six dés adverses. |
| 5 | `A055.png` | **Trois coups de hache** | Détruisez un dé sur trois de vos poses consécutives. |
| 6 | `A056.png` | **Le second jet** | Relancez un dé pour la première fois. |
| 7 | `A057.png` | **Le remords** | Effacez un dé que vous aviez vous-même posé. |
| 8 | `A058.png` | **Le saboteur** | Payez pour arracher un dé du plateau adverse. |
| 9 | `A059.png` | **La longue-vue** | Regardez le prochain dé de votre adversaire avant lui. |
| 10 | `A060.png` | **Sacrée colonne** | Bénissez l'une de vos colonnes. |
| 11 | `A061.png` | **Grand froid** | Gelez votre adversaire et regardez-le perdre son tour. |
| 12 | `A062.png` | **L'arsenal** | Jouez les six effets dans une seule et même partie. |
| 13 | `A063.png` | **À mains nues** | Gagnez sans jouer un seul effet contre un adversaire qui en a joué. |
| 14 | `A064.png` | **Le pari de Mary** | Gagnez avec Mary Read après avoir relancé un dé. |
| 15 | `A065.png` | **Barbe de givre** | Gagnez avec Barbe-Noire après lui avoir volé au moins un tour. |
| 16 | `A066.png` | **L'œil de Ching** | Gagnez avec Ching Shih après avoir espionné le dé adverse. |
| 17 | `A067.png` | **Bénie par Grace** | Gagnez avec Grace O'Malley après avoir béni une colonne. |
| 18 | `A068.png` | **Jack prend l'avance** | Gagnez avec Calico Jack en creusant trente points d'écart. |
| 19 | `A069.png` | **Toute la flotte** | Décrochez au moins une victoire avec chacun des cinq capitaines. |
| 20 | `A070.png` | **Servi froid** | Gelez votre adversaire avec un effet payé, puis gagnez la partie. |
| 21 | `A071.png` | **Le ciel a tranché** | Bénissez une colonne et l'emportez de cinq points ou moins. |
| 22 | `A072.png` | **Face aux cinq** | Croisez le fer avec les cinq capitaines, au moins une fois chacun. |
| 23 | `A073.png` | **Ton propre reflet** | Battez un adversaire qui avait choisi exactement votre capitaine. |
| 24 | `A074.png` | **Gelé mais debout** | Perdez un tour dans la glace et gagnez quand même la partie. |
| 25 | `A075.png` | **Fortune gaspillée** | Gagnez sans aucun effet face à un adversaire qui en a joué quatre différents. |

---

## Planche 4 — succès A076 à A100

**Nom du fichier à me rendre : `succes_4.png`**

**B. LES 25 SUJETS, dans l'ordre de lecture (gauche → droite, haut → bas)**

```
 1. two golden six-pip dice on a brass tray
 2. a polished gold die beside a wooden dice cup
 3. three small grey dice on a weathered plank
 4. a single tarnished copper coin lying alone
 5. five gold coins in a tall leaning stack
 6. a plain wooden mug beside a golden goblet
 7. a dented tin cup full of gold coins
 8. a brass balance scale tipped by one feather
 9. a two-pip die beside a six-pip die
10. three golden dice all showing six pips
11. two small copper coins in a wooden bowl
12. two heavy coin sacks beside one small sack
13. a knotted rope ladder coiled on bare planks
14. a single six-pip die on a cup rim
15. four dice in a descending row on wood
16. five ivory dice all showing one pip, plain background
17. a die with one face rubbed blank, neutral background
18. five identical dice in a row showing threes
19. six dice in a row, each a different face
20. an empty tricorn hat left on coiled rope
21. six pairs of dice, one pair per face
22. a tilted crown beside three dice showing six
23. a gold coin split cleanly into two halves
24. a tin cup holding crumbs and two tiny dice
25. a translucent glass die on an empty stool
```

**C. À quoi ils correspondent** — c'est cette table qui me sert à les nommer après découpe.

| # | fichier | succès | ce qu'il récompense |
|---|---|---|---|
| 1 | `A076.png` | **Le juste calcul** | Envoyez vos deux premiers 6 dans la colonne ×1,3. |
| 2 | `A077.png` | **L'or sans crasse** | Gagnez une partie entière sans jamais poser un 1 ni un 2 dans la colonne ×1,3. |
| 3 | `A078.png` | **La colonne sacrifiée** | Allez au bout d'une partie en ne mettant que des petits dés, 3 au plus, dans la colonne ×0,5. |
| 4 | `A079.png` | **Le mauvais compte** | Perdez une partie à un ou deux points près. |
| 5 | `A080.png` | **L'entêté du 1,3** | Posez cinq dés ou plus dans la colonne ×1,3 au cours d'une seule partie. |
| 6 | `A081.png` | **L'or ne suffit pas** | Gagnez alors que l'adversaire a posé plus gros que vous dans la colonne ×1,3. |
| 7 | `A082.png` | **L'or des gueux** | Gagnez une partie où vous avez posé plus de valeur dans la colonne ×0,5 que dans la ×1,3. |
| 8 | `A083.png` | **D'un cheveu** | Gagnez une partie avec un point d'avance, pas un de plus. |
| 9 | `A084.png` | **Mieux placé que servi** | Gagnez alors que la somme de vos dés était plus faible que celle de l'adversaire. |
| 10 | `A085.png` | **La colonne reine** | Posez trois 6 dans la colonne ×1,3. |
| 11 | `A086.png` | **Le sou du pauvre** | Gagnez une partie sans jamais mettre plus qu'un 2 dans les colonnes ×0,8 et ×0,5. |
| 12 | `A087.png` | **Deux pour un** | Gagnez en marquant au moins le double de l'adversaire. |
| 13 | `A088.png` | **Remonté de la cale** | Gagnez une partie dont les trois premiers dés sont tombés dans la colonne ×0,5. |
| 14 | `A089.png` | **Le point final** | Gagnez en terminant la partie sur un 6 posé dans la colonne ×1,3. |
| 15 | `A090.png` | **Chacun son quart** | Allez au bout d'une partie en rangeant vos dés du plus gros au plus petit, de la colonne ×1,3 à la ×0,5. |
| 16 | `A091.png` | **Cinq fois rien** | Cinq de vos dés ne valaient qu'un seul point, et le butin est quand même pour vous. |
| 17 | `A092.png` | **Sans le moindre six** | Pas un seul six posé sur votre plateau, et la victoire au bout. |
| 18 | `A093.png` | **Le dé bègue** | Cinq lancers de suite, la même face à chaque fois. |
| 19 | `A094.png` | **Les six visages** | Six lancers d'affilée sans jamais répéter une seule face. |
| 20 | `A095.png` | **Le déserteur** | Il menait au score et il a quitté la table. |
| 21 | `A096.png` | **Le compte rond** | Deux fois chaque valeur, de un à six, sur votre plateau. |
| 22 | `A097.png` | **Le trône volé** | L'adversaire tenait trois six dans une colonne. Vous avez gagné. |
| 23 | `A098.png` | **Le partage** | Les deux plateaux valent exactement la même chose. |
| 24 | `A099.png` | **Une poignée de miettes** | Rien que des petits dés dans la main, et le butin quand même. |
| 25 | `A100.png` | **Battu par un fantôme** | Il a manqué un tour entier et il vous a battu quand même. |

---

## Planche 5 — les pièces d'interface qui manquent

**Nom du fichier à me rendre : `interface.png`**

Même contrat de style, mais **3 colonnes sur 3 lignes, 9 icônes**. Remplace la première ligne du
contrat par : `Sticker-style game icon sheet, 3 columns by 3 rows, 9 separate icons on ONE
transparent background.`

**B. LES 9 SUJETS, dans l'ordre de lecture**

```
 1. a closed brass padlock, shackle up, neutral background
 2. a play triangle button carved in gold, neutral background
 3. a pause button, two thick gold bars, neutral background
 4. a rewind arrow curling counter-clockwise in gold, neutral background
 5. a fast-forward double chevron in gold, neutral background
 6. a small hourglass with golden sand, neutral background
 7. an open ship logbook with a quill, neutral background
 8. a coiled measuring rope beside a brass compass, neutral background
 9. a gold laurel wreath enclosing an empty shield, neutral background
```

**C. À quoi elles servent**

| # | fichier | où | pourquoi elle manque |
|---|---|---|---|
| 1 | `icon_lock.png` | cadenas des capitaines fermés | dessiné en SVG en attendant — c'est le seul repère qui dit « pas encore à toi » |
| 2 | `icon_play.png` | lecture d'un replay | — |
| 3 | `icon_pause.png` | pause d'un replay | — |
| 4 | `icon_rewind.png` | revenir d'un coup | — |
| 5 | `icon_forward.png` | avancer d'un coup | — |
| 6 | `icon_speed.png` | le sélecteur ×0,5 ×1 ×2 | — |
| 7 | `icon_history.png` | l'historique des parties | — |
| 8 | `icon_measure.png` | réserve (statistiques d'une partie) | — |
| 9 | `icon_trophy.png` | réserve (haut fait mis en avant) | — |

---

## Comment je les découpe ensuite

Dépose la planche dans `~/Downloads` sous le nom indiqué, et je fais le reste :

```
python3 outils/assets.py decouper ~/Downloads/succes_1.png 5x5 <les 25 chemins>
```

L'outil repère chaque dessin par ses pixels opaques, le recadre sur son contenu, le repose centré
à taille égale sur 256 px. C'est pour ça que la consigne d'isolement compte plus que tout le
reste : **deux icônes qui se touchent sont découpées comme une seule**, et il faut refaire la
planche. Les six dés recoupés l'an dernier l'ont appris à leurs dépens.

⚠️ **Si le générateur refuse les 25 d'un coup** (certains dégradent la qualité au-delà de 9 ou 16
sujets), coupe la planche en deux moitiés de 12 et 13 en gardant le même contrat de style, et
dis-le moi : je découperai deux planches au lieu d'une. Ce qui ne se négocie pas, c'est
l'isolement et l'absence de texte.
