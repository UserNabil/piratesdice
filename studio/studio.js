/* ============================================================================
   studio.js — le panneau de reglage.

   Une regle, une seule : ce qu'on voit dans le cadre est ce qui sera ecrit dans
   le fichier. Les valeurs sont donc posees en style EN LIGNE sur #dicewrap de
   l'apercu — le style en ligne bat toutes les feuilles, y compris la regle du
   portrait, ce qui evite le pire des defauts d'un studio : un curseur qui bouge
   sans que rien ne change a l'ecran.
   ============================================================================ */

const $ = (s) => document.querySelector(s);
const vue = $('#vue');

let reglages = [];         // ce que le fichier dit
const modifies = new Map(); // ce que l'utilisateur a change, pas encore ecrit

/* ── ce que le cadre regarde ─────────────────────────────────────────────── */

function largeur() {
  return parseInt($('#taille').value.split('x')[0], 10);
}

/* ⚠️ UNE PROPRIETE PEUT AVOIR QUATRE VALEURS, PAS DEUX. mobile.css empile le
   bureau, le portrait, le paysage large et les ecrans de moins de 400 px. Ce
   n'est pas quatre reglages : c'est le MEME reglage, et une seule de ses valeurs
   gagne a une taille donnee. Laquelle ? On ne le devine pas — on le DEMANDE au
   navigateur de l'apercu, dont la fenetre est justement celle qu'on regarde. */
function faceQuiGagne(r) {
  const fenetre = vue.contentWindow;
  let gagnante = '';
  for (const condition of (r.ordre || [''])) {
    if (!condition) { gagnante = ''; continue; }
    try {
      if (fenetre && fenetre.matchMedia(condition).matches) gagnante = condition;
    } catch (e) { /* le cadre n'est pas encore la : la base fera l'affaire */ }
  }
  return gagnante;
}

function face(r) { return faceQuiGagne(r); }

/* Le nom court d'une couche, pour la pastille du panneau. */
function nomDeFace(condition) {
  if (!condition) return '';
  if (condition.includes('400px')) return 'petit ecran';
  if (condition.includes('landscape')) return 'paysage';
  if (condition.includes('portrait')) return 'portrait';
  return condition;
}

function valeurDeFichier(r) {
  return r.faces[face(r)];
}

function valeurCourante(r) {
  const m = modifies.get(cle(r));
  return m ? m.valeur : valeurDeFichier(r);
}

const cle = (r) => r.nom + '@' + face(r);

/* ── poser les valeurs dans le cadre ─────────────────────────────────────── */

function racine() {
  const doc = vue.contentDocument;
  return doc && doc.getElementById('dicewrap');
}

function appliquer() {
  const el = racine();
  if (!el) return;
  for (const r of reglages) {
    const m = modifies.get(cle(r));
    const actif = m ? m.actif : r.actif;
    const valeur = m ? m.valeur : valeurDeFichier(r);
    if (actif && valeur) el.style.setProperty(r.nom, valeur);
    else el.style.removeProperty(r.nom);
  }
}

/* ── lire le type d'un reglage ───────────────────────────────────────────── */

const COULEUR = /^#[0-9a-f]{3,8}$/i;
const LONGUEUR = /^(-?\d*\.?\d+)(px|%|vh|vw|em|rem|s|ms|deg)?$/;
const COINS = ['HG', 'HD', 'BD', 'BG'];

function morceaux(valeur) {
  const bouts = valeur.trim().split(/\s+/);
  return (bouts.length >= 2 && bouts.length <= 4 && bouts.every((b) => LONGUEUR.test(b)))
    ? bouts : null;
}

function bornes(nombre, unite) {
  if (unite === '%') return [0, 100, 0.1];
  const haut = Math.max(40, Math.abs(nombre) * 3);
  return [0, Math.round(haut), unite === 'px' ? 1 : 0.05];
}

/* ── construire une commande ─────────────────────────────────────────────── */

function curseur(valeur, onChange) {
  const [, nombre, unite = ''] = valeur.match(LONGUEUR);
  const [min, max, pas] = bornes(parseFloat(nombre), unite);
  const rangee = document.createElement('div');
  rangee.className = 'rangee';
  const glissiere = document.createElement('input');
  glissiere.type = 'range';
  glissiere.min = min; glissiere.max = max; glissiere.step = pas;
  glissiere.value = parseFloat(nombre);
  const nombreEl = document.createElement('input');
  nombreEl.type = 'number';
  nombreEl.step = pas;
  nombreEl.value = parseFloat(nombre);
  const dit = (v) => onChange(v + unite);
  glissiere.oninput = () => { nombreEl.value = glissiere.value; dit(glissiere.value); };
  nombreEl.oninput = () => { glissiere.value = nombreEl.value; dit(nombreEl.value); };
  rangee.append(glissiere, nombreEl);
  return rangee;
}

