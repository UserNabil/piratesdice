# Cent hauts faits de plus (A101–A200) — brief pour l'agent d'images

Cent nouveaux succès qui prolongent les cent premiers. Ce fichier contient :
le **socle de style** (à coller en tête de CHAQUE génération), puis les **cent
fiches** — nom, condition, indication d'implémentation, et la ligne d'objet qui
complète le prompt.

**Mode d'emploi** : prompt complet d'un asset = SOCLE + la ligne « Objet » de la
fiche. Une image par succès, nommée `A101.png` … `A200.png`.

**Livraison** : 1024×1024, fond transparent. (Je les réduis ensuite à 192×192,
comme les cent premières — `www/dice/img/succes/`.)

**Implémentation (pour mémoire, pas pour l'agent d'images)** : chaque fiche
porte son compteur et son seuil. La plupart réutilisent les compteurs qui
existent déjà dans `succes.js` — une ligne SQL dans `achievement` suffit. Les
fiches marquées **⚠ nouveau compteur** demandent d'abord d'enseigner la mesure
au serveur. Paliers : 1 = commun, 2 = régulier, 3 = rare (+ un effet),
4 = légendaire (+ une parure).

---

## LE SOCLE DE STYLE — à coller en tête de chaque prompt

> Cartoon video-game **achievement sticker**, one single centered object on a
> **fully transparent background**, square 1:1, 1024×1024.
> Thick clean dark outlines, crisp cel shading, flat colours with one soft
> inner shadow and a single highlight — the same hand as a modern mobile board
> game. **No photorealism, no 3D render, no neon.**
> Palette: warm golden-brown and amber for the object, **deep purple-navy for
> the shadow side**, small red and gold accents. Slight three-quarter tilt,
> playful and chunky proportions.
> A bold **white die-cut sticker border** hugs the object's silhouette.
> The object must stay readable at 60 px. **No text, no letters, no numbers,
> no background, no drop shadow outside the sticker border.**
> Pirate world only: wood, rope, brass, bone, salt — never fantasy, never
> sci-fi.

---

## MÉTIER — la carrière du pirate (17)

### A101 — Mille sabords (palier 4)
Condition : terminer 1 000 parties. — `sum.parties ≥ 1000`
Objet : > Depicting an ancient ship's log book, leather cover cracked with salt, a thousand tally marks burned into the open page edge, a quill resting on top.

### A102 — Cinq cents prises (palier 3)
Condition : gagner 500 parties. — `sum.victoires ≥ 500`
Objet : > Depicting a mountain of captured pirate flags folded and stacked on a wooden pallet, one skull-and-bones flag half unfurled on top.

### A103 — L'amiral (palier 4)
Condition : gagner 1 000 parties. — `sum.victoires ≥ 1000`
Objet : > Depicting a gold admiral's bicorne hat with purple trim and a jeweled anchor cockade, resting on a wooden stand.

### A104 — Dix marées d'affilée (palier 3)
Condition : gagner 10 parties d'affilée. — `max.serie ≥ 10`
Objet : > Depicting ten cresting waves stylized as a curling spiral of water, a tiny ship riding the top one, brass spray droplets.

### A105 — Quinze marées (palier 4)
Condition : gagner 15 parties d'affilée. — `max.serie ≥ 15`
Objet : > Depicting a monstrous single wave shaped like a clenched fist, a proud little ship planted on its crest with a golden flag.

### A106 — L'intouchable (palier 4)
Condition : gagner 8 parties classées d'affilée. — `max.serie.classee ≥ 8`
Objet : > Depicting a laurel wreath woven from golden rope, a small dice cube enthroned at its center like a crown jewel.

### A107 — Le maître d'équipage (palier 3)
Condition : gagner 100 parties classées. — `sum.victoires.classees ≥ 100`
Objet : > Depicting a bosun's brass whistle on a braided lanyard, hanging over a small chalkboard slate covered in victory scratches.

