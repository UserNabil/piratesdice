/* ============================================================================
   ui/bus_audio.js — LE SON PASSE PAR UN BUS, PLUS PAR LA PROPRIETE `volume`.

   ⛔ SUR iOS, `element.volume` NE FAIT RIEN. La propriete s'ecrit et se relit
   — 0,37 ecrit, 0,37 relu, mesure faite dans le simulateur — mais WebKit ne la
   transmet jamais au lecteur : dans `HTMLMediaElement::updateVolume()`, la
   branche iOS n'applique QUE la coupure, jamais le niveau. Le reglage existait
   donc cote JavaScript et mourait avant le haut-parleur : « j'ai beau
   augmenter et reduire, j'ai toujours le meme volume ». C'etait vrai.

   ⚠️ ET C'EST UN PIEGE PARFAIT POUR UN BANC D'ESSAI. Sous Chrome tout marche,
   la valeur se propage, on la mesure et on croit avoir fini. Relire la
   propriete ne prouve rien du tout : elle est stockee meme quand elle est
   ignoree. Seul le CHEMIN DU SIGNAL fait foi.

   La parade est la seule qui existe : router le son dans un AudioContext et
   regler un `GainNode`. Le gain, lui, agit sur l'echantillon, pas sur un
   reglage que la plateforme peut decider d'ignorer.

   DEUX CHEMINS, PARCE QUE LES DEUX BESOINS DIFFERENT :
     - les effets sont courts et se superposent : on les DECODE une fois et on
       rejoue le tampon. C'est aussi ce qui rend `playbackRate` exact.
     - la musique dure deux minutes : on ne la decode pas en memoire, on branche
       l'element sur le graphe (`createMediaElementSource`) et elle continue de
       se lire en flux.

   ⚠️ LE CONTEXTE DEMARRE ENDORMI, ET C'EST NORMAL. Aucun navigateur ne laisse
   un site faire du bruit avant que l'utilisateur ait touche l'ecran. On le
   reveille au premier geste — une fois, sans rien dire.
   ============================================================================ */

let ctx = null;
let sortie = null;                 // le gain general, avant la sortie physique
const canaux = new Map();          // 'effets' | 'musique' -> GainNode
const tampons = new Map();         // nom -> AudioBuffer
const branches = new WeakMap();    // element -> MediaElementAudioSourceNode
let geste = false;

/** Le contexte, cree au premier besoin. `null` si la plateforme n'en a pas. */
export function contexte() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    ctx = new AC();
    sortie = ctx.createGain();
    sortie.connect(ctx.destination);
    poserLeGuetteur();
  } catch (_) { ctx = null; }
  return ctx;
}

/** Le gain d'un canal, cree a la demande et branche sur la sortie. */
export function canal(nom) {
  const c = contexte();
  if (!c) return null;
  let g = canaux.get(nom);
  if (!g) {
    g = c.createGain();
    g.gain.value = 1;
    g.connect(sortie);
    canaux.set(nom, g);
  }
  return g;
}

/**
 * ⛔ LIBERER LE PARAMETRE AVANT DE LUI PARLER, TOUJOURS.
 *
 * Un `AudioParam` en pleine automation REFUSE tout : `setTargetAtTime` jette,
 * `setValueAtTime` jette, et — c'est la ou le piege se referme — la simple
 * affectation `param.value = x` jette AUSSI. Un `catch` dont le repli jette a
 * son tour n'est pas un filet de securite : l'exception ressort, et si elle
 * ressort dans un abonnement, elle est avalee sans un mot.
 *
 * C'est exactement ce qui est arrive : bouger un curseur pendant le fondu de
 * 1,4 s laissait le haut-parleur du bandeau afficher l'etat d'avant, sans
 * aucune erreur visible. Mesure au banc, pas deduction.
 *
 * `cancelAndHoldAtTime` est le seul appel qui interrompe une courbe en cours en
 * gardant la valeur atteinte — donc sans clic. `cancelScheduledValues` ne
 * l'annule pas partout, d'ou le second essai.
 */
function liberer(param) {
  if (!ctx) return;
  const t = ctx.currentTime;
  try {
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t);
    else param.cancelScheduledValues(t);
  } catch (_) {
    try { param.cancelScheduledValues(t); } catch (__) { /* rien a annuler */ }
  }
}

