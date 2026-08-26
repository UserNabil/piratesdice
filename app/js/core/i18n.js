/* ============================================================================
   core/i18n.js — la traduction, cote APPLICATION.

   Le tool fournit un module homonyme qui ne rend que l'anglais ; ici le meme
   `t()` connait quatre langues. C'est ce qui permet au jeu (pages/dice*.js)
   d'etre le MEME fichier des deux cotes.

   L'arabe entraine `dir="rtl"` sur la page : toute l'interface s'inverse d'un
   coup, a condition que le CSS parle en proprietes logiques la ou le sens
   compte. C'est le seul endroit qui decide du sens de lecture.
   ============================================================================ */

import { EN } from './i18n_en.js';
import { FR } from './i18n_fr.js';
import { ES } from './i18n_es.js';
import { AR } from './i18n_ar.js';

/* Les textes qui n'existent QUE dans l'application : le catalogue partage ne les
   connait pas, puisque le tool n'a ni reglages mobiles ni compte Google. */
const EN_APP = {
  'set.title': 'Settings',
  'set.sound': 'Sound',
  'set.soundOn': 'On',
  'set.soundOff': 'Muted',
  'set.account': 'Account',
  'set.signedInAs': 'Signed in as {name}',
  'set.signInShort': 'Sign in',
  'set.signOutShort': 'Sign out',
  'set.eraseShort': 'Delete',
  'set.signIn': 'Sign in with Google',
  'set.signOut': 'Sign out',
  'set.erase': 'Erase my data and account',
  'set.eraseAsk': 'This permanently erases your captain, your coins and your ranking. Continue?',
  'set.eraseOk': 'Erase everything',
  'set.erased': 'Account erased.',
  'set.language': 'Language',
  'set.terms': 'Terms of use and privacy',
  'set.close': 'Close',

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
  'say.read.B001.0': 'This roll doesn\'t suit me. Watch the next one.',
  'say.read.B001.1': 'I\'ll take that back. You won\'t win on a bad die.',
  'say.read.B001.2': 'Cancelled. The next one is for you.',
  'say.read.B002.0': 'Clearing that square. Thought you had me figured out?',
  'say.read.B002.1': 'Rearranging my line. Keep up, if you can.',
  'say.read.B002.2': 'One square fewer here, and all your maths is wrong.',
  'say.read.B003.0': 'Your die was in my line of fire. Not any more.',
  'say.read.B003.1': 'Take that away. You had no use for it.',
  'say.read.B003.2': 'One die fewer in your ranks. Carry on.',
  'say.read.B004.0': 'I see your next die before you do. Play anyway.',
  'say.read.B004.1': 'Your hand is open in front of me, captain.',
  'say.read.B004.2': 'What you\'re about to roll, I already know.',
  'say.read.B005.0': 'This column is held. Try taking it.',
  'say.read.B005.1': 'Fortifying here. You\'ll lose people getting through.',
  'say.read.B005.2': 'This column pays more now. Your move.',
  'say.read.B006.0': 'Do not move. That\'s an order, not an offer.',
  'say.read.B006.1': 'Your turn is suspended. Wait for the rest.',
  'say.read.B006.2': 'Stay where you are. I\'m not finished.',
  'say.teach.B001.0': 'Fate insulted me. You\'re about to see its answer.',
  'say.teach.B001.1': 'I roll again, and this time you\'ll pay for it.',
  'say.teach.B001.2': 'I didn\'t like that die. My choice now.',
  'say.teach.B002.0': 'I burn my own square. You wouldn\'t dare.',
  'say.teach.B002.1': 'Clearing house. Guess who\'s next.',
  'say.teach.B002.2': 'One square razed. Yours will follow.',
  'say.teach.B003.0': 'Your die saw my beard. It did not survive.',
  'say.teach.B003.1': 'I took that die. Come and claim it.',
  'say.teach.B003.2': 'That\'s what\'s left of your move, deckhand.',
  'say.teach.B004.0': 'I read your hand like an empty bottle.',
  'say.teach.B004.1': 'Your next die holds no secret. Nor do you.',
  'say.teach.B004.2': 'I know what\'s coming for you. You\'ll hate it.',
  'say.teach.B005.0': 'This column bears my name. Come closer and look.',
  'say.teach.B005.1': 'I bless it. You will not touch it.',
  'say.teach.B005.2': 'Fifteen percent more, and still too much for you.',
  'say.teach.B006.0': 'Don\'t move, or I\'ll freeze you to the bone!',
  'say.teach.B006.1': 'Your turn belongs to me. Watch me take it.',
  'say.teach.B006.2': 'The ice has you. Breathe, if you still can.',
  'say.ching.B001.0': 'A badly placed die gets rolled again. Note that down.',
  'say.ching.B001.1': 'Correcting. You\'ll learn to do the same.',
  'say.ching.B001.2': 'That roll was a loss. I don\'t keep those.',
  'say.ching.B002.0': 'I withdraw that piece. Your sums just changed.',
  'say.ching.B002.1': 'A freed square beats a wasted one. Remember it.',
  'say.ching.B002.2': 'I\'m rewriting my column. Do your accounts again.',
  'say.ching.B003.0': 'Your die was too expensive. I settled it.',
  'say.ching.B003.1': 'That piece is seized. The fleet thanks you.',
  'say.ching.B003.2': 'I struck out the costliest line in your ledger.',
  'say.ching.B004.0': 'Your fleet has no secrets from mine.',
  'say.ching.B004.1': 'I know your next die. The price of information.',
  'say.ching.B004.2': 'I opened your ledger. It is thin.',
  'say.ching.B005.0': 'This column will pay a tribute of fifteen percent.',
  'say.ching.B005.1': 'I\'m investing here. You\'ll see the return.',
  'say.ching.B005.2': 'Column blessed. Compare, if you have the time.',
  'say.ching.B006.0': 'Stay where you are. Your turn is not coming.',
  'say.ching.B006.1': 'I\'m buying your turn. The price was low.',
  'say.ching.B006.2': 'A windless season for you. Be patient.',
  'say.omalley.B001.0': 'The sea owes me a better one. It will pay up.',
  'say.omalley.B001.1': 'Rolling again. The wind turns, and not for you.',
  'say.omalley.B001.2': 'That die goes back in the water. Watch what surfaces.',
  'say.omalley.B002.0': 'Making room. The tide will handle it.',
  'say.omalley.B002.1': 'Clearing that square. My deck will be cleaner than yours.',
  'say.omalley.B002.2': 'A square given back to the sea. She\'ll return it better.',
  'say.omalley.B003.0': 'Your die went overboard. Wave goodbye.',
  'say.omalley.B003.1': 'The sea took what was lying about on your side.',
  'say.omalley.B003.2': 'Man overboard, captain. It was your die.',
  'say.omalley.B004.0': 'From my masthead I can see your game.',
  'say.omalley.B004.1': 'Your next die — I spotted it on the horizon already.',
  'say.omalley.B004.2': 'My lookout saw you coming. Sail on anyway.',
  'say.omalley.B005.0': 'Let this column be blessed, and let it cost you.',
  'say.omalley.B005.1': 'I call the tide on this column. Hold fast.',
  'say.omalley.B005.2': 'Blessed. It will carry further than yours.',
  'say.omalley.B006.0': 'The ice closes in. Stay in port.',
  'say.omalley.B006.1': 'No wind for you this turn. Wait.',
  'say.omalley.B006.2': 'Your hull is caught. Time will pass without you.',
  'say.jack.B001.0': 'Didn\'t fancy that one. You don\'t mind? Lovely.',
  'say.jack.B001.1': 'Rolling again! No, you can\'t do the same.',
  'say.jack.B001.2': 'There we go, another one. Such a relief.',
  'say.jack.B002.0': 'Wiping that. Nobody saw a thing, right?',
  'say.jack.B002.1': 'Tidying my square. Yours is a mess, mind you.',
  'say.jack.B002.2': 'Small touch-up. Don\'t worry about me.',
  'say.jack.B003.0': 'You didn\'t need that one, hahaha!',
  'say.jack.B003.1': 'Oops. It slipped. Well — I pushed it.',
  'say.jack.B003.2': 'That die was casting a shadow on you. My pleasure.',
  'say.jack.B004.0': 'Had a peek. You\'re going to hate it, trust me.',
  'say.jack.B004.1': 'I know what you\'ll roll. No, I shan\'t tell.',
  'say.jack.B004.2': 'Your next die? Let\'s say I feel for you.',
  'say.jack.B005.0': 'That column? It\'s lucky. Like me.',
  'say.jack.B005.1': 'Blessing this one. You can try, it doesn\'t work for everyone.',
  'say.jack.B005.2': 'Lucky column. Mine, not yours.',
  'say.jack.B006.0': 'Don\'t move, darling. Take a turn off!',
  'say.jack.B006.1': 'Shh. Your turn\'s having a nap, let it sleep.',
  'say.jack.B006.2': 'Frozen! Don\'t thank me, it was on the house.',
  'game.waitingTable': 'Setting the table…',

  'set.notInMatch': 'Not during a match: changing account closes the table and costs your stake.',
  'set.guest': 'Guest (this phone)',
};

