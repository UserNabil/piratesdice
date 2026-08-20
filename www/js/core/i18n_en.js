/* ============================================================================
   core/i18n_en.js — le catalogue ANGLAIS du jeu de des, source unique.

   Le tool ne parle qu'anglais ; l'application Android parle quatre langues. Pour
   qu'il n'existe pas deux jeux, les fichiers de `pages/dice*.js` appellent tous
   `t('cle')`, et ce catalogue est copie tel quel dans l'application (build.py).
   Les autres langues vivent a cote de lui, cote mobile.

   Les valeurs peuvent porter des reperes {ainsi} : ils sont remplaces a l'appel.
   ============================================================================ */

export const EN = {
  'app.title': "The Pirate's Dice",

  'hdr.mute': 'Mute the sound',
  'hdr.unmute': 'Unmute the sound',
  'hdr.full': 'Full screen',
  'hdr.exitFull': 'Leave full screen',
  'hdr.close': 'Close (Esc)',
  'hdr.roll': 'Roll the die (Space)',
  'hdr.settings': 'Settings',
  'hdr.coins': 'Coins',
  'hdr.record': '{rating} elo · {wins}W {losses}L {draws}D',

  'tab.shop': 'Shop',
  'tab.ranking': 'Ranking',
  'tab.rules': 'Rules',

  'connect.boarding': 'Boarding the ship…',
  'connect.outOfReach': 'The game server is out of reach',
  'connect.tried': 'Tried {url}',
  'connect.viaSsh': ' (through the tool’s SSH tunnel)',
  'connect.noSsh': ' — and the SSH tunnel could not be opened either',
  'connect.fixTool': 'Deploy or restart it with {cmd} ({logs} reads its journal).',
  'connect.fixSsh': 'Off the office network the game rides the tool’s SSH connection: check Settings → server SSH.',
  'connect.retry': 'Try again',

  'menu.title': "Roll for the captain's purse",
  'menu.pitch': 'Three columns, nine dice. A die you place destroys every enemy die of the '
    + 'same value in the same column. Highest total when a board fills up wins.',
  'menu.solo': 'Challenge the AI',
  'menu.multi': 'Challenge a player',
  'menu.matches': 'matches',
  'menu.elo': 'elo',
  'menu.coins': 'coins',
  'menu.waiting': 'Waiting for a challenger',
  'menu.waitingHint': 'Another captain has to open the game and pick “Challenge a player”.',
  'menu.cancel': 'Cancel',

  'game.yourTurn': 'Your turn',
  'game.playing': '{name} is playing…',
  'game.opponent': 'Opponent',
  'game.placeStake': 'Place your stake',
  'game.matchOver': 'Match over',
  'game.pickBlast': 'Pick a die to blast',
  'game.leave': 'Leave the match',
  'game.leaveTitle': 'Abandon the match',
  'game.leaveConfirm': 'Leaving now forfeits the match — your stake is lost. Leave anyway?',
  'game.leaveOk': 'Leave',
  'game.rollFirst': 'roll your die first',
  'game.waitTurn': 'wait for your turn',
  'game.alreadyRolled': 'you already rolled — pick a column',
  'game.yourScore': 'your score',
  'game.theirScore': 'their score',
  'game.stake': 'stake {n}',
  'game.ai': 'AI',

  'bonus.head': 'Bonus',
  'bonus.left': '{n} left this match',
  'bonus.empty': 'No bonus in the hold — buy some in the Shop.',

  'bet.title': 'Set your stake',
  'bet.hint': 'Win and you take the stake back plus a purse. Lose and it is gone.',
  'bet.of': 'of {n}',
  'bet.lock': 'Lock the stake',
  'bet.waiting': 'Waiting for your opponent…',

  'over.victory': 'Victory',
  'over.defeat': 'Defeat',
  'over.draw': 'Draw',
  'over.against': 'against {name}',
  'over.notRated': 'Solo matches are not rated',
  'over.elo': 'Elo {before} → {after} ({delta})',
  'over.coins': 'Coins {delta}',
  'over.oppDropped': 'Your opponent dropped',
  'over.someoneLeft': 'Someone left the table',
  'over.again': 'Play again',
  'over.back': 'Back to the deck',

  'shop.title': "Ship's chandler",
  'shop.opening': 'Opening the crates…',
  'shop.owned': 'owned: {n}',
  'shop.bought': 'bought — it is in your hold',

  'ladder.title': "Captains' ladder",
  'ladder.reading': 'Reading the log book…',
  'ladder.empty': 'Nobody has finished a match yet.',
  'ladder.captain': 'Captain',
  'ladder.elo': 'Elo',
  'ladder.w': 'W',
  'ladder.l': 'L',
  'ladder.d': 'D',

  'rules.title': 'The rules of the table',
  'rules.1': 'On your turn, roll the die, then drop it into one of your three columns.',
  'rules.2': 'A column scores <b>value × count²</b>: three 4s in one column are worth 48, not 12.',
  'rules.3': 'Dropping a die <b>destroys every enemy die of that value in the same column</b> — '
    + 'denying your opponent matters more than building.',
  'rules.4': 'The match ends the moment one board is full. Highest total wins.',
  'rules.5': 'Bonuses are bought in the Shop and you may use <b>{n}</b> per match: reroll the die, '
    + 'clear one of your own dice, or blast an enemy one.',
  'rules.6': 'Winning pays your stake back plus {n} coins; losing costs the stake. '
    + 'Only player-versus-player matches move your Elo.',
  'rules.shortcuts': 'Shortcuts: {space} rolls, {one} {two} {three} drop into a column, {esc} closes.',

  'away.taken': '{name} was away — the ship’s AI played that turn',
  'away.you': 'You were away: the AI played for you',

  'motion.on': 'Motion controls on: shake to roll, tilt to place',
  'motion.off': 'Motion controls off',
};
