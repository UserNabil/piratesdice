
dans la home page il faut toujours qu'un capitaine soit selectionné 

si un compte est supprimé durant une desinstallation il faut supprimer le compte ou le retirer du classement 

je veux une nouvelle disposition des boutons dans la home page comme je l'ai fait sur figma

j'ai remarqué que l'icone dans la page d'accueil pour mary read pour la relance du dés n'est pas la meme que l'icone dans le marquet il remplacer celle du market par celle qui dans la page home.

j'aimerais mettre en place une fiche si l'utilisateur click sur un capitaine pour dure lore du jeu avec un belle affichage et un peu d'histoire du personnage, qu'est ce qu'il offre comme bonus combien il reste pour le débloquer et si il est débloqué un bouton selectionner

j'aimerais que tu mettent en place l'infrastructure et les tests nécéssaire afin d'eviter :
Double requête : envoyer deux fois placeDice ou useBonus extrêmement rapidement.
Deux téléphones avec le même compte dans deux parties différentes.
Replay d'une ancienne commande WebSocket avec un ancien matchId/turnId.
Double settlement après reconnexion / timeout / abandon simultané.
Bot automatique qui joue légalement mais 24 h/24.
Replay d'un jeton hors ligne si les jetons ne sont pas strictement single-use et liés au compte.
Choix du meilleur jeton hors ligne si le client possède dix graines et peut décider laquelle utiliser.


5 nouveaux effets de jeu, il va falloir mettre en place une pagination en dot pour afficher les 5 suivants car on va ajouter au fur et a mesure des capitaines et effets :
ID proposé	Nom	Effet	Pirate
B012	🎲 Dé pipé	Après ton lancer, transforme ton dé en valeur +1 ou −1. Pas de 1→6 ni 6→1. Captain Kidd
B013	🌫️ Brouillard de poudre	Le prochain dé adverse peut être placé et scorer normalement, mais ne détruit aucun de tes dés.	Wang Zhi
B014	⚓ Manœuvre de pont	Déplace le dé supérieur d'une de tes colonnes vers une autre colonne non pleine. Aucune destruction n'est déclenchée par ce déplacement. Anne Levent	
B015	🛡️ Coque renforcée	Protège un de tes dés jusqu'à la fin du prochain tour adverse. S'il devait être détruit, il survit ; la protection disparaît.	Black Caesar
B016	🧭 Changement de quart	Échange les multiplicateurs de deux colonnes pour les deux joueurs jusqu'à la fin de la partie.	Sayyida al-Hurra

explication détaillés :
B012 — Dé pipé

C'est probablement celui que j'ajouterais en premier.

Tu tires 4 → tu peux obtenir 3 ou 5.

Cela permet de chercher un doublon, provoquer une destruction ou éviter une mauvaise valeur, mais sans permettre de choisir librement un 6.

Il est beaucoup plus tactique qu'une simple seconde Relance.

B013 — Brouillard de poudre

Très bon contre un adversaire qui attend précisément un 6 pour massacrer ton triple 6.

Il ne retire aucun tour et ne bloque aucune colonne.

Donc le joueur adverse continue réellement à jouer, ce qui respecte bien ta philosophie anti-frustration.

B014 — Manœuvre de pont

Exemple :

[4,4,2]

Tu déplaces le 2 vers une autre colonne.

La première colonne devient :

[4,4]

Tu peux ensuite espérer y placer un troisième 4.

Cela permet aussi de rouvrir une colonne quasiment pleine sans supprimer gratuitement un dé comme Nettoyage.

B015 — Coque renforcée

Très lisible visuellement : petit bouclier autour du dé.

Si l'adversaire attaque la colonne avec la bonne valeur, tous les dés normalement concernés disparaissent sauf le dé protégé.

Je limiterais la protection à un seul tour adverse, sinon protéger définitivement un membre d'un triple serait trop puissant.

B016 — Changement de quart

Celui-ci pourrait être particulièrement intéressant avec ton système de 1,3 / 1 / 0,8 / 0,5.

Par exemple :

colonne 0 = ×1,3
colonne 3 = ×0,5

L'effet les échange pour les deux joueurs.

Cela reste mathématiquement symétrique, mais devient stratégiquement asymétrique en fonction des dés déjà posés.

C'est suffisamment puissant pour devenir un effet de capitaine tardif.

tout ce qu'il te faut comme asset se trouve dans downloads/new_effect_pirates