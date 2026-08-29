# The Pirate's Dice — squelette de fonctionnement

> Document de référence, écrit pour être lu par quelqu'un — humain ou machine —
> qui n'a jamais vu le jeu. Il décrit ce que le jeu **fait**, pas ce qu'il
> pourrait faire : chaque nombre qui suit est celui du code au moment de
> l'écriture, et les fichiers sont nommés pour qu'on puisse vérifier.
>
> Deux dépôts : `piratesdice` (le client, une WebView Capacitor) et `dice-server`
> (le serveur Node, qui fait autorité). Le client ne décide de rien.

---

## 1. En une phrase

Un duel de dés à deux joueurs : on lance un dé, on le pose dans une de ses quatre
colonnes, et poser un dé **détruit tous les dés adverses de même valeur dans la
colonne d'en face**. La partie s'arrête quand un plateau est plein ; le plus haut
total gagne.

C'est un jeu de placement où chaque pose est à la fois une construction et une
attaque. Le hasard donne la valeur, le joueur décide de ce qu'il en fait.

---

## 2. Le plateau

Chaque joueur a **4 colonnes de 3 cases** — 12 dés au maximum. Les deux plateaux
se font face : la colonne 0 de l'un affronte la colonne 0 de l'autre.

Un dé a **6 faces**. Il n'y a rien d'autre sur le plateau.

*(`src/game/rules.js` : `COLUMNS = 4`, `COLUMN_SIZE = 3`, `CELLS = 12`.)*

### Le score d'une colonne

```
score = Σ ( valeur × occurrences² )   pour chaque valeur présente
```

Trois 4 dans une colonne valent `4 × 3² = 36`, pas 12. C'est cette exponentielle
qui fait tout l'intérêt d'empiler : deux dés identiques valent déjà le double de
deux dés dépareillés, trois en valent quatre fois plus.

Le score est ensuite modifié, **dans cet ordre** :

1. **le quart du pont** (voir §4) — multiplicateur fixé au début de la partie ;
2. **la bénédiction**, ×1,15, si la colonne est bénie ;
3. **la malédiction**, ×0,85, si elle est maudite.

Chaque étape arrondit. Une colonne bénie *et* maudite finit donc à ≈97,75 % de sa
valeur — presque rien, ce qui est exactement juste : deux effets qui s'annulent
doivent s'annuler.

Le total d'un joueur est la somme de ses quatre colonnes.

---

## 3. Le tour

1. **Lancer.** Un dé, une valeur entre 1 et 6.
2. **Jouer un effet** (facultatif, voir §6).
3. **Poser.** Le dé tombe dans la case libre la plus basse de la colonne choisie.
4. **La destruction.** Tous les dés adverses **de la même valeur, dans la même
   colonne**, disparaissent. La colonne d'en face se tasse : les survivants
   tombent, il ne reste jamais de trou au milieu.
5. La main passe.

Emporter **deux dés ou plus d'un coup** est une *bordée* — le meilleur coup du
jeu, et il s'annonce à l'écran.

### La pendule

Chaque tour dure **18 secondes**. Passé ce délai, le tour est **perdu** : le dé
est jeté, la main passe. Trois tours sautés d'affilée valent forfait.

⚠️ Le tour n'est **pas** joué à la place du joueur. Une IA qui posait le dé
offrait un coup optimal à celui qui posait son téléphone : attendre devenait une
stratégie.

Seule chose qui rallonge un tour : **un effet réellement appliqué** relance la
pendule. Armer un effet ne la relance pas — sinon armer/annuler en boucle tenait
le tour indéfiniment.

---

## 4. Les quarts du pont

Au début de chaque partie, les quatre colonnes reçoivent une permutation de
`[1,3 · 1 · 0,8 · 0,5]`. Elles sont **les mêmes pour les deux joueurs** et
visibles des deux côtés.

La somme est constante : une partie vaut toujours autant, seule la **répartition**
change. Sans cela, le hasard porterait sur le score et non sur la décision.

La quatrième colonne à 0,5 punit deux fois plus que les autres ne récompensent :
c'est ce qui fait que chaque pose est un arbitrage — empiler sur la colonne
riche, ou sur celle que l'adversaire ne peut plus atteindre.

---

## 5. Les dix capitaines

On choisit son capitaine **avant** la partie. C'est la seule décision prise hors
du tour, et elle pèse sur toute la partie sans changer les règles.

Chaque capitaine **offre un effet, une fois par partie** — gratuitement en
monnaie, mais il occupe **une des trois places** d'effets (voir §6).

