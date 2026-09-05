# The Pirate's Dice : les 20 capitaines et leur bonus actuel

> Document a donner tel quel a une IA. Objectif : proposer PAR CAPITAINE un
> arbre a competences de 6 sorts nouveaux, organises en chemins, qui se
> debloquent au fil des parties jouees avec ce capitaine. Etat exact du jeu en
> production au 2026-09-06.

## 1. Le jeu en bref

Duel de des 1 contre 1. Plateau de 4 colonnes de 3 cases par joueur. A ton
tour : tu lances un de, tu le poses dans une de tes colonnes. Une colonne vaut
valeur x (occurrences au carre). Poser un de detruit les des adverses de meme
valeur dans la colonne d'en face. Multiplicateurs de colonnes tires au sort en
debut de partie (x1,3 / x1 / x0,8 / x0,5), identiques pour les deux camps. La
partie s'arrete quand un plateau est plein, le plus haut total gagne. Environ
2 a 3 minutes par partie.

Chaque capitaine OFFRE gratuitement son effet une fois par partie (son trait).
Un joueur peut jouer au plus 3 effets par partie. L'effet du capitaine ne
s'achete pas : il vient avec lui.

## 2. Les 20 capitaines et leur bonus actuel

| # | Capitaine | Titre | Bonus actuel (1 fois par partie) | Effet | Acquisition |
|---|-----------|-------|----------------------------------|-------|-------------|
| 1 | Mary Read | La corsaire insaisissable | Relance gratuite du de | B001 | offerte |
| 2 | Calico Jack | Le pavillon qu'on reconnait | Commence la partie avec un de deja pose | aucun (trait passif) | 25 parties |
| 3 | Ching Shih | L'amirale aux six cents jonques | Bordee : rase deux colonnes face a face (la sienne et celle d'en face) | B010 | 100 parties |
| 4 | Barbe-Noire | La barbe qui fume | Gele une colonne adverse pendant son prochain tour | B006 | 150 parties |
| 5 | Grace O'Malley | La reine des mers d'Irlande | Colonne benie : +15 % jusqu'a la fin | B005 | 250 parties |
| 6 | Anne Bonny | Celle qu'on n'a jamais pendue | Le prochain tour adverse est deux fois plus court | B008 | 350 parties |
| 7 | Black Bart | Le plus grand tableau de chasse | Troc : echange son de et celui d'en face, meme case | B009 | 400 parties |
| 8 | La Lionne Sanglante | L'oeil qui voit venir | Longue-vue : voit le prochain de adverse | B004 | 450 parties |
| 9 | Henry Morgan | Le pirate qu'on a anobli | Tour vole : l'adversaire saute son prochain tour | B007 | 500 parties |
| 10 | Olivier Levasseur | La Buse, et son enigme | Colonne maudite : -15 % jusqu'a la fin | B011 | 550 parties |
| 11 | Captain Kidd | Le corsaire pendu | De pipe : decale son lancer d'un cran (jamais 1 vers 6) | B012 | 600 parties |
| 12 | Wang Zhi | Le marchand de fumee | Brouillard : le prochain de adverse ne detruit rien | B013 | 650 parties |
| 13 | Anne Levent | La danseuse de pont | Manoeuvre : deplace le de superieur d'une colonne vers une autre | B014 | 700 parties |
| 14 | Black Caesar | La coque inbrisable | Coque : protege un de jusqu'a la fin du prochain tour adverse | B015 | 750 parties |
| 15 | Sayyida al-Hurra | La dame des marees | Echange deux multiplicateurs de colonne, pour les deux joueurs | B016 | 800 parties |
| 16 | Jeanne de Clisson | La veuve noire des mers | Vendetta : le prochain de adverse qui detruit un des siens est detruit a son tour, et sa case gele un tour | B017 | 850 parties |
| 17 | Charles Vane | L'indomptable de Nassau | Pavillon noir : sa prochaine pose detruit la valeur dans les quatre colonnes adverses | B018 | 900 parties |
| 18 | Jean Lafitte | Le gentleman contrebandier | Passage secret : son prochain de peut se poser dans une colonne pleine, le de superieur cede sans destruction | B019 | 950 parties |
| 19 | Samuel Bellamy | Le prince des pirates | Butin du Whydah : sa prochaine pose remplit la colonne de la meme valeur, si l'adversaire ne la possede nulle part | B020 | 1000 parties |
| 20 | Jack Sparrow | La legende insaisissable | Compas capricieux : re-tire tous les des d'une de ses colonnes et de celle d'en face, sans destruction | B021 | succes legendaire A200 uniquement |

## 3. Le systeme d'eveil (deja decide, a integrer aux arbres)

Un capitaine s'eveille EN LE JOUANT. Son medaillon porte une flamme dans le
dos selon son niveau d'eveil :

| Niveau | Flamme | Nom |
|--------|--------|-----|
| 0 | aucune | normal |
| 1 | grise | prime |
| 2 | bleue | epic |
| 3 | doree | legendary |

Les seuils d'usage exacts (combien de parties jouees avec le capitaine pour
chaque niveau) restent a proposer : donner un avis chiffre coherent avec les
seuils d'acquisition ci-dessus.

## 4. La commande : 6 sorts par capitaine, en arbre

Pour CHACUN des 20 capitaines, proposer un arbre de 6 sorts nouveaux :

- l'arbre se debloque au fil des parties jouees AVEC ce capitaine ;
- il offre des CHEMINS : le joueur choisit une branche, et ses choix decident
  quels sorts il possede (il ne peut pas tout avoir) ;
- proposer la forme de l'arbre (par exemple : 2 branches de 3, ou un tronc de
  2 puis une fourche de 2+2, au choix si c'est justifie) ;
- chaque sort : un nom court, une description d'une phrase, sa cible dans la
  grammaire ci-dessous, son rang dans l'arbre, et le niveau d'eveil requis
  (prime, epic ou legendary) ;
- les sorts doivent prolonger l'identite du capitaine (sa legende, son bonus
  actuel) sans faire doublon avec les 21 effets existants (B001 a B021) ni
  entre capitaines.

### Grammaire des cibles disponible dans le moteur

Une case a soi, une case adverse, une case miroir (meme position des deux
cotes), une colonne a soi, une colonne adverse, les deux colonnes face a face,
le plateau entier, le de qu'on vient de lancer, le prochain de adverse, la
meche du tour (temps), les multiplicateurs de colonnes, un drapeau arme qui
modifie la prochaine pose (la sienne ou celle de l'adversaire).

### Contraintes non negociables

1. Deterministe et rejouable : tout effet doit pouvoir se rejouer depuis un
   journal de coups, sans hasard propre (si un sort tire au sort, les valeurs
   tirees doivent pouvoir etre enregistrees au moment du coup).
2. Pas de sort qui depende du temps reel, du reseau ou d'un etat exterieur a
   la partie.
3. Equilibre : maximum 3 effets joues par partie, et l'adversaire IA doit
   pouvoir jouer contre sans etre demuni. Eviter tout sort qui gagne la partie
   a lui seul.
4. Lisibilite : chaque sort doit se dessiner en un geste a l'ecran (une case
   qui brille, une colonne qui gele, un de qui change) et se dire en une
   phrase.
5. Les noms et descriptions ne doivent JAMAIS contenir de tiret cadratin.

### Format de reponse attendu

Pour chaque capitaine : un titre, la forme de l'arbre, puis les 6 sorts en
liste avec : nom, rang dans l'arbre, branche, niveau d'eveil requis, cible,
description d'une phrase, et une note d'equilibre d'une ligne.