export const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'ar', label: 'العربية' },
];

const TABLES = { en: {}, fr: FR, es: ES, ar: AR };
const BASE = Object.assign({}, EN, EN_APP);
const RTL = new Set(['ar']);
const KEY = 'pd.lang';
const HOLE = /\{(\w+)\}/g;

let current = 'en';

function detect() {
  const saved = (localStorage.getItem(KEY) || '').trim();
  if (TABLES[saved]) return saved;
  const wanted = (navigator.languages || [navigator.language || 'en'])
    .map((l) => String(l).slice(0, 2).toLowerCase());
  for (const code of wanted) if (TABLES[code]) return code;
  return 'en';
}

/** Traduit une cle. Une langue incomplete retombe sur l'anglais, jamais sur un trou. */
export function t(key, vars) {
  const text = TABLES[current][key] !== undefined ? TABLES[current][key] : BASE[key];
  if (text === undefined) return key;
  if (!vars) return text;
  return text.replace(HOLE, (whole, name) => (vars[name] === undefined ? whole : String(vars[name])));
}

export function lang() { return current; }

export function isRTL() { return RTL.has(current); }

/** Pose la langue sur le document : c'est elle qui retourne l'interface. */
function stamp() {
  const root = document.documentElement;
  root.setAttribute('lang', current);
  root.setAttribute('dir', isRTL() ? 'rtl' : 'ltr');
}

export function setLang(code) {
  if (!TABLES[code]) return false;
  current = code;
  try { localStorage.setItem(KEY, code); } catch (_) { /* stockage refuse */ }
  stamp();
  return true;
}

export function initLang() {
  current = detect();
  stamp();
  return current;
}

initLang();