/** Poser une valeur, en vingt millisecondes pour ne pas claquer. */
function viser(param, valeur) {
  liberer(param);
  try { param.setTargetAtTime(valeur, ctx.currentTime, 0.02); }
  catch (_) { try { param.value = valeur; } catch (__) { /* on renonce, sans jeter */ } }
}

/**
 * Le niveau d'un canal.
 *
 * ⚠️ ON NE POSE PAS LA VALEUR SECHEMENT. Un saut de gain instantane fait un
 * « clic » audible dans le haut-parleur — c'est une discontinuite dans le
 * signal, pas un defaut de reglage. Vingt millisecondes de rampe l'effacent et
 * restent imperceptibles pour la main qui glisse.
 */
export function niveauCanal(nom, facteur) {
  const g = canal(nom);
  if (!g) return;
  viser(g.gain, Math.max(0, Number(facteur) || 0));
}

/**
 * ⚠️ LE PREMIER GESTE REVEILLE LE SON, ET IL N'Y EN A QU'UN. Le contexte nait
 * endormi ; sans ce guetteur, tout ce qu'on lui envoie part dans le vide, et
 * l'application semble muette alors qu'elle joue.
 */
function poserLeGuetteur() {
  if (geste || typeof document === 'undefined') return;
  geste = true;
  const reveil = () => {
    reveiller();
    if (ctx && ctx.state === 'running') {
      document.removeEventListener('pointerdown', reveil, true);
      document.removeEventListener('touchstart', reveil, true);
      document.removeEventListener('keydown', reveil, true);
    }
  };
  document.addEventListener('pointerdown', reveil, true);
  document.addEventListener('touchstart', reveil, true);
  document.addEventListener('keydown', reveil, true);
}

export function reveiller() {
  const c = contexte();
  if (!c || c.state === 'running') return;
  try { const p = c.resume(); if (p && p.catch) p.catch(() => { /* pas encore permis */ }); }
  catch (_) { /* idem */ }
}

/** Mettre le bus en veille quand l'application passe derriere, et le rendre. */
export function dormir() {
  if (ctx && ctx.state === 'running') { try { ctx.suspend(); } catch (_) { /* deja */ } }
}

/**
 * ⛔ ET ON NE LIT PAS LE FICHIER AVEC `fetch`. Sous le schema `capacitor://`,
 * `fetch` rend une reponse opaque — `ok: false`, statut 0, corps vide — alors
 * que le fichier est la : mesure faite dans le simulateur, 0 octet par `fetch`,
 * 20 867 par XHR sur le meme chemin. Rien n'est jete, rien n'est journalise :
 * le decodage echouait en silence et tous les effets repassaient par le vieux
 * chemin, celui dont le volume est ignore par iOS. Le bogue en cachait un
 * second.
 *
 * ⚠️ ET LE STATUT 0 EST NORMAL ICI, PAS UNE ERREUR : un schema personnalise n'a
 * pas de code HTTP. C'est la longueur de la reponse qui fait foi.
 */
function lire(url) {
  return new Promise((resoudre, rejeter) => {
    const x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.responseType = 'arraybuffer';
    x.onload = () => resoudre(x.response);
    x.onerror = () => rejeter(new Error('lecture refusee : ' + url));
    x.send();
  });
}

/* ⚠️ Safari a longtemps ignore la forme a promesse de `decodeAudioData` : on
   accepte les deux, sinon rien ne se decode sur iOS. */
function decoder(c, brut) {
  return new Promise((resoudre, rejeter) => {
    let rendu = false;
    try {
      const p = c.decodeAudioData(brut, (b) => { rendu = true; resoudre(b); }, rejeter);
      if (p && p.then && !rendu) p.then(resoudre, rejeter);
    } catch (e) { rejeter(e); }
  });
}

/**
 * Decoder un fichier court une fois pour toutes.
 * Silencieux en cas d'echec : l'appelant garde son chemin de secours.
 *
 * ⚠️ CE QUE CA COUTE, DIT FRANCHEMENT : la banque entiere fait 508 Ko en MP3 et
 * une cinquantaine de secondes de son ; decodee, elle occupe une quinzaine de
 * megaoctets de memoire vive. C'est le prix d'un reglage de volume qui marche
 * sur iOS, et il se paie une fois, pendant que le menu s'affiche.
 */