### A108 — Corsaire patenté (palier 3)
Condition : atteindre 1 200 points de classement. — `max.elo ≥ 1200`
Objet : > Depicting a royal letter of marque, a wax seal with a skull emblem, rolled parchment tied with purple ribbon.

### A109 — La terreur des mers (palier 4)
Condition : atteindre 1 350 points de classement. — `max.elo ≥ 1350`
Objet : > Depicting a black pirate flag with a grinning golden skull wearing a crown, the fabric torn by cannon fire, mounted on a broken mast spar.

### A110 — Cap au sommet (palier 4)
Condition : atteindre 1 500 points de classement. — `max.elo ≥ 1500`
Objet : > Depicting a golden spyglass planted vertically like a scepter on a rock summit, tiny clouds below its tip.

### A111 — Tous les visages (palier 2)
Condition : affronter les 15 capitaines. — `max.capitaines.affrontes ≥ 15`
Objet : > Depicting a fan of fifteen worn portrait cards spread like a poker hand, each card back showing a different tiny pirate hat silhouette.

### A112 — Toute la confrérie à genoux (palier 3)
Condition : battre chacun des 15 capitaines au moins une fois. — `max.capitaines.gagnes ≥ 15`
Objet : > Depicting fifteen pirate captain hats impaled on a single boarding pike like a trophy skewer, the topmost hat golden.

### A113 — Cent contre la ferraille (palier 2)
Condition : gagner 100 parties contre la machine. — `sum.victoires.ia ≥ 100`
Objet : > Depicting a dented rusty robot head with a cracked eye lens, worn like a bucket on a mop handle, a victory dagger planted in its dome.

### A114 — Le fléau des automates (palier 3)
Condition : gagner 500 parties contre la machine. — `sum.victoires.ia ≥ 500`
Objet : > Depicting a pile of broken clockwork gears and springs spilling from a torn burlap sack, one gear golden.

### A115 — Le marathon des marées (palier 3)
Condition : terminer 50 parties d'affilée sans en abandonner une. — `max.serie.finies ≥ 50`
Objet : > Depicting a pair of sturdy sea boots with the soles worn through to holes, laces triumphantly tied together, tiny sweat droplets.

### A116 — Vingt-cinq remontées (palier 3)
Condition : gagner 25 parties après avoir été mené. — `sum.remontees ≥ 25`
Objet : > Depicting a rusty anchor being hauled UP out of the water by a taut golden chain, water streaming off it.

### A117 — Le phénix des océans (palier 4)
Condition : gagner 100 parties après avoir été mené. — `sum.remontees ≥ 100`
Objet : > Depicting a burning ship's figurehead of a rising bird carved in wood, flames turning to golden feathers.

## PLATEAU — l'art de poser les dés (18)

### A118 — La citadelle (palier 3)
Condition : aligner 3 triples dans une même partie. — `max.triples.partie ≥ 3`
Objet : > Depicting three stone watchtowers side by side on a wooden game board, each tower built from three stacked dice.

### A119 — Les quatre donjons (palier 4)
Condition : aligner 4 triples dans une même partie. — `max.triples.partie ≥ 4`
Objet : > Depicting a fortress wall of four dice towers with battlements, a tiny purple flag on each tower.

### A120 — Mille salves de trois (palier 4)
Condition : réussir 1 000 triples en carrière. — `sum.triples ≥ 1000`
Objet : > Depicting an overflowing gunpowder keg stuffed with identical dice instead of powder, three dice fused together on top like cannonballs.

### A121 — Cent marches (palier 3)
Condition : poser 100 escaliers (1-2-3 dans une colonne). — `sum.escalier ≥ 100`
Objet : > Depicting a grand wooden staircase built from dice showing one, two, three pips, red carpet runner, brass handrail.

