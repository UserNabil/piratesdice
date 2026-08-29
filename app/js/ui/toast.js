/* ============================================================================
   ui/toast.js — la version mobile : un bandeau, en bas, au-dessus du pouce.
   ============================================================================ */

const LIFE = 2600;

function host() {
  let box = document.getElementById('pd-toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'pd-toasts';
    document.body.appendChild(box);
  }
  return box;
}

/* ⛔ LE MEME AVERTISSEMENT SE REPETAIT A CHAQUE APPUI, ET CA CASSAIT LE JEU.
   Un joueur qui tapote « Lancer » avant son tour recevait autant de bandeaux que
   de doigts poses : trois, cinq, dix « ce n'est pas votre tour » empiles sur
   l'ecran. « Il faut pas que ca spamme, sinon ca casse l'ambiance du jeu. »

   Le message est le meme, l'information est la meme : la repeter n'apprend rien
   et couvre le plateau. On garde donc en memoire ce qui vient d'etre dit, et un
   message identique dans la foulee RANIME celui qui est deja la — il repart pour
   sa duree entiere, ce qui repond au geste sans en ajouter un de plus.

   ⚠️ ET ON GARDE LA TRACE PAR TEXTE, PAS PAR CLE. Les appelants passent des
   phrases deja traduites, souvent composees (« Longue-vue — pas votre tour ») :
   une cle d'appel n'existe pas ici. Deux phrases identiques SONT le meme
   message, quelle qu'ait ete la route pour y arriver. */
const REPETITION_MS = 2600;
let derniere = null;

export function toast(msg, type) {
  const texte = String(msg == null ? '' : msg);
  if (derniere && derniere.texte === texte && derniere.note.isConnected
      && Date.now() - derniere.a < REPETITION_MS) {
    /* Deja a l'ecran : on le fait repartir plutot que d'en empiler un second. */
    derniere.a = Date.now();
    const note = derniere.note;
    note.classList.remove('on');
    void note.offsetWidth;
    note.classList.add('on');
    clearTimeout(derniere.minuteur);
    derniere.minuteur = setTimeout(() => {
      note.classList.remove('on');
      setTimeout(() => note.remove(), 260);
    }, LIFE);
    return note;
  }

  const note = document.createElement('div');
  note.className = 'pd-toast' + (type ? ' pd-toast-' + type : '');
  note.textContent = String(msg == null ? '' : msg);
  host().appendChild(note);
  requestAnimationFrame(() => note.classList.add('on'));
  const minuteur = setTimeout(() => {
    note.classList.remove('on');
    setTimeout(() => note.remove(), 260);
  }, LIFE);
  derniere = { texte, note, a: Date.now(), minuteur };
  return note;
}
