# The Pirate's Dice — Capitaines, règles et systèmes de jeu

> Document de référence complet, destiné à être donné tel quel à une IA pour
> concevoir de **nouveaux capitaines et leurs bonus**. Tout ce qui suit est
> extrait du code du jeu en production (2026-09-05).

---

## 1. Le jeu en une page

Duel de dés en 1 contre 1 (contre l'IA ou un autre joueur). Chaque joueur a un
**plateau de 4 colonnes × 3 cases** (12 cases). À ton tour : tu **lances un
dé**, puis tu le **poses** dans une de tes colonnes non pleines.

- **Score d'une colonne = valeur × (occurrences)²** — trois 4 dans une colonne
  valent 4×3² = 36, pas 12. Empiler la même valeur paie très fort.
- **Poser un dé détruit tous les dés adverses de la même valeur dans la
  colonne d'en face** (la colonne entière, pas une case). Construire est bien,
  démolir l'adversaire est mieux.
- **Multiplicateurs de quart** : au début de chaque partie, les 4 colonnes
  reçoivent (dans un ordre aléatoire) les multiplicateurs **×1,3 / ×1 / ×0,8 /
  ×0,5**, identiques pour les deux joueurs, visibles dès le départ.
- **Fin de partie** : dès qu'un plateau est plein. Le plus haut total gagne.
- Une partie dure 2 à 3 minutes. Chaque tour a une **mèche** (compte à
  rebours ~15 s) : passé le délai, l'IA joue le coup à ta place.

## 2. L'économie

- **Pièces d'or** (monnaie de base) : gagnées en jouant (victoire contre l'IA,
  montée au classement), dépensées en boutique (effets, parures de dés).
- **Pièces maudites** (monnaie rare) : gagnées par les hauts faits et le butin
  quotidien, servent aux achats prestigieux.
- **Effets (bonus)** : s'achètent en boutique, se consomment en partie.
  **Maximum 3 effets joués par partie et par joueur.** Un effet se débloque à
  l'achat au même seuil de parties que le capitaine qui le porte.
- L'IA achète et joue aussi ses propres effets (budget par partie).

## 3. Les 15 capitaines actuels

Chaque capitaine **offre gratuitement son effet une fois par partie** (le trait).
Ils se débloquent au fil des **parties terminées** (seuil), ou en complétant un
palier de la campagne (15 étoiles).

| # | ID | Nom | Titre | Trait (1×/partie) | Effet lié | Seuil |
|---|----|-----|-------|-------------------|-----------|-------|
| 1 | read | **Mary Read** | La corsaire insaisissable | Une relance gratuite | B001 | 0 (offerte) |
| 2 | jack | **Calico Jack** | Le pavillon qu'on reconnaît | Commence avec un dé déjà posé | — (headstart) | 25 |
| 3 | ching | **Ching Shih** | L'amirale aux six cents jonques | Bordée : rase deux colonnes face à face (la sienne et celle d'en face) | B010 | 100 |
| 4 | teach | **Barbe-Noire** | La barbe qui fume | Gèle une colonne adverse pendant son prochain tour | B006 | 150 |
| 5 | omalley | **Grace O'Malley** | La reine des mers d'Irlande | Colonne bénie : +15 % jusqu'à la fin | B005 | 250 |
| 6 | bonny | **Anne Bonny** | Celle qu'on n'a jamais pendue | Le prochain tour adverse est 2× plus court | B008 | 350 |
| 7 | bart | **Black Bart** | Le plus grand tableau de chasse | Troc : échange son dé et celui d'en face, même case (en ligne seulement) | B009 | 400 |
| 8 | lionne | **La Lionne Sanglante** | L'œil qui voit venir | Longue-vue : voit le prochain dé adverse | B004 | 450 |
| 9 | morgan | **Henry Morgan** | Le pirate qu'on a anobli | Tour volé : l'adversaire saute son prochain tour | B007 | 500 |
| 10 | levasseur | **Olivier Levasseur** | La Buse, et son énigme | Colonne maudite : −15 % jusqu'à la fin | B011 | 550 |
| 11 | kidd | **Captain Kidd** | Le corsaire pendu | Dé pipé : décale son lancer de ±1 (jamais 1↔6) | B012 | 600 |
| 12 | wangzhi | **Wang Zhi** | Le marchand de fumée | Brouillard : le prochain dé adverse ne détruit rien | B013 | 650 |
| 13 | levent | **Anne Levent** | La danseuse de pont | Manœuvre : déplace le dé supérieur d'une colonne vers une autre | B014 | 700 |
| 14 | caesar | **Black Caesar** | La coque inbrisable | Coque : protège un dé jusqu'à la fin du prochain tour adverse | B015 | 750 |
| 15 | sayyida | **Sayyida al-Hurra** | La dame des marées | Change deux multiplicateurs de colonne, pour les deux joueurs, jusqu'à la fin | B016 | 800 |

## 4. Les 16 effets existants (le catalogue complet)