### A122 — Le grand alignement (palier 4)
Condition : porter 12 six sur son plateau en même temps. — `max.six.plateau ≥ 12`
Objet : > Depicting a treasure grid of twelve golden dice all showing six pips, arranged like bars of bullion in a wooden crate.

### A123 — Cent ponts refaits (palier 3)
Condition : remplir 100 plateaux jusqu'à la dernière case. — `sum.pont.refait ≥ 100`
Objet : > Depicting a carpenter's mallet and a plane resting on a freshly rebuilt ship deck section, golden wood shavings curling.

### A124 — La rançon du roi (palier 4)
Condition : finir une partie à 70 points ou plus. — `max.score ≥ 70`
Objet : > Depicting a colossal treasure chest bursting open with gold coins, gems and a crown, coins raining over the edges.

### A125 — Cent tours du pont (palier 3)
Condition : poser dans les quatre colonnes en un seul tour de pont, 100 fois. — `sum.tour.pont ≥ 100`
Objet : > Depicting a ship's compass rose with four dice at the cardinal points, a rope circling them into a loop.

### A126 — Cinq cents rebonds (palier 4)
Condition : 500 dés reposés sur une case tout juste libérée. — `sum.rebonds ≥ 500`
Objet : > Depicting a die bouncing off a wooden plank with springy motion arcs, landing sparks of gold.

### A127 — Toujours premier levé (palier 3)
Condition : ouvrir la partie 500 fois. — `sum.tour.debut ≥ 500`
Objet : > Depicting a brass ship's bell mid-swing with a rising sun engraved on it, tiny motion lines.

### A128 — Cent grands rangements (palier 3)
Condition : 100 colonnes triées du plus grand au plus petit. — `sum.rangement ≥ 100`
Objet : > Depicting three dice neatly racked on a vertical shelf from big pips to small, a white glove hovering beside them.

### A129 — Trois d'entrée, cent fois (palier 4)
Condition : ouvrir 100 parties par un triple. — `sum.trois.entree ≥ 100`
Objet : > Depicting a door being kicked open by a boot, three identical dice flying through the doorway like cannonballs.

### A130 — Sans un double, dix fois (palier 3)
Condition : gagner 10 parties sans jamais poser deux dés identiques dans une colonne. — `sum.parties.sansdouble ≥ 10`
Objet : > Depicting a hand of playing-card-like dice all showing different pips, fanned out, a purple ribbon binding them.

### A131 — Les petits calibres au pouvoir (palier 3)
Condition : gagner 25 parties où votre plus haut dé vaut trois. — `sum.victoires.petits.bas ≥ 25`
Objet : > Depicting a tiny cannon on a matchstick carriage firing a huge golden cannonball, comically oversized blast.

### A132 — Six contre six, encore (palier 3)
Condition : détruire 25 six adverses avec vos propres six. — `sum.six.contre.six ≥ 25`
Objet : > Depicting two golden dice clashing head-on like rams, both showing six pips, impact star between them.

### A133 — Le six généreux (palier 3)
Condition : 50 six posés dans la colonne déjà la plus riche. — `sum.six.riche.deux ≥ 50`
Objet : > Depicting a die showing six pips sitting on a throne of stacked gold coins, tiny crown tilted on its corner.

### A134 — La collection de triples (palier 3)
Condition : réussir un triple de trois valeurs différentes au fil de la carrière. — `max.triples.varietes ≥ 3`
Objet : > Depicting a display case of three trophy dice on velvet cushions, each die a different colour and pip count.

### A135 — L'entêté du 1,3 récidive (palier 4)
Condition : 10 poses dans la colonne ×1,3 en une seule partie. — `max.poses.riche.partie ≥ 10`
Objet : > Depicting a stubborn mule loaded with dice sacks climbing a golden column, purple banner on the column top.

## GUERRE — la destruction et la survie (20)

