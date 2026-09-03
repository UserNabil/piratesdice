/* ============================================================================
   ui/tour.js — LE TUTORIEL EST UNE VRAIE PARTIE, PAS UNE VISITE GUIDEE.

   ⛔ ON N'EXPLIQUE PLUS DES BOUTONS, ON FAIT JOUER. « Un tutoriel sur une fausse
   partie a l'arrivee pour expliquer comment le jeu se joue, sans expliquer a
   quoi servent les boutons. » Au premier lancement, on demarre une partie
   contre l'IA et on accompagne les trois gestes qui font le jeu : lancer le de,
   le poser dans une colonne, jouer un bonus. Chaque etape AVANCE QUAND LE
   JOUEUR L'A FAIT — ce n'est pas un diaporama, c'est un coach.

   ⚠️ IL NE BLOQUE JAMAIS RIEN. Le voile laisse passer les clics (pointer-events
   none) : le joueur touche les VRAIS boutons a travers lui. On observe l'etat
   du jeu (`UI.snapshotJeu`) et on parle ; on ne s'interpose pas. « Il peut
   quitter le tuto et jouer sans forcement terminer. » Un bouton « passer » et la
   touche Echap le referment a tout instant, la partie continue.

   ⚠️ AUCUNE BIBLIOTHEQUE EXTERNE : l'application joue hors ligne et n'ouvre
   aucun lien. Cent lignes qu'on possede valent mieux qu'un CDN interdit.

   ⚠️ UNE SEULE FOIS. Un drapeau (`pd.tuto`) dit qu'on l'a vu — passe ou fini,
   on ne le rejoue pas tout seul.
   ============================================================================ */

import { t } from '../core/i18n.js';
import { UI } from '../pages/dice_state.js';

const CLE_VU = 'pd.tuto';

/* Les etapes : une cible a eclairer, une phrase, et la CONDITION qui la termine
   — lue dans l'instantane du jeu. `atteint(av, ap)` compare avant/apres. */
const ETAPES = [
  { cible: '#dc-cup', cle: 'lancer',
    atteint: (a, b) => (a.de === null || a.de === undefined) && b.de !== null && b.de !== undefined },
  /* ⛔ MON PLATEAU, PAS CELUI D'EN FACE. Le plateau adverse porte `.dc-board-top`
     (il est empile a l'envers) ; le mien ne l'a pas. `:last-child` tombait sur
     le mauvais — il eclairait la grille de l'adversaire. */
  { cible: '#dicewrap .dc-board:not(.dc-board-top)', cle: 'poser',
    atteint: (a, b) => b.poses > a.poses },
  /* ⛔ OUVRIR LE SAC SUFFIT A AVANCER. Attendre qu'un bonus soit VRAIMENT joue
     laissait le tuto bloque : le joueur ouvrait l'inventaire et rien ne suivait,
     parce qu'un bonus peut ne pas etre jouable a cet instant. On montre le sac,
     et des qu'il s'ouvre (le barillet apparait) — ou qu'un bonus part — on passe
     a la fin. Le joueur termine sa partie a son rythme. */
  { cible: '#dc-bag', cle: 'bonus',
    atteint: (a, b) => b.bonus > a.bonus,
    domFait: () => !!document.querySelector('#dc-bonus.dc-bonus-open') },
];

export function tutorielDejaVu() {
  try { return localStorage.getItem(CLE_VU) === '1'; } catch (_) { return false; }
}
function marquerVu() {
  try { localStorage.setItem(CLE_VU, '1'); } catch (_) { /* stockage plein : tant pis */ }
}

