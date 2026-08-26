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
     ⚠️ ON AFFICHAIT LE NOM DE L'OBJET EN BOUTIQUE, ET CA NE VOULAIT RIEN DIRE
     EN PARTIE. « Geler l'adversaire » sous le portrait de Molly, c'est une
     etiquette de catalogue collee sur un coup de theatre — et d'un effet a
     l'autre on passait d'une phrase a la premiere personne a une phrase a la
     troisieme, sans logique apparente.
     C'est le CAPITAINE qui parle desormais, a la premiere personne, avec son
     caractere : Mary Read commande, Barbe-Noire menace, Ching Shih compte,
     Grace O'Malley invoque la mer, Calico Jack se moque. Trente repliques par
     langue, et le nom de l'objet reste le repli si l'une venait a manquer. */
  'say.read.B001': 'Bad roll. Again.',
  'say.read.B002': 'That square is useless now. Clear it.',
  'say.read.B003': 'That die was in the way. It isn\'t now.',
  'say.read.B004': 'I read your next move before you do.',
  'say.read.B005': 'This column is mine. Hold it.',
  'say.read.B006': 'Do not move. That\'s an order.',
  'say.teach.B001': 'Fate insulted me. Let it try again.',
  'say.teach.B002': 'I burn my own square. So what?',
  'say.teach.B003': 'Your die saw my beard. It did not survive.',
  'say.teach.B004': 'I see through your hand like an empty bottle.',
  'say.teach.B005': 'This column bears my name. Come closer.',
  'say.teach.B006': 'Don\'t move, or I\'ll freeze you to the bone!',
  'say.ching.B001': 'A badly placed die is a die you roll again.',
  'say.ching.B002': 'I withdraw that piece. The sums change.',
  'say.ching.B003': 'Your die was too expensive. I settled it.',
  'say.ching.B004': 'Your fleet has no secrets from mine.',
  'say.ching.B005': 'This column will pay a tribute of fifteen percent.',
  'say.ching.B006': 'Stay where you are. Your turn is not coming.',
  'say.omalley.B001': 'The sea owes me a better one. Roll again.',
  'say.omalley.B002': 'Making room. The tide will handle it.',
  'say.omalley.B003': 'Your die went overboard.',
  'say.omalley.B004': 'From my masthead I can see your hand.',
  'say.omalley.B005': 'Let this column be blessed, and let it pay.',
  'say.omalley.B006': 'The ice closes in. Stay in port.',
  'say.jack.B001': 'Didn\'t fancy that one. Next!',
  'say.jack.B002': 'Wiping that. Nobody saw a thing, right?',
  'say.jack.B003': 'You didn\'t need that one, hahaha!',
  'say.jack.B004': 'Had a peek. You\'re going to hate it.',
  'say.jack.B005': 'That column? It\'s lucky. Like me.',
  'say.jack.B006': 'Don\'t move, darling. Take a turn off!',
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