### A136 — Dix mille éclats (palier 4)
Condition : détruire 10 000 dés adverses en carrière. — `sum.detruits ≥ 10000`
Objet : > Depicting an apocalyptic pile of shattered dice fragments forming a hill, a cutlass planted on top like a summit flag.

### A137 — Le grand carnage (palier 4)
Condition : détruire 12 dés adverses en une seule partie. — `max.detruits.partie ≥ 12`
Objet : > Depicting a massive two-handed axe buried in a chopping block, twelve broken dice halves scattered around.

### A138 — Cinq cents ripostes (palier 4)
Condition : répondre 500 fois à une destruction par une destruction. — `sum.riposte ≥ 500`
Objet : > Depicting two crossed cutlasses striking sparks, one blade gold and one blade purple, a small shattered die between them.

### A139 — Cent premiers sangs (palier 3)
Condition : détruire le premier dé de la partie, 100 fois. — `sum.detruit.premiere ≥ 100`
Objet : > Depicting a dagger pinning a single die to a wooden mast, one drop of red paint running from the die.

### A140 — Cent derniers mots (palier 3)
Condition : porter le dernier coup destructeur de la partie, 100 fois. — `sum.detruit.derniere ≥ 100`
Objet : > Depicting a smoking flintlock pistol laid on a closed leather book, one spent golden bullet beside it.

### A141 — Le boucher des sept mers (palier 4)
Condition : gagner 100 parties en détruisant huit dés ou plus. — `sum.victoires.boucher ≥ 100`
Objet : > Depicting a butcher's cleaver crowned with a small golden crown, resting on a scarred chopping block.

### A142 — Le charpentier en chef (palier 3)
Condition : gagner 100 parties en perdant au plus deux dés. — `sum.victoires.charpentier ≥ 100`
Objet : > Depicting a ship hull cross-section patched with neat golden planks, hammer and nails resting proudly on top.

### A143 — Cinquante fois intact (palier 4)
Condition : gagner 50 parties sans perdre un seul dé. — `sum.victoires.intact ≥ 50`
Objet : > Depicting a pristine white ship figurehead without a scratch, polished to a mirror shine, one gold star glint.

### A144 — Le pacifiste convaincu (palier 3)
Condition : gagner 25 parties sans détruire un seul dé. — `sum.victoires.sansdetruire ≥ 25`
Objet : > Depicting a cutlass beaten into a fishing rod, a small fish on the hook, a dove-shaped wood carving on the handle.

### A145 — Cinquante paix des braves (palier 3)
Condition : 50 parties sans aucune destruction d'aucun côté. — `sum.parties.paisibles ≥ 50`
Objet : > Depicting two pirate hats hung on the same coat peg, a white flag folded neatly beneath them.

### A146 — Sans six ni pitié (palier 3)
Condition : gagner 50 parties sans poser un seul six. — `sum.victoires.sanssix ≥ 50`
Objet : > Depicting a die showing six pips crossed out by two ropes tied in an X, victory laurels around it.

### A147 — Défait mais debout (palier 2)
Condition : perdre 50 parties d'un ou deux points. — `sum.defaites.serrees ≥ 50`
Objet : > Depicting a battered wooden shield full of arrows and dents, still standing upright planted in the sand.

### A148 — D'un cheveu, cent fois (palier 4)
Condition : gagner 100 parties d'un seul point. — `sum.victoires.dunpoint ≥ 100`
Objet : > Depicting a golden balance scale tipped by a single tiny feather against a pile of cannonballs.

### A149 — L'armada des gueux (palier 3)
Condition : gagner 50 parties avec un score final sous 20. — `sum.victoires.miettes ≥ 50`
Objet : > Depicting a tiny raft made of three barrels and a broom-mast flying an oversized victory flag.

### A150 — Les mains nues, cinquante fois (palier 3)
Condition : gagner 50 parties sans jouer un seul effet. — `sum.victoires.mainsnues ≥ 50`
Objet : > Depicting two bare crossed fists wrapped in worn rope bandages, tiny golden victory sparks at the knuckles.