| capitaine | débloqué à | trait | effet offert |
|---|---|---|---|
| Mary Read | 0 partie | relance | B001 |
| Calico Jack | 25 | un dé déjà posé au départ | *aucun* |
| Ching Shih | 100 | bordée sur la colonne | B010 |
| Barbe-Noire | 150 | gèle une colonne adverse | B006 |
| Grace O'Malley | 250 | bénit une de ses colonnes | B005 |
| Anne Bonny | 350 | presse le tour adverse | B008 |
| Black Bart | 400 | troque deux dés | B009 |
| La Lionne Sanglante | 450 | longue-vue | B004 |
| Henry Morgan | 500 | vole un tour | B007 |
| Olivier Levasseur | 550 | maudit une colonne adverse | B011 |

Le seuil est en **parties terminées**, pas en victoires : on ne punit pas celui
qui perd, on récompense celui qui reste. Les cinq premiers paliers s'écartent
(0, 25, 100, 150, 250) parce qu'on découvre encore le jeu ; les cinq derniers
avancent d'un pas constant de 50, parce qu'au-delà de 250 parties on ne découvre
plus rien et qu'un palier qui doublerait mettrait le dernier hors de portée.

**C'est le serveur qui tranche.** Le client dessine des cadenas ; un client
modifié n'en dessinerait aucun.

*(`src/game/captains.js`.)*

---

## 6. Les onze effets

Trois effets par partie, **trait du capitaine compris**. Ils s'achètent en
boutique, sauf celui qu'offre le capitaine.

| id | nom | cible | ce qu'il fait |
|---|---|---|---|
| B001 | Relance | — | relance son dé |
| B002 | Nettoyage | une de SES cases | efface un de ses propres dés |
| B003 | Canon | une case adverse | efface un dé adverse |
| B004 | Longue-vue | — | montre le prochain dé de l'adversaire |
| B005 | Colonne bénie | une de SES colonnes | +15 % jusqu'à la fin |
| B006 | Colonne gelée | une colonne adverse | injouable pendant son prochain tour |
| B007 | Tour volé | l'adversaire | il saute son prochain tour, on rejoue |
| B008 | Sablier fêlé | l'adversaire | son prochain tour dure **moitié moins** |
| B009 | Troc de dés | une case | son dé et celui d'en face, **même case**, échangent |
| B010 | Bordée sur la colonne | une colonne | emporte **les deux** colonnes face à face |
| B011 | Colonne maudite | une colonne adverse | −15 % jusqu'à la fin |

Un même effet ne se joue **qu'une fois par partie**, même si on en possède
plusieurs — sans quoi la partie se déciderait sur ce qu'on a acheté en double.