| ID | Nom | Description exacte | Cible | Notes moteur |
|----|-----|--------------------|-------|--------------|
| B001 | Relancer le dé | Relancez votre dé — la valeur dont vous ne vouliez pas disparaît. | soi | après le lancer, avant la pose |
| B002 | Vider une de mes cases | Retirez un de vos dés pour refaire une colonne. | soi (case) | ne crédite aucune « destruction » |
| B003 | Détruire un dé adverse | Retirez un dé du plateau de votre adversaire. | adversaire (case) | la coque (B015) peut le bloquer |
| B004 | Longue-vue | Voir le dé que l'adversaire s'apprête à lancer. | info | interdit hors ligne (casserait l'ordre du tirage vérifié) |
| B005 | Colonne bénie | Une de vos colonnes rapporte 15 % de plus jusqu'à la fin. | soi (colonne) | cumule avec le quart |
| B006 | Colonne gelée | Une colonne adverse est prise dans les glaces pendant son prochain tour. | adversaire (colonne) | l'IA sait éviter sa colonne gelée |
| B007 | Tour volé | Votre adversaire saute son prochain tour. Vous jouez deux fois de suite. | adversaire | |
| B008 | Sablier fêlé | Le prochain tour de votre adversaire dure deux fois moins longtemps. | adversaire | agit sur la mèche |
| B009 | Troc de dés | Votre dé et celui d'en face, sur la même case, échangent leurs places. | case miroir | **en ligne seulement** ; l'échange est « inerte » (ne déclenche pas de destruction) |
| B010 | Bordée sur la colonne | Emporte deux colonnes face à face : la vôtre et celle de l'ennemi. | colonne (les 2 camps) | épargne le dé sous coque ADVERSE, jamais le sien |
| B011 | Colonne maudite | Une colonne adverse rapporte 15 % de moins jusqu'à la fin. | adversaire (colonne) | miroir de B005 |
| B012 | Dé pipé | Après votre lancer, décalez le dé d'un cran, en plus ou en moins. Jamais de 1 à 6. | soi | après le lancer |
| B013 | Brouillard de poudre | Le prochain dé adverse marque normalement, mais ne détruit aucun de vos dés. | soi (plateau) | protection d'UN coup |
| B014 | Manœuvre de pont | Déplacez le dé supérieur d'une de vos colonnes vers une autre non pleine. | soi | la pose déplacée PEUT détruire en face |
| B015 | Coque renforcée | Protège un de vos dés jusqu'à la fin du prochain tour adverse. | soi (case) | consommée quand elle épargne |
| B016 | Changement de quart | Échange deux multiplicateurs de colonne, pour les deux joueurs, jusqu'à la fin. | plateau entier | symétrique, affecte les 2 joueurs |

**Grammaire des cibles disponible dans le moteur** : une case à soi, une case
adverse, une case miroir (même position des deux côtés), une colonne à soi, une
colonne adverse, les deux colonnes face à face, le plateau entier, le dé qu'on
vient de lancer, le prochain dé adverse, la mèche du tour, les multiplicateurs.

## 5. Contraintes NON NÉGOCIABLES pour tout nouveau bonus

1. **Quatre moteurs identiques** : chaque effet est implémenté 4 fois à
   l'identique (serveur autorité, vérificateur hors ligne, rejoueur de
   rediffusions, client). Un effet doit être **déterministe et rejouable**
   depuis un journal de coups.
2. **Pas de hasard propre** : le moteur hors ligne consomme un flux de hasard
   scellé (graine serveur). Un effet qui **tire au sort** est interdit hors
   ligne (comme B004 qui y est déjà interdit) ou doit tirer dans le flux commun.
3. **Maximum 3 effets par partie** — un effet trop fort à 3 exemplaires casse
   l'équilibre. Penser à l'IA : elle achète et joue les effets aussi.
4. **Anti-triche** : le client ne décide de rien ; toute cible passe par le
   serveur qui revalide (case existante, colonne non vide, etc.).
5. **Lisibilité** : chaque effet a un dessin de trait, un nom court, une
   phrase de description, et un retour visuel en partie (voile sur case/colonne,
   annonce). Prévoir les 4 langues (fr/en/es/ar).
6. **Un capitaine = un effet**, offert 1×/partie, et le même effet achetable
   en boutique (débloqué au seuil du capitaine).

## 6. Les autres systèmes (contexte utile)

- **La Piraterie (campagne)** : 14 paliers, 5 niveaux chacun (4 sbires + 1
  boss = le capitaine du palier, avec sa parure de dés thématique). Chaque
  niveau a 3 missions/étoiles : gagner + 2 contraintes (score minimal, détruire
  N dés, perdre au plus 10 dés, triple, escalier 1-2-3, colonne triée, sans six,
  colonne ×1,3 meilleure, poser dans les 4 colonnes en un tour de pont, sans
  effet, etc.). 15 étoiles = capitaine du palier débloqué.
- **IA à 3 niveaux** (novice/normal/fort) tirés au sort en partie libre, fixés
  par niveau en campagne — profondeur de recherche et taux d'erreur réels.
- **Hauts faits** : ~200 succès (or + maudites + parfois un objet). Les
  gravures de dés légendaires ne s'achètent pas, elles se gagnent.
- **Butin quotidien** : cycle de 7 jours (or, maudites, parure au 7ᵉ).
- **Boutique** : effets, parures de dés (11 en vente), gravures (4 achetables,
  12 légendaires).
- **Multijoueur** : file d'attente + salon privé par code 5 lettres, classement
  Elo. Les hauts faits ne se gagnent que contre des humains.
- **Hors ligne** : parties contre l'IA de poche, vérifiées et payées par le
  serveur au retour (jetons à graine scellée, plafond journalier).

## 7. La commande

> **Propose 5 nouveaux capitaines, chacun avec son bonus** (nom d'effet,
> description d'une phrase, cible dans la grammaire ci-dessus, coût pressenti
> or/maudit), en respectant les contraintes de la section 5. Les thèmes
> pirates historiques ou légendaires non encore utilisés sont bienvenus
> (les 15 pris : Mary Read, Calico Jack, Ching Shih, Barbe-Noire, Grace
> O'Malley, Anne Bonny, Black Bart, La Lionne Sanglante, Henry Morgan, Olivier
> Levasseur, Captain Kidd, Wang Zhi, Anne Levent, Black Caesar, Sayyida
> al-Hurra). Éviter tout doublon fonctionnel avec B001–B016.
