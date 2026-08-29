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
  'set.fx': 'Effects',
  'set.music': 'Music',
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

  /* ⛔ LES QUATRE-VINGT-DIX REPLIQUES DE CAPITAINE ONT ETE RETIREES D'ICI.
     Elles existaient DEUX FOIS — dans i18n_en.js et dans ce bloc — et
     `Object.assign({}, EN, EN_APP)` donne le dernier mot a celui-ci. Les trois
     lignes de Barbe-Noire reecrites pour le gel de COLONNE etaient donc
     ignorees : l'anglais continuait d'annoncer un tour vole, pour un effet qui
     n'en vole plus. Une seule copie, et le probleme ne peut plus revenir.
     Ce bloc ne garde que ce qui n'existe QUE dans l'application. */
  'game.waitingTable': 'Setting the table…',
  'game.pausedThem': '{name} lost the connection — the table closes in {n}s',
  'game.pausedYou': 'Connection lost — your seat is being held',

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