### A151 — David contre Goliath (palier 3)
Condition : gagner 50 parties contre un adversaire mieux classé. — `sum.victoires.malgre.riche ≥ 50`
Objet : > Depicting a small slingshot resting against a giant fallen anchor, one small golden pebble in the sling.

### A152 — Le sou du pauvre fait fortune (palier 3)
Condition : gagner 50 parties en ayant toujours eu moins d'or que l'autre. — `sum.victoires.pauvre.plus ≥ 50`
Objet : > Depicting a single humble copper coin on a velvet cushion under a glass dome, glowing like a relic.

### A153 — Cent trônes volés (palier 3)
Condition : prendre la tête au tout dernier coup, 100 fois. — `sum.trone.vole ≥ 100`
Objet : > Depicting a small wooden stool being swapped in place of a golden throne by a hooked cane, motion lines.

### A154 — Face aux cinq, cinquante fois (palier 3)
Condition : gagner 50 parties contre un adversaire à cinq effets d'avance. — `sum.victoires.cinq.un ≥ 50`
Objet : > Depicting one lone sword facing five floating hostile daggers, the sword's blade shining gold.

### A155 — La somme inférieure (palier 3)
Condition : gagner 50 parties avec moins de points de dés posés au total. — `sum.victoires.somme.inferieure ≥ 50`
Objet : > Depicting an abacus with only three golden beads slid across, beating a second abacus overloaded with dull beads, the loaded one tipping over.

## EFFETS — les tours de magie noire (20)

### A156 — Le gel éternel (palier 3)
Condition : geler l'adversaire 100 fois. — `sum.teach.gel ≥ 100`
Objet : > Depicting an ornate hourglass completely frozen in a block of blue-purple ice, frost creeping on the wood frame.

### A157 — Gel et couperet, cinquante fois (palier 3)
Condition : détruire un dé dans une colonne gelée, 50 fois. — `sum.gel.couperet ≥ 50`
Objet : > Depicting an axe blade shattering a frozen die, ice shards and purple frost exploding outward.

### A158 — Le gel rentable (palier 3)
Condition : gagner 50 parties où votre gel a fait la différence. — `sum.gel.paye.victoire ≥ 50`
Objet : > Depicting a snowflake made of tiny gold coins, one icicle dripping molten gold.

### A159 — Mary relance encore (palier 3)
Condition : utiliser 100 relances de Mary Read. — `sum.mary.relance ≥ 100`
Objet : > Depicting a dice cup mid-throw with two dice tumbling out in a loop trajectory, arrows showing the spin, purple cup with gold trim.

### A160 — Cent bénédictions de Grace (palier 3)
Condition : bénir une colonne 100 fois. — `sum.grace.benie ≥ 100`
Objet : > Depicting a stone column wearing a halo of golden light, tiny angel wings sprouting from its sides.

### A161 — L'œil perçant de Ching (palier 3)
Condition : lire le dé adverse 100 fois avec la longue-vue. — `sum.ching.oeil ≥ 100`
Objet : > Depicting a brass spyglass whose lens shows a giant cartoon eye, purple iris, gold rim.

### A162 — Jack toujours devant (palier 3)
Condition : voler l'avance 100 fois avec Calico Jack. — `sum.jack.avance ≥ 100`
Objet : > Depicting a racing rowboat leaning into a sharp turn, spray behind it, a small golden trophy strapped to the bow.

### A163 — La bordée parfaite (palier 4)
Condition : emporter 12 dés d'une seule bordée. — `max.bordee.pose ≥ 12`
Objet : > Depicting a broadside of three cannons firing at once, smoke rings and a wall of flying dice blasted away.

### A164 — La bénie bien serrée (palier 3)
Condition : gagner 50 parties serrées grâce à la colonne bénie. — `sum.benie.serre ≥ 50`
Objet : > Depicting a stone column squeezed by a knotted golden rope, a tiny halo above, one sweat drop.

