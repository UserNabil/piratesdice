/* Le francais. Les cles absentes retombent sur l'anglais : mieux vaut un mot
   anglais qu'un trou dans l'ecran. */
export const FR = {
  'app.title': 'The Pirate’s Dice',

  'menu.friend': 'Jouer avec un ami',

  'cap.choose': 'Choisissez votre capitaine',
  'cap.read.name': 'Mary Read',
  'cap.read.trait': 'Une relance gratuite par partie.',
  'cap.teach.name': 'Barbe-Noire',
  'cap.teach.trait': 'Une fois par partie, son adversaire saute son prochain tour.',
  'cap.ching.name': 'Ching Shih',
  'cap.ching.trait': 'Un regard par partie sur le dé que son adversaire va lancer.',
  'cap.omalley.name': 'Grace O’Malley',
  'cap.omalley.trait': 'Une colonne bénie par partie : elle rapporte 15 % de plus.',
  'cap.jack.name': 'Calico Jack',
  'cap.jack.trait': 'Commence la partie avec un dé déjà posé.',
  'cap.trait.reroll': 'Relance gratuite',
  'cap.trait.headstart': 'Un dé déjà en place',

  'fx.broadside': 'Bordée ! {n} dés',
  'fx.foeTrait': '{name} : {trait}',
  'fx.next': 'prochain',
  'fx.bonusYou': 'Vous jouez',
  'shop.B004.name': 'Longue-vue',
  'shop.B004.desc': 'Voir le dé que l’adversaire s’apprête à lancer.',
  'shop.B005.name': 'Colonne bénie',
  'shop.B005.desc': 'Une de vos colonnes rapporte 15 % de plus jusqu’à la fin.',
  'fx.boost': 'Colonne bénie : +15 % jusqu’à la fin',
  'resume.done': 'Partie reprise — on vous attendait.',
  'game.paused': 'En attente de l’autre joueur…',

  'mood.hint': 'Reste appuyé sur ton portrait pour parler',

  'taunt.broadside.0': 'Par-dessus bord, matelot !',
  'taunt.broadside.1': "Deux d'un coup. J'arrête ?",
  'taunt.broadside.2': 'Voilà comment on fait.',
  'taunt.broadside.3': 'Ton pont se vide.',

  'taunt.sting.0': 'Un de moins pour toi.',
  'taunt.sting.1': 'Oups.',
  'taunt.sting.2': 'Il me fallait la place.',
  'taunt.sting.3': 'Rien de personnel.',

  'taunt.blast.0': 'Feu !',
  'taunt.blast.1': 'Un cadeau, de ma cale.',
  'taunt.blast.2': "Tu étais trop à l'aise.",
  'taunt.blast.3': 'Pièces bien dépensées.',

  'taunt.lead.0': 'Repassé devant.',
  'taunt.lead.1': "C'était ton meilleur ?",
  'taunt.lead.2': 'La marée tourne.',
  'taunt.lead.3': 'Suis le rythme, capitaine.',
  'bonus.free': 'offert',

  'room.title': 'Jouer avec un ami',
  'room.hint': 'Entrez le code que votre ami vous a donné.',
  'room.placeholder': 'CODE',
  'room.join': 'Rejoindre',
  'room.or': 'ou',
  'room.create': 'Ouvrir une table',
  'room.waiting': 'On attend votre ami',
  'room.share': 'Donnez ce code à votre ami — la partie démarre dès qu’il l’entre.',
  'room.expires': 'Le code expire au bout de quinze minutes.',
  'room.copied': 'Code copié',
  'room.badCode': 'Un code fait cinq lettres ou chiffres',
  'room.unknown': 'Aucune table à ce code',
  'room.gone': 'Votre ami a quitté la table',
  'room.own': 'C’est votre propre table',

  'hdr.mute': 'Couper le son',
  'hdr.unmute': 'Remettre le son',
  'hdr.roll': 'Lancer le dé',
  'hdr.settings': 'Réglages',
  'hdr.coins': 'Pièces',
  'hdr.record': '{rating} elo · {wins}V {losses}D {draws}N',

  'tab.shop': 'Boutique',
  'tab.ranking': 'Classement',
  'tab.rules': 'Règles',

  'connect.boarding': 'On monte à bord…',
  'connect.outOfReach': 'Le serveur du jeu est injoignable',
  'connect.dropped': 'La liaison avec le serveur s’est interrompue.',
  'connect.tried': 'Essayé {url}',
  'connect.retryingIn': 'Nouvelle tentative dans {n} s…',
  'connect.retry': 'Réessayer',

  /* ⚠️ CE TITRE PROMETTAIT LA MISE, RETIREE DU JEU. « Jouez la bourse du
     capitaine » sur l'ecran d'accueil, c'etait annoncer un pari qui n'existe
     plus — et c'est exactement la formulation qu'Apple lit comme du jeu
     d'argent. Le titre dit maintenant ce qu'on fait vraiment : un duel. */
  'menu.title': 'Le duel des capitaines',
  'menu.pitch': 'Quatre colonnes, douze dés. Un dé que vous posez détruit tous les dés '
    + 'adverses de même valeur dans la même colonne. Le plus haut total gagne quand un plateau est plein.',
  'menu.solo': 'Affronter l’IA',
  'menu.multi': 'Défier un joueur',
  'menu.matches': 'parties',
  'menu.elo': 'elo',
  'menu.coins': 'pièces',
  'menu.waiting': 'En attente d’un adversaire',
  'menu.noOne': 'Personne en vue',
  'menu.noOneHint': 'Aucun joueur ne cherche de partie en ce moment. Relancez la recherche, ou affrontez la machine en attendant.',
  'menu.retry': 'Relancer la recherche',
  'menu.waitingHint': 'Un autre capitaine doit ouvrir le jeu et choisir « Défier un joueur ».',
  'menu.cancel': 'Annuler',

  'game.yourTurn': 'À vous',
  'game.playing': '{name} joue…',
  'game.opponent': 'Adversaire',
  'game.placeStake': 'Posez votre mise',
  'game.matchOver': 'Partie terminée',
  'game.pickBlast': 'Choisissez un dé à détruire',
  /* Le bouton de lancer devient le bouton d'annulation pendant la visee : un
     effet arme par erreur n'a plus a coûter le tour entier. */
  'game.cancelBonus': 'Annuler',
  'fx.alreadyFrozen': 'Son tour est déjà gelé',
  'game.leave': 'Quitter la partie',
  'game.leaveTitle': 'Abandonner la partie',
  'game.leaveConfirm': 'Partir maintenant, c’est perdre la partie et la mise. Quitter quand même ?',
  'game.leaveOk': 'Quitter',
  'game.rollFirst': 'lancez d’abord votre dé',
  'game.waitTurn': 'attendez votre tour',
  'game.waitingTable': 'On installe la table…',
  'game.pausedThem': '{name} a perdu la liaison — la table ferme dans {n} s',
  'game.pausedYou': 'Liaison perdue — on vous garde votre place',
  'game.alreadyRolled': 'dé déjà lancé — choisissez une colonne',
  'game.yourScore': 'votre score',
  'game.theirScore': 'son score',
  'game.stake': 'mise {n}',
  'game.ai': 'IA',

  'bonus.head': 'Bonus',
  'bonus.left': 'encore {n} cette partie',
  'bonus.spent': 'déjà joué cette partie',
  'bonus.empty': 'Aucun bonus en cale — il y en a à la boutique.',

  'bet.title': 'Fixez votre mise',
  'bet.hint': 'Gagner rend la mise et une bourse en plus. Perdre la fait disparaître.',
  'bet.of': 'sur {n}',
  'bet.none': 'Sans mise',
  'bet.all': 'Tout miser',
  'bet.lock': 'Bloquer la mise',
  'bet.waiting': 'On attend votre adversaire…',

  'over.victory': 'Victoire',
  'over.defeat': 'Défaite',
  'over.draw': 'Match nul',
  'over.against': 'contre {name}',
  'over.notRated': 'Les parties solo ne comptent pas au classement',
  'over.notRatedNew': 'Adversaire non classé — Elo inchangé',
  'over.notRatedGap': 'Écart de niveau trop grand — Elo inchangé',
  'over.notRatedPair': 'Trop de parties avec le même adversaire — Elo inchangé',
  'over.notRatedShort': 'Partie trop courte — Elo inchangé',
  'over.elo': 'Elo {before} → {after} ({delta})',
  'over.coins': 'Pièces {delta}',
  'over.oppDropped': 'Votre adversaire a quitté',
  'over.someoneLeft': 'Quelqu’un a quitté la table',
  'over.again': 'Rejouer',
  'over.back': 'Retour au pont',

  'shop.title': 'Le fournisseur du bord',

  'shop.rayon.des': 'Jeux de dés',

  'shop.S002.name': 'Dés d’or',

  'shop.S002.desc': 'Frappés dans l’or ; les points s’embrasent sur une paire. Apparence seulement.',

  'shop.S006.name': 'Dés du sultan',

  'shop.S006.desc': 'Or ciselé et lapis. Apparence seulement.',

  'shop.S008.name': 'Dés cramoisis',

  'shop.S008.desc': 'Laque écarlate, braises dans les points. Apparence seulement.',

  'shop.S009.name': 'Dés de cendre',

  'shop.S009.desc': 'Ivoire et suie, points de pierre polie. Apparence seulement.',

  'shop.S010.name': 'Dés d’améthyste',

  'shop.S010.desc': 'Améthyste taillée sur ivoire. Apparence seulement.',

  'shop.M001.name': 'Gravure du dragon',

  'shop.M001.desc': 'Un dragon des mers enroulé autour de la face. Apparence seulement.',

  'shop.M002.name': 'Gravure du kraken',

  'shop.M002.desc': 'Tentacules et bulles en travers de la face. Apparence seulement.',

  'shop.M003.name': 'Gravure des os',

  'shop.M003.desc': 'Crâne et tibias, usés sur le bord. Apparence seulement.',

  'shop.M004.name': 'Gravure des joyaux',

  'shop.M004.desc': 'Pierres taillées et étoile de compas. Apparence seulement.',

  'shop.rayon.motifs': 'Gravures',

  'shop.rayon.bonus': 'Effets',
  'shop.opening': 'On ouvre les caisses…',
  'shop.owned': 'en cale : {n}',
  'shop.bought': 'acheté — c’est dans votre cale',
  'shop.B001.name': 'Relancer le dé',

  /* ── CE QUE CHAQUE CAPITAINE DIT EN JOUANT UN EFFET ──────────────────────
     ⚠️ TROIS VARIANTES, ET ELLES PARLENT A L'ADVERSAIRE.
     Une replique unique par effet se relit trois fois par partie et cesse
     d'etre lue a la quatrieme ; trois se relaient sans qu'on les voie tourner.
     Et elles s'adressent a l'AUTRE, pas a soi : « je bénis ma colonne » est une
     note de service, « cette colonne est tenue, essaie de la prendre » est du
     jeu. Meme les effets qu'on se lance a soi-meme se disent a la figure d'en
     face — c'est ce qui fait un duel plutot qu'un tableur.
     La variante est choisie par un compte partage entre les deux ecrans (voir
     `annonceBonus` dans pages/dice_fx.js) : les deux joueurs lisent la meme. */
  'say.read.B001.0': 'Ce tirage ne me convient pas. Regarde bien le suivant.',
  'say.read.B001.1': 'Je reprends. Tu ne gagneras pas sur une erreur de dé.',
  'say.read.B001.2': 'Annulé. Le prochain sera pour toi.',
  'say.read.B002.0': 'Je dégage cette case. Tu croyais avoir compris mon plan ?',
  'say.read.B002.1': 'Je réorganise ma ligne. Suis, si tu peux.',
  'say.read.B002.2': 'Une case de moins chez moi, et tout ton calcul est faux.',
  'say.read.B003.0': 'Ton dé gênait ma ligne de mire. Plus maintenant.',
  'say.read.B003.1': 'Retire ça. Tu n\'en avais pas l\'usage.',
  'say.read.B003.2': 'Un dé de moins dans tes rangs. Continue.',
  'say.read.B004.0': 'Je vois ton prochain dé avant toi. Joue quand même.',
  'say.read.B004.1': 'Ta main est ouverte devant moi, capitaine.',
  'say.read.B004.2': 'Ce que tu vas tirer, je le sais déjà.',
  'say.read.B005.0': 'Cette colonne est tenue. Essaie de la prendre.',
  'say.read.B005.1': 'Je fortifie ici. Tu perdras du monde à passer.',
  'say.read.B005.2': 'Cette colonne rapporte plus, maintenant. À toi de suivre.',
  'say.read.B006.0': 'Ne bouge plus. C\'est un ordre, pas une proposition.',
  'say.read.B006.1': 'Ton tour est suspendu. Attends la suite.',
  'say.read.B006.2': 'Reste où tu es. Je n\'ai pas fini.',
  'say.teach.B001.0': 'Le sort m\'a insulté. Tu vas voir sa réponse.',
  'say.teach.B001.1': 'Je relance, et cette fois c\'est toi qui paieras.',
  'say.teach.B001.2': 'Ce dé ne me plaisait pas. À moi de choisir.',
  'say.teach.B002.0': 'Je brûle ma propre case. Tu n\'oserais pas.',
  'say.teach.B002.1': 'Je fais le vide chez moi. Devine pour qui.',
  'say.teach.B002.2': 'Une case rasée. La tienne suivra.',
  'say.teach.B003.0': 'Ton dé a vu ma barbe. Il n\'a pas survécu.',
  'say.teach.B003.1': 'J\'ai pris ce dé. Viens le réclamer.',
  'say.teach.B003.2': 'Voilà ce qu\'il reste de ton coup, moussaillon.',
  'say.teach.B004.0': 'Je lis dans ta main comme dans une bouteille vide.',
  'say.teach.B004.1': 'Ton prochain dé n\'a plus de secret. Ni toi.',
  'say.teach.B004.2': 'Je sais ce qui t\'attend. Tu vas détester.',
  'say.teach.B005.0': 'Cette colonne porte mon nom. Approche pour voir.',
  'say.teach.B005.1': 'Je la bénis. Tu n\'y toucheras pas.',
  'say.teach.B005.2': 'Quinze pour cent de plus, et c\'est encore trop peu pour toi.',
  'say.teach.B006.0': 'Ne bouge plus ou je te gèle jusqu\'aux os !',
  'say.teach.B006.1': 'Ton tour m\'appartient. Regarde-moi le prendre.',
  'say.teach.B006.2': 'Les glaces t\'ont pris. Respire, si tu peux encore.',
  'say.ching.B001.0': 'Un dé mal placé se relance. Note-le, ça te servira.',
  'say.ching.B001.1': 'Je corrige. Tu apprendras à faire pareil.',
  'say.ching.B001.2': 'Ce tirage était une perte. Je ne les garde pas.',
  'say.ching.B002.0': 'Je retire cette pièce. Ton calcul vient de changer.',
  'say.ching.B002.1': 'Une case libérée vaut mieux qu\'une case perdue. Retiens.',
  'say.ching.B002.2': 'Je réécris ma colonne. Refais tes comptes.',
  'say.ching.B003.0': 'Ton dé coûtait trop cher. Je l\'ai réglé.',
  'say.ching.B003.1': 'Cette pièce est saisie. La flotte remercie.',
  'say.ching.B003.2': 'J\'ai supprimé la ligne la plus chère de ton livre.',
  'say.ching.B004.0': 'Ta flotte n\'a plus de secrets pour la mienne.',
  'say.ching.B004.1': 'Je connais ton prochain dé. Le prix de l\'information.',
  'say.ching.B004.2': 'J\'ai ouvert ton registre. Il est mince.',
  'say.ching.B005.0': 'Cette colonne paiera un tribut de quinze pour cent.',
  'say.ching.B005.1': 'J\'investis ici. Tu verras le rendement.',
  'say.ching.B005.2': 'Colonne bénie. Compare, si tu as le temps.',
  'say.ching.B006.0': 'Reste où tu es. Ton tour ne viendra pas.',
  'say.ching.B006.1': 'J\'achète ton tour. Le prix était bas.',
  'say.ching.B006.2': 'Une saison sans vent pour toi. Patiente.',
  'say.omalley.B001.0': 'La mer m\'en doit un meilleur. Elle va me le rendre.',
  'say.omalley.B001.1': 'Je relance. Le vent tourne, et pas pour toi.',
  'say.omalley.B001.2': 'Ce dé retourne à l\'eau. Regarde ce qui remonte.',
  'say.omalley.B002.0': 'Je fais de la place. La marée s\'en occupe.',
  'say.omalley.B002.1': 'Je vide cette case. Mon pont sera plus propre que le tien.',
  'say.omalley.B002.2': 'Une case rendue à la mer. Elle me la rendra mieux.',
  'say.omalley.B003.0': 'Ton dé est passé par-dessus bord. Salue-le.',
  'say.omalley.B003.1': 'La mer a pris ce qui trainait chez toi.',
  'say.omalley.B003.2': 'Un homme à la mer, capitaine. C\'était ton dé.',
  'say.omalley.B004.0': 'Du haut de mon mât, je vois ton jeu.',
  'say.omalley.B004.1': 'Ton prochain dé, je l\'ai déjà repéré à l\'horizon.',
  'say.omalley.B004.2': 'Ma vigie t\'a vu venir. Avance quand même.',
  'say.omalley.B005.0': 'Que cette colonne soit bénie, et qu\'elle te coûte.',
  'say.omalley.B005.1': 'J\'appelle la marée sur cette colonne. Tiens bon.',
  'say.omalley.B005.2': 'Bénie. Elle portera plus loin que la tienne.',
  'say.omalley.B006.0': 'Les glaces se referment. Reste au port.',
  'say.omalley.B006.1': 'Pas de vent pour toi ce tour-ci. Attends.',
  'say.omalley.B006.2': 'Ta coque est prise. Le temps passera sans toi.',
  'say.jack.B001.0': 'Ce dé ne me plaisait pas. Tu permets ? Merci.',
  'say.jack.B001.1': 'Je relance ! Non, tu ne peux pas faire pareil.',
  'say.jack.B001.2': 'Hop, un autre. C\'est fou ce que ça soulage.',
  'say.jack.B002.0': 'J\'efface. Personne n\'a rien vu, hein ?',
  'say.jack.B002.1': 'Je range ma case. Chez toi c\'est le bazar, remarque.',
  'say.jack.B002.2': 'Petite retouche. Ne t\'inquiète pas pour moi.',
  'say.jack.B003.0': 'Tu n\'avais pas besoin de celui-là, hahaha !',
  'say.jack.B003.1': 'Oups. Il a glissé. Enfin, je l\'ai poussé.',
  'say.jack.B003.2': 'Ce dé te faisait de l\'ombre. Je t\'ai rendu service.',
  'say.jack.B004.0': 'J\'ai jeté un oeil. Tu vas détester, crois-moi.',
  'say.jack.B004.1': 'Je sais ce que tu vas tirer. Non, je ne dirai rien.',
  'say.jack.B004.2': 'Ton prochain dé ? Disons que j\'ai de la peine pour toi.',
  'say.jack.B005.0': 'Cette colonne-là ? Elle est chanceuse. Comme moi.',
  'say.jack.B005.1': 'Je bénis celle-ci. Tu peux essayer, ça marche pas pour tout le monde.',
  'say.jack.B005.2': 'Colonne porte-bonheur. Le mien, pas le tien.',
  'say.jack.B006.0': 'Bouge pas, mon joli. Prends donc un tour de repos !',
  'say.jack.B006.1': 'Chut. Ton tour fait la sieste, laisse-le dormir.',
  'say.jack.B006.2': 'Gelé ! Ne me remercie pas, c\'était offert.',

  'shop.B001.desc': 'Relancez votre dé — la valeur dont vous ne vouliez pas disparaît.',
  'shop.B002.name': 'Vider une de mes cases',
  'shop.B002.desc': 'Retirez un de vos dés pour refaire une colonne.',
  'shop.B003.name': 'Détruire un dé adverse',
  'shop.B003.desc': 'Retirez un dé du plateau de votre adversaire.',

  'ladder.title': 'Classement des capitaines',
  'ladder.reading': 'On lit le livre de bord…',
  'ladder.empty': 'Personne n’a encore fini une partie.',
  'ladder.captain': 'Capitaine',
  'ladder.elo': 'Elo',
  'ladder.w': 'V',
  'ladder.l': 'D',
  'ladder.d': 'N',

  'rules.title': 'Les règles de la table',
  'rules.1': 'À votre tour, lancez le dé, puis posez-le dans une de vos quatre colonnes.',
  'rules.2': 'Une colonne vaut <b>valeur × occurrences²</b> : trois 4 dans une colonne valent 36, pas 12.',
  'rules.3': 'Poser un dé <b>détruit tous les dés adverses de cette valeur dans la même colonne</b> — '
    + 'gêner l’autre rapporte plus que construire.',
  'rules.4': 'La partie s’arrête dès qu’un plateau est plein. Le plus haut total gagne.',
  'rules.5': 'Les bonus s’achètent à la boutique et vous en avez droit à <b>{n}</b> par partie : '
    + 'relancer le dé, vider une de vos cases, ou détruire un dé adverse.',
  'rules.6': 'Une partie contre la machine rapporte {ia} pièces ; une partie qui vous fait MONTER au classement en rapporte {rang}. '
    + 'Seules les parties entre joueurs bougent votre Elo, et seulement face à un adversaire classé, de niveau proche.',
  'rules.7': 'Votre <b>capitaine</b> change votre façon de jouer — une relance offerte, une ouverture qui emporte la valeur au-dessus, un œil sur le prochain dé, des triples plus riches, ou un dé déjà posé. Choisissez le vôtre sur le pont.',
  'rules.shortcuts': 'Raccourcis : {space} lance, {one} {two} {three} posent dans une colonne, {esc} ferme.',

  /* ⚠️ CES DEUX PHRASES DECRIVAIENT L'ANCIENNE REGLE. L'IA jouait le tour de
     l'absent — et lui offrait donc le meilleur coup. Le tour SAUTE desormais :
     dire le contraire a l'ecran serait pire que de ne rien dire, puisqu'on
     chercherait un dé qui n'a jamais ete pose. */
  'away.taken': '{name} n’a pas joué à temps — son tour a sauté',
  'away.you': 'Trop tard — votre tour a sauté',

  'set.title': 'Réglages',
  'set.sound': 'Son',
  'set.soundOn': 'Activé',
  'set.soundOff': 'Coupé',
  'set.account': 'Compte',
  'set.signedInAs': 'Connecté en tant que {name}',
  /* ⚠️ LE LIBELLE COMPLET TIENT DANS `title`, PAS SUR LE BOUTON. « Se
     connecter avec Google » et « Effacer mes donnees et mon compte » se
     repliaient sur trois lignes dans deux boutons cote a cote — retour de
     l'admin. Le logo dit deja de qui il s'agit, et la corbeille ce qu'elle
     fait : le mot n'a plus qu'a confirmer. */
  'set.signInShort': 'Connexion',
  'set.signOutShort': 'Déconnexion',
  'set.eraseShort': 'Supprimer',
  'set.signIn': 'Se connecter avec Google',
  'set.signOut': 'Se déconnecter',
  'set.erase': 'Effacer mes données et mon compte',
  'set.eraseAsk': 'Cela efface définitivement votre capitaine, vos pièces et votre classement. Continuer ?',
  'set.eraseOk': 'Tout effacer',
  'set.erased': 'Compte effacé.',
  'set.language': 'Langue',
  'set.terms': 'Conditions d’utilisation et confidentialité',
  'set.close': 'Fermer',
  'set.notInMatch': 'Impossible en pleine partie : changer de compte referme la table et coûte la mise.',
  'set.guest': 'Invité (ce téléphone)',

  /* Ces sept-la manquaient : la fiche du serveur injoignable et les
     infobulles de l'entete. Une cle absente retombe SILENCIEUSEMENT sur
     l'anglais — le joueur ne voit pas un defaut, il voit une autre langue. */
  'hdr.close': 'Fermer (Échap)',
  'hdr.full': 'Plein écran',
  'hdr.exitFull': 'Quitter le plein écran',
  'connect.viaSsh': ' (par le tunnel SSH du tool)',
  'connect.noSsh': ' — et le tunnel SSH n’a pas pu s’ouvrir non plus',
  'connect.fixTool': 'Relancez-le avec {cmd} ({logs} lit son journal).',
  'connect.fixSsh': 'Hors du réseau du bureau, le jeu emprunte le tunnel SSH du tool : vérifiez que la machine répond.',
  'skin.appearance': 'Apparence seulement — aucun effet sur le jeu',
  'skin.owned': 'En cale',
  'skin.wear': 'Équiper',
  'skin.remove': 'Déséquiper',

  /* Les refus que le serveur formule en anglais. Sans ces cles, le joueur
     lisait « not enough coins » au milieu de sa partie. */
  'err.refused': 'Le serveur a refusé',
  'err.coins': 'Vous n’avez pas assez de pièces pour cette mise',
  'err.betClosed': 'Les mises sont closes',
  'err.betDone': 'Votre mise est déjà posée',
  'err.betWhole': 'Une mise se compte en pièces entières',
  'err.notStarted': 'La partie n’a pas commencé',
  'err.noMatch': 'Vous n’êtes dans aucune partie',
  'err.inMatch': 'Vous êtes déjà en partie',
  'err.captainLocked': 'On ne change pas de capitaine en pleine partie',
  'shop.shutTitle': 'Les caisses sont fermées pendant une partie',
  'shop.shutHint': 'Votre mise est engagée : l’or reste bloqué jusqu’au verdict. Revenez à la fin de la partie.',
  'shop.B006.name': 'Geler l’adversaire',
  'shop.B006.desc': 'Votre adversaire saute son prochain tour. Vous jouez deux fois de suite.',
  'fx.freeze': 'Tour gelé !',
  /* Le givre reste sur le plateau tant que le gel dure : chaque camp a besoin
     de sa phrase, celle qui subit et celle qui l'a jetee. */
  'fx.frozenWait': 'Son tour est gelé',
  'fx.frozenYou': 'Votre tour est gelé',
  'fx.frozenThem': '{name} passe son tour — gelé',
  'cap.trait.freeze': 'Un tour gelé',
  'foot.bag': 'Inventaire',
  'foot.roll': 'Lancer',
  'foot.leave': 'Quitter',
  'foot.back': 'Le pont',
};