function commandes(r, poser) {
  const valeur = valeurCourante(r);
  const boite = document.createElement('div');
  boite.className = 'commandes';

  if (COULEUR.test(valeur)) {
    const rangee = document.createElement('div');
    rangee.className = 'rangee';
    const pot = document.createElement('input');
    pot.type = 'color'; pot.value = valeur.slice(0, 7);
    const texte = document.createElement('input');
    texte.type = 'text'; texte.value = valeur;
    pot.oninput = () => { texte.value = pot.value; poser(pot.value); };
    texte.oninput = () => { poser(texte.value); };
    rangee.append(pot, texte);
    boite.appendChild(rangee);
    return boite;
  }

  if (LONGUEUR.test(valeur)) {
    boite.appendChild(curseur(valeur, poser));
    return boite;
  }

  /* Une courbure a quatre coins : quatre curseurs, pas un champ de texte. Les
     coins INEGAUX sont ce qui fait « dessine a la main » — les regler un par un
     doit etre aussi simple que de les egaliser. */
  const bouts = morceaux(valeur);
  if (bouts) {
    const etat = bouts.slice();
    bouts.forEach((bout, i) => {
      const rangee = curseur(bout, (v) => { etat[i] = v; poser(etat.join(' ')); });
      const etiquette = document.createElement('label');
      etiquette.textContent = bouts.length === 4 ? COINS[i] : String(i + 1);
      rangee.prepend(etiquette);
      boite.appendChild(rangee);
    });
    return boite;
  }

  const champ = document.createElement(valeur.length > 46 ? 'textarea' : 'input');
  if (champ.tagName === 'INPUT') champ.type = 'text';
  champ.value = valeur;
  champ.oninput = () => poser(champ.value);
  boite.appendChild(champ);
  return boite;
}

/* ── dessiner le panneau ─────────────────────────────────────────────────── */

function dessiner() {
  const hote = $('#groupes');
  hote.textContent = '';
  const filtre = $('#filtre').value.trim().toLowerCase();

  const parGroupe = new Map();
  for (const r of reglages) {
    if (filtre && !(r.nom + ' ' + r.groupe + ' ' + r.aide).toLowerCase().includes(filtre)) continue;
    if (!parGroupe.has(r.groupe)) parGroupe.set(r.groupe, []);
    parGroupe.get(r.groupe).push(r);
  }

  for (const [groupe, liste] of parGroupe) {
    const bloc = document.createElement('details');
    bloc.className = 'groupe';
    bloc.open = !groupe.startsWith('Jetons');
    const titre = document.createElement('summary');
    titre.textContent = groupe + '  (' + liste.length + ')';
    bloc.appendChild(titre);

    for (const r of liste) bloc.appendChild(carte(r));
    hote.appendChild(bloc);
  }
}

function carte(r) {
  const el = document.createElement('div');
  el.className = 'reglage';
  const m = modifies.get(cle(r));
  const actif = m ? m.actif : r.actif;
  if (m) el.classList.add('modifie');
  if (!actif) el.classList.add('eteint');

  const tete = document.createElement('div');
  tete.className = 'tete';

  /* Un reglage eteint (en commentaire dans le fichier) reste un reglage : la
     case a cocher l'allume, et l'enregistrement decommente sa ligne. */
  const interrupteur = document.createElement('input');
  interrupteur.type = 'checkbox';
  interrupteur.checked = actif;
  interrupteur.title = actif ? 'actif' : 'eteint — coche pour reprendre la main';
  interrupteur.onchange = () => {
    modifies.set(cle(r), { valeur: valeurCourante(r), actif: interrupteur.checked, face: face(r) });
    appliquer(); dessiner(); etat();
  };

  const nom = document.createElement('span');
  nom.className = 'nom';
  nom.textContent = r.nom.replace(/^--(cbt-)?/, '');

  tete.append(interrupteur, nom);
  const couche = nomDeFace(face(r));
  if (couche) {
    const tag = document.createElement('span');
    tag.className = 'tag portrait';
    tag.textContent = couche;
    tag.title = 'A la taille regardee, c\'est cette valeur-la qui gagne : '
      + face(r) + '. Les autres tailles gardent la leur.';
    tete.appendChild(tag);
  }
  if (r.source === 'jetons') {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = 'dice.css';
    tag.title = 'Jeton partage : il sera recouvert dans combat.css, jamais modifie dans dice.css.';
    tete.appendChild(tag);
  }
  if (m) {
    const raz = document.createElement('button');
    raz.className = 'raz';
    raz.textContent = 'annuler';
    raz.onclick = () => { modifies.delete(cle(r)); appliquer(); dessiner(); etat(); };
    tete.appendChild(raz);
  }
  el.appendChild(tete);

  if (r.fige) {
    const aide = document.createElement('p');
    aide.className = 'aide';
    aide.textContent = 'Mesuree par js/fit.js a chaque affichage : un reglage ici serait efface.';
    el.append(aide);
    el.classList.add('eteint');
    return el;
  }

  if (r.aide) {
    const aide = document.createElement('p');
    aide.className = 'aide';
    aide.textContent = r.aide.length > 260 ? r.aide.slice(0, 260) + '…' : r.aide;
    aide.title = r.aide;
    el.appendChild(aide);
  }

  el.appendChild(commandes(r, (valeur) => {
    modifies.set(cle(r), { valeur, actif: true, face: face(r) });
    appliquer();
    el.classList.add('modifie');
    etat();
  }));
  return el;
}

