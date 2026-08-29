/* ============================================================================
   pages/dice_refus.js — CE QUE LE SERVEUR REFUSE, DIT DANS LA LANGUE DU JOUEUR.

   ⛔ CE FICHIER EXISTE POUR NE PAS FAIRE TOURNER DEUX MODULES EN ROND. La table
   vivait dans dice.js, et la boutique — qui refuse par HTTP, pas par la socket —
   en avait besoin : dice_panels.js aurait importe dice.js, qui importe deja
   dice_panels.js. Les modules supportent le cercle, mais un cercle est une
   dette qu'on rembourse au premier refactoring. Une table de traduction ne
   depend de rien : elle merite son fichier.

   ⚠️ ET ELLE SERT LES DEUX CHEMINS. Les refus de la socket et ceux des routes
   HTTP viennent du MEME serveur, dans la meme langue : les traduire a deux
   endroits, c'est en oublier un — c'est exactement ce qui etait arrive aux
   messages de la boutique, qui sortaient en anglais dans un jeu en francais.
   ============================================================================ */

import { t } from '../core/i18n.js';

/* Les refus que le serveur formule en anglais, dits dans la langue du joueur.
   Un message inconnu passe tel quel : mieux vaut une phrase anglaise qu'un
   silence, et sa presence signale la cle qui manque. */
const REFUS = {
  /* ⛔ TROIS REFUS DE MISE ONT DISPARU AVEC LA MISE. « betting is closed »,
     « your bet is already placed » et « enter a whole number of coins » ne
     peuvent plus etre emis : le message reseau `bet` n'existe plus. Une
     traduction qui attend un message impossible ne sert qu'a faire croire que
     le mecanisme est encore la. « not enough coins » reste : la boutique, elle,
     refuse toujours un achat trop cher. */
  'not enough coins': 'err.coins',
  'not your turn': 'game.waitTurn',
  'you already rolled': 'game.alreadyRolled',
  'the match has not started': 'err.notStarted',
  'you are not in a match': 'err.noMatch',
  'you are already in a match': 'err.inMatch',
  'you cannot change captain during a match': 'err.captainLocked',
  /* ⚠️ DEUX REFUS DIFFERENTS, DEUX PHRASES DIFFERENTES. « pas pendant une
     partie » et « pas encore gagne » n'appellent ni la meme reaction ni la meme
     patience : les confondre sous un seul mot ferait croire au joueur qu'il
     suffit d'attendre la fin du duel pour porter Grace O'Malley. */
  'captain locked': 'err.captainSeuil',
  /* ⛔ DOUZE REFUS NEUFS SORTAIENT EN ANGLAIS BRUT. Les six effets ajoutes avec
     les nouveaux capitaines refusent chacun pour des raisons qui leur sont
     propres — une colonne deja gelee, une case sans vis-a-vis, une colonne
     pleine — et aucune de ces phrases n'etait dans cette table. Un joueur
     francophone lisait « one of their columns is already frozen » au milieu de
     son jeu. C'est exactement le defaut que ce fichier existe pour empecher. */
  'one of their columns is already frozen': 'err.colGelee',
  'their next turn is already skipped': 'err.tourVole',
  'your turn is already stretched': 'err.tourRallonge',
  'there is no clock on this table': 'err.pasDePendule',
  'no die of yours faces one of theirs': 'err.pasDeVisAVis',
  'no enemy die faces that one': 'err.caseSansVisAVis',
  'both boards are empty': 'err.deuxPlateauxVides',
  'that column is empty on both boards': 'err.colonneVideDesDeux',
  'one of their columns is already cursed': 'err.colMaudite',
  'that column is already full': 'err.colPleine',
  'that is their last playable column': 'err.derniereColonne',
  'this column is frozen': 'err.colGeleeIci',
  'effect locked': 'err.effetFerme',
  'your friend has left': 'room.amiParti',
  'the room is gone': 'room.salonFerme',
  /* ⚠️ LES REFUS DE LA BOUTIQUE PASSENT PAR HTTP, PAS PAR LA SOCKET — et ils
     arrivaient donc en anglais brut au milieu d'un jeu en francais, en espagnol
     ou en arabe. Cette table sert les deux chemins : c'est le meme serveur qui
     parle, il n'y a aucune raison de le traduire deux fois. */
  'not enough cursed coins': 'err.maudits',
  'this item is not sold for coins': 'err.pasEnOr',
  'this item is not sold for cursed coins': 'err.pasEnMaudit',
  'the shop is closed during a match': 'err.boutiqueFermee',
  'unknown item': 'err.articleInconnu',
};

export function messageServeur(brut) {
  if (!brut) return t('err.refused');
  const cle = REFUS[brut];
  return cle ? t(cle) : brut;
}
