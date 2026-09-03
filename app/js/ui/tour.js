/* ============================================================================
   ui/tour.js — LE TOUR DU PROPRIETAIRE, AU PREMIER LANCEMENT.

   ⛔ AUCUNE BIBLIOTHEQUE EXTERNE, ET C'EST UNE CONTRAINTE DU JEU. L'application
   ne charge rien depuis le reseau — elle doit jouer hors ligne, et ne jamais
   ouvrir de lien vers l'exterieur. Un guide comme Shepherd ou driver.js
   viendrait d'un CDN ou grossirait le paquet d'un module qu'on ne maitrise pas.
   Ce module fait le meme travail — un projecteur sur une cible, une bulle, un
   fil d'etapes — en cent lignes que l'on possede : theme du jeu compris, et le
   bouton « passer » a chaque instant.

   ⚠️ IL NE PARLE AUCUNE LANGUE. Comme tout le reste, les textes viennent des
   catalogues i18n (cles `tour.*`) ; ce fichier ne connait que des identifiants
   de cible et l'ordre des etapes.

   ⚠️ IL NE S'INVITE QU'UNE FOIS. Un drapeau dans le stockage local (`pd.tuto`)
   dit qu'on l'a deja vu — passe ou termine, c'est pareil : on ne le rejoue pas
   sans le demander. Les reglages porteront un bouton « revoir le tutoriel » qui
   le rappelle a la main.
   ============================================================================ */

import { t } from '../core/i18n.js';

const CLE_VU = 'pd.tuto';

/* Chaque etape vise un element par son id ou son selecteur, et pose sa bulle
   d'un cote. Une cible absente est SAUTEE, jamais bloquante : un ecran peut
   changer, le tutoriel ne doit pas s'echouer dessus. */
const ETAPES = [
  { cible: '#dc-solo', cle: 'solo', place: 'bas' },
  { cible: '#dc-campagne', cle: 'piraterie', place: 'bas' },
  { cible: '#dc-multi', cle: 'multi', place: 'haut' },
  { cible: '.dc-caps', cle: 'capitaines', place: 'haut' },
  { cible: '.dc-plaque-or', cle: 'bourse', place: 'bas' },
  { cible: '.dc-plaque-reglages', cle: 'reglages', place: 'bas' },
];

export function tutorielDejaVu() {
  try { return localStorage.getItem(CLE_VU) === '1'; } catch (_) { return false; }
}

function marquerVu() {
  try { localStorage.setItem(CLE_VU, '1'); } catch (_) { /* stockage plein : tant pis */ }
}

/** Lance le tour. `force` rejoue meme s'il a deja ete vu (bouton des reglages). */
export function lancerTutoriel(force) {
  if (!force && tutorielDejaVu()) return;
  if (document.querySelector('.pd-tour')) return;       // deja en cours

  const hote = document.getElementById('dicewrap') || document.body;
  const voile = document.createElement('div');
  voile.className = 'pd-tour';
  voile.innerHTML = `
    <div class="pd-tour-trou" data-trou></div>
    <div class="pd-tour-bulle" data-bulle role="dialog" aria-live="polite">
      <p data-texte></p>
      <div class="pd-tour-pieds">
        <button class="pd-tour-passer" data-passer></button>
        <span class="pd-tour-pas" data-pas></span>
        <button class="pd-tour-suivant dc-btn dc-btn-sm" data-suivant></button>
      </div>
    </div>`;
  hote.appendChild(voile);

  const trou = voile.querySelector('[data-trou]');
  const bulle = voile.querySelector('[data-bulle]');
  const texte = voile.querySelector('[data-texte]');
  const pas = voile.querySelector('[data-pas]');
  const passer = voile.querySelector('[data-passer]');
  const suivant = voile.querySelector('[data-suivant]');
  passer.textContent = t('tour.passer');

  /* On ne garde que les etapes dont la cible existe a l'ecran. */
  const vives = ETAPES.filter((e) => document.querySelector(e.cible));
  if (!vives.length) { fermer(true); return; }

  let i = 0;
  function placer() {
    const etape = vives[i];
    const el = document.querySelector(etape.cible);
    if (!el) { avancer(); return; }
    const r = el.getBoundingClientRect();
    const m = 8;                                        // marge du projecteur
    trou.style.left = (r.left - m) + 'px';
    trou.style.top = (r.top - m) + 'px';
    trou.style.width = (r.width + m * 2) + 'px';
    trou.style.height = (r.height + m * 2) + 'px';
    texte.textContent = t('tour.' + etape.cle);
    pas.textContent = (i + 1) + ' / ' + vives.length;
    suivant.textContent = i === vives.length - 1 ? t('tour.fini') : t('tour.suivant');
    /* La bulle se pose au-dessus ou en dessous de la cible, jamais par-dessus. */
    bulle.style.left = Math.max(10, Math.min(
      window.innerWidth - bulle.offsetWidth - 10,
      r.left + r.width / 2 - bulle.offsetWidth / 2)) + 'px';
    const bas = etape.place === 'bas';
    bulle.style.top = bas
      ? (r.bottom + 14) + 'px'
      : (r.top - bulle.offsetHeight - 14) + 'px';
  }

  function avancer() {
    i += 1;
    if (i >= vives.length) { fermer(true); return; }
    placer();
  }

  function fermer(termine) {
    window.removeEventListener('resize', placer);
    document.removeEventListener('keydown', surTouche, true);
    voile.remove();
    if (termine) marquerVu();
    else marquerVu();                                   // passer = vu, on ne harcele pas
  }
  function surTouche(ev) {
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); fermer(false); }
    else if (ev.key === 'Enter') { ev.preventDefault(); avancer(); }
  }

  passer.onclick = () => fermer(false);
  suivant.onclick = avancer;
  /* Un clic dans le vide (hors bulle) avance aussi : c'est le geste attendu. */
  voile.addEventListener('click', (ev) => {
    if (ev.target === voile || ev.target === trou) avancer();
  });
  window.addEventListener('resize', placer);
  document.addEventListener('keydown', surTouche, true);
  /* Laisser une image se peindre : les cibles doivent avoir leur taille. */
  requestAnimationFrame(() => requestAnimationFrame(placer));
}