### A165 — Fortune dilapidée, encore (palier 3)
Condition : gagner 25 parties contre un adversaire qui a brûlé ses trois effets. — `sum.victoires.fortunegaspillee ≥ 25`
Objet : > Depicting an upside-down empty coin purse shaken by two hands, three spent scrolls fluttering down like dead leaves.

### A166 — L'or propre (palier 3)
Condition : gagner 50 parties sans effet face à un adversaire qui en a joué. — `sum.victoires.propre.riche ≥ 50`
Objet : > Depicting a white glove holding a sparkling gold coin above a mud puddle, the coin spotless.

### A167 — Le maître du dé pipé (palier 3) ⚠ nouveau compteur
Condition : jouer 50 dés pipés (l'effet de Captain Kidd). — `sum.kidd.pipe ≥ 50`
Objet : > Depicting a die with a sly winking face painted on its six side, one corner secretly weighted with a brass plug.

### A168 — Le tricheur tranquille (palier 3) ⚠ nouveau compteur
Condition : gagner 25 parties où le dé pipé a été joué. — `sum.victoires.pipe ≥ 25`
Objet : > Depicting a rocking chair on a ship deck with a die relaxing in it, tiny smug smile, a hidden magnet under the chair.

### A169 — Cinquante brouillards (palier 3) ⚠ nouveau compteur
Condition : lever 50 brouillards de poudre (l'effet de Wang Zhi). — `sum.wang.brume ≥ 50`
Objet : > Depicting a purple smoke cloud rolling out of an opened powder barrel, a ship's lantern glowing faintly inside the fog.

### A170 — Victoire sous la brume (palier 3) ⚠ nouveau compteur
Condition : gagner 25 parties protégées par la brume. — `sum.victoires.brume ≥ 25`
Objet : > Depicting a victory flag emerging from the top of a thick purple fog bank, only the golden flag visible.

### A171 — Le manœuvrier (palier 3) ⚠ nouveau compteur
Condition : réussir 50 manœuvres de pont (l'effet d'Anne Levent). — `sum.levent.manoeuvre ≥ 50`
Objet : > Depicting a die being slid across a deck plank on a small wooden trolley pulled by a rope and pulley system.

### A172 — La coque d'acier (palier 3) ⚠ nouveau compteur
Condition : renforcer la coque 50 fois (l'effet de Black Caesar). — `sum.caesar.coque ≥ 50`
Objet : > Depicting a die wrapped in riveted brass armor plating with heavy chain links, one polished reflection.

### A173 — Le dé épargné (palier 3) ⚠ nouveau compteur
Condition : 25 dés sauvés de la destruction par la coque. — `sum.coque.sauve ≥ 25`
Objet : > Depicting a cannonball bouncing off an armored die with a comical CLANG star, the die unharmed and winking.

### A174 — Le changement de quart (palier 3) ⚠ nouveau compteur
Condition : tourner les quarts 50 fois (l'effet de Sayyida al-Hurra). — `sum.sayyida.quarts ≥ 50`
Objet : > Depicting a ship's wheel spinning fast with four small multiplier flags whirling around it like a carousel.

### A175 — Toute la nouvelle garde (palier 4) ⚠ nouveau compteur
Condition : gagner au moins une partie avec chacun des cinq nouveaux capitaines. — `max.nouveaux.capitaines ≥ 5`
Objet : > Depicting five distinct pirate hats arranged in a proud fan on a rack: a tricorne, a turban, a headscarf, a wide-brim captain hat and a fur-trimmed hat, all with gold trim.

## QUARTS — les multiplicateurs du pont (15)

### A176 — Le fidèle du 1,3 (palier 3)
Condition : gagner 50 parties où la colonne ×1,3 porte votre meilleur score. — `sum.victoires.double ≥ 50`
Objet : > Depicting a golden column pedestal with a laurel crown on top, small purple pennant showing an upward arrow.

### A177 — Cent sacrifices (palier 3)
Condition : sacrifier 100 colonnes ×0,5 pleines. — `sum.sacrifiee ≥ 100`
Objet : > Depicting a stone altar with a cracked die offered on it, two candles with purple flames.

### A178 — Le pauvre trois fois riche (palier 3)
Condition : gagner 50 parties avec un triple dans la colonne ×0,5. — `sum.victoires.trois.pauvre ≥ 50`
Objet : > Depicting three identical dice stacked inside a beggar's wooden bowl that overflows with gold light.

### A179 — Le compte rond du quartier-maître (palier 3)
Condition : finir 50 parties sur un score multiple de dix. — `sum.compte.rond ≥ 50`
Objet : > Depicting a brass counting wheel with all its notches perfectly aligned on the zero, a quill checking it.

### A180 — L'égalité parfaite, trois fois (palier 4)
Condition : finir 3 parties sur un score strictement égal. — `sum.egalite.parfaite ≥ 3`
Objet : > Depicting a balance scale in perfect equilibrium, an identical die on each plate, a knot tied at the exact middle of the beam.

### A181 — Mieux placé que servi, cinquante fois (palier 3)
Condition : gagner 50 parties avec moins de dés posés que l'autre. — `sum.victoires.somme.inferieure ≥ 50` (second palier de A155, seuil distinct)
Objet : > Depicting a small chessboard-like deck grid with only three dice placed but glowing, against a crowded dull grid behind.

### A182 — Le sou du pauvre, palier d'or (palier 4)
Condition : gagner 100 parties en infériorité d'or permanente. — `sum.victoires.pauvre.plus ≥ 100`
Objet : > Depicting a patched leather purse with a single coin inside, the purse lifted on a trophy pedestal.

### A183 — Le grand écart (palier 3)
Condition : gagner 25 parties de 25 points d'écart ou plus. — ⚠ nouveau compteur `sum.victoires.ecrasantes`
Objet : > Depicting a huge wave of gold coins crashing over a tiny rowboat, the wave forming a victorious fist.

### A184 — Les quarts au cordeau (palier 3)
Condition : gagner 25 parties en ayant marqué dans les quatre quarts. — ⚠ nouveau compteur `sum.victoires.quatre.quarts`
Objet : > Depicting a ship's deck divided into four painted quadrants, a golden die planted dead center of each.

### A185 — Le mépris du riche (palier 3)
Condition : gagner 25 parties sans rien poser dans la colonne ×1,3. — ⚠ nouveau compteur `sum.victoires.sans.riche`
Objet : > Depicting a golden column pedestal covered in cobwebs while a humble wooden column beside it wears the victory laurels.

### A186 — Le tout au même quart (palier 4)
Condition : gagner 10 parties avec 30 points ou plus dans une seule colonne. — ⚠ nouveau compteur `sum.victoires.colonne.reine`
Objet : > Depicting one monumental column of stacked dice reaching into the clouds, tiny flags planted up its side like a climbed peak.

### A187 — Cinquante fois rien (palier 3)
Condition : gagner 50 parties avec une colonne finale à zéro. — ⚠ nouveau compteur `sum.victoires.colonne.vide`
Objet : > Depicting an empty stone pedestal with a victory wreath hung on it, a tiny bird nesting where the trophy should be.

### A188 — L'équilibriste (palier 3)
Condition : finir 25 parties avec exactement le même score dans deux colonnes. — ⚠ nouveau compteur `sum.colonnes.jumelles`
Objet : > Depicting two identical dice towers connected by a tightrope, a coin walking the rope with a balancing pole.

### A189 — La marée montante (palier 3)
Condition : finir 25 parties avec quatre colonnes en scores strictement croissants. — ⚠ nouveau compteur `sum.colonnes.croissantes`
Objet : > Depicting four wooden columns of rising heights like organ pipes, a wave climbing them as stairs.

### A190 — Le quatuor plein (palier 4)
Condition : finir 10 parties avec les quatre colonnes pleines. — ⚠ nouveau compteur `sum.pont.complet`
Objet : > Depicting a fully loaded cargo deck, four columns of crates lashed tight with golden rope, a proud seagull on top.

## CURIOSITÉS — les caprices du hasard (10)

### A191 — Le dé bègue royal (palier 4)
Condition : lancer 8 fois la même valeur d'affilée. — `max.repetition ≥ 8`
Objet : > Depicting a die with a stuck expression repeating itself in fading echo copies behind it, tiny sweat drop, echo lines.

### A192 — Cent parades du six (palier 3)
Condition : voir les six faces défiler dans une partie, 100 fois. — `sum.six.faces ≥ 100`
Objet : > Depicting six dice arranged in a circle each showing a different face, forming a clock without hands.

### A193 — Le fantôme récidiviste (palier 3)
Condition : perdre 10 parties contre un adversaire parti avant la fin. — `sum.battu.fantome ≥ 10`
Objet : > Depicting a ghostly translucent pirate coat and hat floating with no body inside, holding a winning die.

### A194 — Dix déserteurs (palier 2)
Condition : voir 10 adversaires abandonner le navire. — `sum.deserteur ≥ 10`
Objet : > Depicting an empty rowboat rowing away by itself, oars mid-stroke, a white feather floating behind.

### A195 — Cent comptes ronds (palier 4)
Condition : finir 100 parties sur un score multiple de dix. — `sum.compte.rond ≥ 100`
Objet : > Depicting a perfect circle of gold coins with one coin snapping into the last empty slot, satisfying click star.

### A196 — Ton reflet, cent fois (palier 3)
Condition : gagner 100 duels en miroir, capitaine contre le même capitaine. — `sum.victoires.memecap ≥ 100`
Objet : > Depicting an ornate hand mirror whose reflection shows a grinning skull instead of a face, gold frame, purple glass.

### A197 — L'escalier céleste (palier 4)
Condition : poser 500 escaliers en carrière. — `sum.escalier ≥ 500`
Objet : > Depicting a spiral staircase of dice climbing into a cloud, the top step made of solid gold.

### A198 — Le collectionneur d'acier (palier 4)
Condition : posséder les douze gravures légendaires. — ⚠ nouveau compteur `max.gravures`
Objet : > Depicting an open velvet-lined collector's case holding twelve tiny engraved dice, each a different finish, one slot glowing.

### A199 — La flotte au complet (palier 4)
Condition : débloquer les quinze capitaines. — ⚠ nouveau compteur `max.capitaines.ouverts`
Objet : > Depicting fifteen tiny ships in bottle, arranged on a wooden shelf like a fleet at anchor, the largest bottle golden.

### A200 — Le deux-centième (palier 4)
Condition : débloquer 199 autres hauts faits. — ⚠ nouveau compteur `max.succes.ouverts`
Objet : > Depicting a monumental golden trophy shaped like a die on a pedestal, wearing a captain's hat, confetti of tiny dice and coins falling around it.

---

## Ce que je ferai en recevant les images

1. Contrôle : fond transparent, un seul objet, liseré blanc, lisible à 60 px.
2. Réduction à 192×192 → `www/dice/img/succes/A101.png` … `A200.png`.
3. Migration SQL `achievement` (identifiants, familles, compteurs, seuils,
   récompenses selon l'échelle des paliers) + les ~15 nouveaux compteurs dans
   `succes.js`/`bilan.js` pour les fiches marquées ⚠.
4. Les 200 clés de traduction (`suc.A1xx.name` / `suc.A1xx.txt`) en quatre
   langues, comme les cent premières.