Deux effets sont **refusés hors ligne** : la longue-vue (elle tire le dé suivant,
ce qui casserait l'ordre de consommation du hasard sur lequel repose la
vérification) et le sablier (il n'y a pas de pendule quand on joue seul).

Un effet ne se vend qu'**avec le capitaine qui le porte** : B002 et B003
n'appartiennent à personne et sont offerts d'entrée ; les neuf autres héritent du
seuil de leur capitaine.

*(`src/game/bonus.js`.)*

---

## 7. Fin de partie et victoire

La partie s'arrête dès qu'**un** plateau est plein (12 dés). Le plus haut total
gagne ; à égalité, c'est une nulle.

**Abandon.** Celui qui quitte voit son score mis à zéro. Depuis peu, la règle se
lit **par siège** : le déserteur ne compte rien — ni partie, ni haut fait — mais
**celui qui reste garde tout**, exactement comme si l'autre avait perdu à la
règle. Partir ne doit jamais retirer à l'autre ce qu'il vient de gagner.

**Coupure réseau.** Une déconnexion ne perd pas la partie : la table est mise de
côté pendant **30 secondes**, l'adversaire voit qui manque et jusqu'à quand on
l'attend. Au-delà, c'est un forfait.

---

## 8. Deux monnaies

- **L'or** — se gagne en jouant. 20 pièces pour une partie contre la machine,
  100 pour une partie qui fait **monter** au classement. Une table ouverte puis
  refermée ne paie rien.
- **La monnaie maudite** — ne s'achète nulle part. Elle récompense les hauts
  faits, un point c'est tout.

Il n'y a **pas de mise**. Parier une monnaie sur l'issue d'un match entre dans la
définition d'Apple de la « simulation de jeu d'argent », qu'un compte de
développeur individuel ne peut pas publier. Gagner des pièces en jouant et les
dépenser en boutique est de la progression ; parier ne l'est pas.

La boutique vend : les **effets** (§6), les **parures de dés** et les **gravures**
qu'on pose dessus. Quatre ornements ne s'achètent avec aucune bourse — ils se
gagnent aux hauts faits légendaires.

---

## 9. Les cent hauts faits

Cinq familles : *métier*, *plateau*, *guerre*, *effets*, *quarts*, *curiosités*.
Chacun a une cible chiffrée, une prime en or, une prime en monnaie maudite, et
parfois un objet (une parure, une gravure, un effet).

**Ils se récupèrent, ils ne tombent pas tout seuls.** Franchir la cible débloque ;
il faut ensuite aller les chercher. Un haut fait qu'on va chercher se remarque.

**Ce qui les nourrit** — c'est la règle la plus importante du système :

- la partie doit être jouée **contre un humain**, en ligne ;
- elle doit être **menée à son terme** (ou l'adversaire l'a quittée, pas nous) ;
- elle doit être **assez longue** (au moins 6 coups).

Gagner des points au classement n'est **pas** exigé : deux joueurs trop écartés ne
bougent pas leurs notes, et leur partie compte quand même.

Deux compteurs échappent à la règle, et il le faut : « battez la machine dix
fois » et « cinquante fois » ne parlent que d'elle.

*(`src/game/succes.js`, `sql/016_catalogue_succes.sql`.)*

---

## 10. Ce qui fait progresser

Un seul nombre ouvre les capitaines **et** les effets en boutique : le compteur de
**parties**. Il n'augmente que si la partie a été **jouée, menée au bout, et en
ligne contre un humain**. Le solo paie des pièces, il n'ouvre rien.

---

## 11. Le classement (Elo)

`K = 32`. Une partie ne bouge les notes que si :

- les deux joueurs ont au moins **5 parties** au compteur (période de placement) ;
- leur écart de note est inférieur à **250 points** ;
- la partie fait au moins **6 coups** ;
- les deux mêmes joueurs ne se sont pas déjà affrontés **3 fois** dans les
  dernières 24 heures.

Chacune de ces conditions ferme une porte au farm — un compte neuf créé pour
faire monter l'autre, deux amis qui se renvoient la balle, une table ouverte et
refermée.

---

## 12. Jouer avec les autres

### La file d'attente

On appuie sur « défier un joueur », on entre dans la file, et le premier
adversaire **jouable** est apparié. « Jouable » écarte : soi-même (deux téléphones
sur un même compte doubleraient tous les compteurs), les sockets mortes, et —
temporairement — l'adversaire qu'on vient d'affronter.

**L'évitement du rematch est une préférence, pas une interdiction.** On cherche
d'abord quelqu'un d'autre ; passé **6 secondes** d'attente, on remet les deux
mêmes face à face plutôt que de les laisser devant un écran qui tourne. Sans
cela, deux joueurs seuls en ligne ne pouvaient plus jamais rejouer.

### Les salons privés

L'hôte ouvre une table et reçoit un **code de 5 signes**. L'alphabet écarte tout
ce qui se lit mal à l'oral (`0/O`, `1/I/L`, `2/Z`, `5/S`, `8/B`) : un code se
dicte au téléphone, il doit survivre au trajet. Il expire au bout de 15 minutes.

Le salon **survit à la partie**. Il ne se ferme que de trois façons : l'hôte
revient au pont, sa connexion tombe, ou le délai expire. N'importe lequel des deux
joueurs peut relancer — le salon appartient à l'hôte, mais la partie appartient
aux deux.

Un lien web partageable ouvre le jeu directement sur le code.

---

## 13. Le mode hors ligne

Le jeu tourne **entièrement sur le téléphone** quand le serveur est injoignable :
moteur, adversaire artificiel, règles, tout. L'application ne montre jamais
d'écran d'erreur ; elle entre, grise les deux boutons qui demandent quelqu'un en
face, et dit « sans réseau ».

### L'anti-triche

Le serveur distribue à l'avance des **jetons** — un identifiant et une **graine**.
Le téléphone joue avec cette graine, journalise chaque coup, et le serveur
**rejoue le journal** au retour du réseau : mêmes dés, mêmes règles, même score.
Un journal qui diverge est refusé.

L'ordre de consommation du hasard est donc un **contrat** entre les deux moteurs :
les quarts d'abord, puis un tirage par dé, dans l'ordre du journal. Un tirage
ajouté d'un seul côté — pour une animation, pour choisir une réplique — ferait
rejeter toutes les parties honnêtes. C'est pourquoi le bavardage hors ligne tire
avec `Math.random`, jamais avec la graine.

**On peut jouer sans jeton** : la partie se joue à l'identique, mais elle ne peut
pas être créditée, et la carte de fin le dit. Le jeton ne sert pas à jouer, il
sert à **prouver**.

Plafond : **20 parties hors ligne créditées par jour**, lots de **10 jetons**.

---

## 14. L'adversaire artificiel

Trois niveaux. Le plus fort explore l'arbre des coups ; les autres jouent une
cervelle gloutonne, avec une part de bévue volontaire — sans elle, un niveau
« normal » joue déjà trop juste pour rester agréable.

Elle joue les effets, avec un **budget** par partie : une IA qui dépenserait ses
trois effets à chaque fois ne serait plus une adversaire, ce serait un mur. Elle
joue aussi le trait de son capitaine — y compris les deux qui ne lui rapportent
rien (la longue-vue, qu'elle n'a pas besoin de lire ; le sablier, qu'elle n'a pas
de pendule à presser). C'est le seul moment où le joueur d'en face découvre ces
traits en les subissant.

---

## 15. Le bavardage

Trois canaux, et ils ne disent pas la même chose :

- **l'humeur** — cinq emojis, envoyés en restant appuyé sur son portrait ;
- **la pique** — déclenchée par un événement (bordée, dé emporté, retour en tête),
  choisie **par le serveur** pour que les deux écrans voient la même phrase ;
- **l'annonce d'effet** — la réplique du capitaine, avec l'icône de l'effet en
  tête de phrase.

Personne ne parle deux fois en moins de 2,6 secondes. Toutes les situations ne
méritent pas qu'on l'ouvre : une bordée, oui, à chaque fois ; un dé emporté, une
fois sur trois.

---

## 16. Architecture

```
téléphone (Capacitor WebView)          serveur (Node)
─────────────────────────────          ──────────────────────────
www/js/pages/dice*.js                  src/gateway.js    protocole WebSocket
  dice.js        la coquille           src/game/match.js une table
  dice_match.js  l'arène               src/game/rules.js les règles
  dice_lobby.js  le pont, les salons   src/game/bonus.js les onze effets
  dice_horsligne.js  le moteur local   src/game/captains.js
  dice_replay.js la rediffusion        src/game/ai.js    l'adversaire
                                       src/game/succes.js les compteurs
                                       src/game/horsligne.js le vérificateur
                                       src/store.js      Postgres
```

**Le serveur fait autorité sur tout ce qui compte** : les dés, les règles, les
scores, les seuils, l'inventaire, le classement. Le client dessine et demande.

**Trois moteurs doivent rester d'accord** : celui du serveur, celui du téléphone
(hors ligne) et le vérificateur. Un test de contrat les fait jouer l'un contre
l'autre.

---

## 17. Les invariants — ce qu'on ne casse pas

1. **Le client ne décide de rien.** Un écran grisé se contourne en deux lignes,
   une route non.
2. **Un compte ne s'affronte pas lui-même.** Les deux sièges sont crédités à la
   fin : ce serait doubler tous ses compteurs avec une victoire garantie.
3. **Deux tables ne se mélangent jamais.** Rien dans le moteur ne pourrait
   rattraper des dés envoyés au mauvais duel.
4. **L'ordre de consommation du hasard ne change pas** sans changer les deux
   moteurs *et* le vérificateur ensemble.
5. **Aucune partie ne peut se bloquer.** Un joueur doit toujours avoir un coup
   légal — c'est pourquoi on ne gèle ni une colonne pleine, ni la dernière
   colonne jouable.
6. **Un bouton qui ne peut rien faire le dit AVANT qu'on appuie**, et il reste
   vivant : sur un téléphone il n'y a pas de survol, donc pas d'infobulle. Un
   bouton mort ne dit ni son nom ni son motif.
7. **On ne promet jamais une récompense qu'on ne peut pas tenir.**
8. **Rien ne se compte sur une partie qu'on n'a pas jouée.**

---

## 18. Ce qui existe mais reste fragile

À l'attention de qui reprendra ce document :

- **`settleMatch` n'est couvert qu'en partie.** C'est la transaction qui écrit
  tout à la fin d'une partie. Un bug y a déjà tout emporté en silence — pas de
  pièces, pas d'Elo, pas de hauts faits — pendant que la suite de tests restait
  verte, parce qu'aucun test ne la touchait.
- **La rediffusion** rejoue les onze effets depuis peu ; les parties archivées
  avant ce changement n'ont pas été revérifiées.
- **Le SDK Facebook** est encore embarqué sans être utilisé.
- **L'identifiant App Store** du jeu n'est pas dans le dépôt : la page de rebond
  des invitations pointe vers une recherche.