function etat(message) {
  const n = modifies.size;
  $('#etat').textContent = message
    || (n ? n + ' reglage(s) en attente d\'enregistrement' : 'tout est enregistre');
  $('#enregistrer').disabled = !n;
}

/* ── le fichier ──────────────────────────────────────────────────────────── */

async function charger(garderModifs) {
  const rep = await fetch('/__studio/reglages');
  reglages = (await rep.json()).reglages;
  if (!garderModifs) modifies.clear();
  dessiner(); appliquer(); etat();
}

async function enregistrer() {
  const charge = { combat: {}, jetons: {} };
  for (const r of reglages) {
    const m = modifies.get(cle(r));
    if (r.source === 'jetons') {
      const actif = m ? m.actif : r.actif;
      if (actif) charge.jetons[r.nom] = m ? m.valeur : r.valeur;
    } else if (m) {
      charge.combat[r.nom] = { valeur: m.valeur, actif: m.actif, face: m.face };
    }
  }
  $('#enregistrer').disabled = true;
  etat('ecriture…');
  const rep = await fetch('/__studio/enregistrer', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(charge),
  });
  const res = await rep.json();
  if (!res.ok) return etat('ECHEC : ' + res.erreur);
  modifies.clear();
  await charger(false);
  /* Le cadre est recharge : ce qu'on voit vient alors du FICHIER, plus des
     styles en ligne du studio. C'est la seule verification qui compte. */
  vue.contentWindow.location.reload();
  etat(res.ecrits + ' reglage(s) ecrits dans combat.css'
    + (res.manquants.length ? ' — introuvables : ' + res.manquants.join(', ') : ''));
}

/* ── branchements ────────────────────────────────────────────────────────── */

vue.addEventListener('load', () => { dessiner(); appliquer(); });
$('#enregistrer').onclick = enregistrer;
$('#recharger').onclick = () => { charger(false); vue.contentWindow.location.reload(); };
$('#filtre').oninput = dessiner;
$('#rafraichir').onclick = () => vue.contentWindow.location.reload();
$('#contenu').onchange = () => { vue.src = $('#contenu').value; };
function cadrer() {
  const [l, h] = $('#taille').value.split('x').map(Number);
  vue.style.width = l + 'px';
  vue.style.height = h + 'px';

  /* La place reellement libre sous la barre du haut, moins la marge. */
  const boite = $('#telephone').getBoundingClientRect();
  const k = Math.min(1, (boite.height - 36) / h, (boite.width - 36) / l);
  vue.style.transform = k < 1 ? 'scale(' + k.toFixed(3) + ')' : 'none';
  /* L'enveloppe prend la taille VUE, sinon la page garde la place du cadre
     entier et le centrage se decale. */
  $('#cadre').style.width = Math.round(l * k) + 'px';
  $('#cadre').style.height = Math.round(h * k) + 'px';
  $('#echelle').textContent = l + ' x ' + h + (k < 1 ? '  (affiche a ' + Math.round(k * 100) + ' %)' : '');
}

$('#taille').onchange = () => {
  cadrer();
  dessiner();   // le portrait et l'ecran large ne montrent pas les memes valeurs
  appliquer();
};
window.addEventListener('resize', cadrer);
cadrer();
charger(false);
