/* ============================================================================
   core/dom.js — la version mobile.

   Le jeu (js/pages/dice*.js) est le MEME fichier que dans le tool : il est copie
   tel quel par build.py. Pour que ses imports relatifs tombent juste, l'app
   redonne ici les quelques fonctions du tool qu'il utilise — et rien d'autre.
   ============================================================================ */

export const $ = (s) => document.querySelector(s);

export const esc = (s) => (s == null ? '' : String(s))
  .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