export async function charger(nom, url) {
  const c = contexte();
  if (!c || tampons.has(nom)) return;
  try {
    const brut = await lire(url);
    if (!brut || !brut.byteLength) return;
    const tampon = await decoder(c, brut);
    if (tampon) tampons.set(nom, tampon);
  } catch (_) { /* le chemin <audio> prendra le relais */ }
}

/** Vrai si le son a ete joue par le bus ; faux s'il faut le chemin de secours. */
export function jouerTampon(nom, nomCanal, volume, vitesse) {
  const c = contexte();
  const tampon = tampons.get(nom);
  const g = c && tampon ? canal(nomCanal) : null;
  if (!g) return false;
  reveiller();
  try {
    const source = c.createBufferSource();
    source.buffer = tampon;
    if (vitesse) source.playbackRate.value = vitesse;
    const propre = c.createGain();
    propre.gain.value = Math.max(0, Math.min(1, volume === undefined ? 0.35 : volume));
    source.connect(propre);
    propre.connect(g);
    source.start();
    /* Se debrancher a la fin : un noeud laisse dans le graphe n'est jamais
       ramasse, et on en cree plusieurs par seconde pendant une partie. */
    source.onended = () => { try { source.disconnect(); propre.disconnect(); } catch (_) { /* deja */ } };
    return true;
  } catch (_) { return false; }
}

/**
 * Brancher un <audio> (la musique) sur un canal. Renvoie le gain propre a cet
 * element, ou `null` si le bus n'est pas disponible.
 *
 * ⛔ UN ELEMENT NE SE BRANCHE QU'UNE FOIS. Un second
 * `createMediaElementSource` sur le meme element leve une exception dans tous
 * les navigateurs : on garde donc le lien dans une table faible.
 */
export function brancherElement(el, nomCanal) {
  const c = contexte();
  const g = c && el ? canal(nomCanal) : null;
  if (!g) return null;
  if (branches.has(el)) return branches.get(el).propre;
  try {
    const source = c.createMediaElementSource(el);
    const propre = c.createGain();
    propre.gain.value = 1;
    source.connect(propre);
    propre.connect(g);
    branches.set(el, { source, propre });
    return propre;
  } catch (_) { return null; }
}

/** Couper les liens d'un element qu'on jette. */
export function debrancherElement(el) {
  const lien = el && branches.get(el);
  if (!lien) return;
  try { lien.source.disconnect(); lien.propre.disconnect(); } catch (_) { /* deja */ }
  branches.delete(el);
}

/** Le niveau propre d'un element branche (le melange regle dans le code). */
export function niveauElement(propre, valeur) {
  if (!propre || !ctx) return;
  viser(propre.gain, Math.max(0, Number(valeur) || 0));
}

/**
 * Amener un gain d'une valeur a l'autre, en COURBE DE PUISSANCE CONSTANTE.
 *
 * ⚠️ DEUX RAMPES DROITES QUI SE CROISENT FONT UN TROU DE 3 dB EN LEUR MILIEU.
 * A mi-chemin, chaque piste est a la moitie de son amplitude : la somme des
 * PUISSANCES vaut alors la moitie, et on entend un creux au beau milieu du
 * fondu. La racine carree corrige exactement cela — c'est la meme courbe qu'on
 * a utilisee pour recoudre les boucles elles-memes.
 */
export function fondre(propre, depart, arrivee, secondes) {
  if (!propre || !ctx) return;
  const t = ctx.currentTime;
  const d = Math.max(0, Number(depart) || 0);
  const a = Math.max(0, Number(arrivee) || 0);
  liberer(propre.gain);
  try {
    const N = 48;
    const courbe = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      courbe[i] = Math.sqrt(d * d * (1 - u) + a * a * u);
    }
    propre.gain.setValueCurveAtTime(courbe, t, Math.max(0.02, secondes));
  } catch (_) {
    /* La courbe a ete refusee : on retombe sur une rampe droite, qui vaut
       toujours mieux qu'une coupure nette. Et si elle est refusee aussi, on
       renonce EN SILENCE — jeter ici ferait tomber tout l'abonnement. */
    try {
      liberer(propre.gain);
      propre.gain.setValueAtTime(d, ctx.currentTime);
      propre.gain.linearRampToValueAtTime(a, ctx.currentTime + Math.max(0.02, secondes));
    } catch (__) {
      try { propre.gain.value = a; } catch (___) { /* on renonce */ }
    }
  }
}