export function lancerTutoriel(force) {
  if (!force && tutorielDejaVu()) return;
  if (document.querySelector('.pd-tour')) return;
  marquerVu();                                   // vu = vu, on ne harcele pas

  /* On demarre la partie d'entrainement. Si le crochet manque (vieille coque),
     on ne fait rien plutot que de planter. */
  if (UI && typeof UI.jouerSolo === 'function') UI.jouerSolo();
  /* ⛔ LA PENDULE SE GELE PENDANT LE TUTORIEL. On la relance a la fermeture —
     passe, fini, Echap : tous passent par `fermer()`. */
  if (UI && typeof UI.pauseTimer === 'function') UI.pauseTimer(true);

  const hote = document.getElementById('dicewrap') || document.body;
  const voile = document.createElement('div');
  voile.className = 'pd-tour';
  voile.innerHTML = `
    <div class="pd-tour-trou" data-trou hidden></div>
    <div class="pd-tour-bulle" data-bulle role="dialog" aria-live="polite">
      <p data-texte></p>
      <div class="pd-tour-pieds">
        <button class="pd-tour-passer" data-passer></button>
        <span class="pd-tour-pas" data-pas></span>
      </div>
    </div>`;
  hote.appendChild(voile);
  const trou = voile.querySelector('[data-trou]');
  const bulle = voile.querySelector('[data-bulle]');
  const texte = voile.querySelector('[data-texte]');
  const pas = voile.querySelector('[data-pas]');
  voile.querySelector('[data-passer]').textContent = t('tour.passer');
  voile.querySelector('[data-passer]').onclick = () => fermer();

  let i = -1;
  let avant = snap();
  let minuterie = 0;

  function snap() {
    try { return (UI && UI.snapshotJeu) ? UI.snapshotJeu() : { phase: null }; }
    catch (_) { return { phase: null }; }
  }

  function eclairer(sel) {
    const el = sel && document.querySelector(sel);
    if (!el) { trou.hidden = true; return; }
    const r = el.getBoundingClientRect();
    const m = 8;
    trou.hidden = false;
    trou.style.left = (r.left - m) + 'px';
    trou.style.top = (r.top - m) + 'px';
    trou.style.width = (r.width + m * 2) + 'px';
    trou.style.height = (r.height + m * 2) + 'px';
  }

  function poserBulle(sel) {
    const el = sel && document.querySelector(sel);
    const r = el ? el.getBoundingClientRect() : { left: window.innerWidth / 2, right: window.innerWidth / 2, top: window.innerHeight / 2, bottom: window.innerHeight / 2, width: 0, height: 0 };
    bulle.style.left = Math.max(10, Math.min(
      window.innerWidth - bulle.offsetWidth - 10,
      (r.left + r.right) / 2 - bulle.offsetWidth / 2)) + 'px';
    /* Au-dessus de la cible si elle est dans la moitie basse, en dessous sinon. */
    const basEcran = r.top > window.innerHeight * 0.5;
    bulle.style.top = basEcran
      ? Math.max(10, r.top - bulle.offsetHeight - 14) + 'px'
      : (r.bottom + 14) + 'px';
  }

  function montrer(idx) {
    i = idx;
    if (i >= ETAPES.length) { fini(); return; }
    const e = ETAPES[i];
    texte.textContent = t('tour.' + e.cle);
    pas.textContent = (i + 1) + ' / ' + ETAPES.length;
    avant = snap();
    replacer();
  }
  function replacer() {
    if (i < 0 || i >= ETAPES.length) return;
    eclairer(ETAPES[i].cible);
    poserBulle(ETAPES[i].cible);
  }

  function fini() {
    trou.hidden = true;
    texte.textContent = t('tour.fini');
    pas.textContent = '';
    bulle.style.left = Math.max(10, (window.innerWidth - bulle.offsetWidth) / 2) + 'px';
    bulle.style.top = Math.max(10, window.innerHeight * 0.5 - bulle.offsetHeight) + 'px';
    setTimeout(fermer, 2600);                     // on s'efface, le joueur continue
  }

  function tic() {
    const ap = snap();
    if (i < 0) {
      /* On attend que la partie soit prete avant la premiere consigne. */
      if (ap.phase === 'playing') montrer(0);
      return;
    }
    if (i >= ETAPES.length) return;
    replacer();                                   // la mise en page bouge : on suit
    const e = ETAPES[i];
    if (ap.over) { fermer(); return; }            // partie finie pendant le tuto
    if (e.atteint(avant, ap) || (e.domFait && e.domFait())) { montrer(i + 1); return; }
    /* On ne fige pas `avant` sur le de : une fois lance il reste non nul, donc
       la comparaison tient. Pour « poser » et « bonus », on garde la reference
       du debut de l'etape (posee dans `montrer`). */
  }

  function fermer() {
    if (UI && typeof UI.pauseTimer === 'function') UI.pauseTimer(false);
    if (minuterie) { clearInterval(minuterie); minuterie = 0; }
    window.removeEventListener('resize', replacer);
    document.removeEventListener('keydown', surTouche, true);
    voile.remove();
  }
  function surTouche(ev) {
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); fermer(); }
  }

  window.addEventListener('resize', replacer);
  document.addEventListener('keydown', surTouche, true);
  minuterie = setInterval(tic, 350);
  /* Premiere consigne au centre le temps que la table arrive. */
  texte.textContent = t('tour.demarre');
  pas.textContent = '';
  bulle.style.left = Math.max(10, (window.innerWidth - 300) / 2) + 'px';
  bulle.style.top = (window.innerHeight * 0.5) + 'px';
}
