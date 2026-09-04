/* ============================================================================
   identity.js — qui est le joueur.

   PROMESSE DE LA FICHE : on installe, on ouvre, on joue. Aucun formulaire.
   Le compte est donc celui de Google Play : le module natif rend un code
   d'autorisation, le SERVEUR l'echange chez Google et decide qui vous etes. Le
   telephone ne s'auto-declare jamais — sinon n'importe qui se ferait passer pour
   n'importe qui en modifiant l'application.

   REPLI. Un appareil sans services Play, un joueur qui refuse, un test hors
   Play : on retombe sur un compte INVITE, propre a ce telephone (un secret de
   256 bits tire ici et garde ici). Le joueur joue quand meme ; il pourra se
   connecter plus tard depuis les reglages.
   ============================================================================ */

const KEY_DEVICE = 'pd.device';
const KEY_NAME = 'pd.name';
const KEY_MODE = 'pd.mode';          // 'google' | 'guest'
const KEY_SESSION = 'pd.session';    // le jeton en cours, garde entre deux lancements

const CREWS = ['Barbarossa', 'Anne Bonny', 'Blackbeard', 'Calico Jack', 'Mary Read',
  'Long John', 'Grace O\'Malley', 'Ching Shih', 'Henry Every', 'Bartholomew'];

let session = null;                  // { url, ws, token, expires, player }

/**
 * La session survit a la fermeture de l'application.
 *
 * ⚠️ ELLE NE SURVIVAIT PAS, ET LE COMPTE SE PERDAIT A CHAQUE LANCEMENT. Le jeton
 * ne vivait qu'en memoire : on rouvrait le jeu, la reprise silencieuse echouait
 * (Apple n'en a pas, et Google peut refuser) et le joueur retombait en INVITE —
 * un autre compte, d'autres pieces, un autre classement. Le jeton est donc
 * garde, et repris tant qu'il est valide. Ce n'est pas un secret de serveur :
 * c'est le meme jeton que le telephone porte deja pendant toute sa session.
 */
function garderSession(s, mode) {
  session = s;
  localStorage.setItem(KEY_MODE, mode);
  try {
    localStorage.setItem(KEY_SESSION, JSON.stringify({ mode, token: s.token,
      expires: s.expires, player: s.player, google: !!s.google }));
  } catch (_) { /* stockage plein : on jouera sans reprise, pas de quoi bloquer */ }
  return s;
}

/** La session gardee, si elle n'est pas perimee. Une marge d'une minute evite
    de repartir avec un jeton qui expirera pendant la premiere partie. */
function sessionGardee() {
  try {
    const brut = localStorage.getItem(KEY_SESSION);
    if (!brut) return null;
    const g = JSON.parse(brut);
    if (!g || !g.token || !g.expires) return null;
    if (g.expires * 1000 < Date.now() + 60000) return null;
    return { url: serverBase(), ws: wsFrom(serverBase()),
             token: g.token, expires: g.expires, player: g.player, google: !!g.google };
  } catch (_) {
    return null;
  }
}

export function serverBase() {
  const baked = (window.PD_CONFIG && window.PD_CONFIG.server) || '';
  return baked.replace(/\/+$/, '');
}

function wsFrom(base) {
  if (base.startsWith('https://')) return 'wss://' + base.slice(8) + '/ws';
  if (base.startsWith('http://')) return 'ws://' + base.slice(7) + '/ws';
  return base + '/ws';
}

/**
 * ⛔ UN `fetch` VERS UNE MACHINE ETEINTE N'ECHOUE PAS : IL ATTEND.
 *
 * Une adresse qui REFUSE la connexion repond tout de suite — c'est le cas d'un
 * service arrete sur une machine allumee. Une machine qui ne repond plus DU
 * TOUT, elle, laisse le SYN sans reponse, et le systeme reessaie pendant trente
 * a soixante-quinze secondes avant d'abandonner. Aucun de nos appels ne posait
 * de limite : `start()` attendait donc tout ce temps, et le joueur regardait le
 * rideau d'ouverture — une tete de mort au milieu d'un ecran vide, sans un mot,
 * sans un bouton. Mesure sur simulateur, serveur du reseau local eteint : plus
 * de quarante secondes avant que quoi que ce soit ne bouge.
 *
 * Six secondes suffisent largement a un serveur vivant, meme sur un reseau
 * mobile lent. Au-dela c'est une panne — et le jeu sait entrer sans reseau.
 */
const DELAI_RESEAU = 6000;

function avecDelai(ms) {
  const stop = new AbortController();
  const t = setTimeout(() => stop.abort(), ms || DELAI_RESEAU);
  return { signal: stop.signal, fini: () => clearTimeout(t) };
}

async function post(path, body) {
  const garde = avecDelai();
  let r;
  try {
    r = await fetch(serverBase() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: garde.signal,
    });
  } finally {
    garde.fini();
  }
  const text = await r.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch (_) { parsed = null; }
  if (!r.ok) throw new Error((parsed && parsed.error) || ('HTTP ' + r.status));
  return parsed || {};
}

/* ── le compte invite : un secret tire une seule fois ────────────────────── */

function deviceId() {
  let id = localStorage.getItem(KEY_DEVICE);
  if (!id) {
    const raw = new Uint8Array(32);
    crypto.getRandomValues(raw);
    id = Array.from(raw, (b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(KEY_DEVICE, id);
  }
  return id;
}

function guestName() {
  let name = localStorage.getItem(KEY_NAME);
  if (!name) {
    name = CREWS[Math.floor(Math.random() * CREWS.length)];
    localStorage.setItem(KEY_NAME, name);
  }
  return name;
}

/* ── Le compte Google : le module natif, s'il est la ─────────────────────── */

/* L'identifiant du client WEB, et non celui d'Android. C'est lui que Google met
   comme destinataire du code d'autorisation, et c'est ce code que le serveur
   echange contre l'identite du joueur. Un identifiant de client est PUBLIC par
   construction : ce n'est pas un secret, et il n'y en a aucun dans l'app. Le
   client Android, lui, ne s'ecrit nulle part ici — Google le reconnait a la
   signature de l'application et a son nom de paquet. */
const CLIENT_WEB = '975326394375-5rrfp97jmjtmqggser8jvc3ec8mvplii.apps.googleusercontent.com';
/* ⛔ LE CLIENT iOS EST DISTINCT DU CLIENT WEB. Le plugin exige `iOSClientId`
   pour la connexion Google sur iPhone (le web sert au serverAuthCode que le
   serveur echange). Son identifiant inverse doit AUSSI etre un schema d'URL de
   l'Info.plist, sinon le retour d'authentification ne revient jamais a l'app. */
const CLIENT_IOS = '975326394375-2tt38bv4rum7vdtj2m9o9qanhggpcu3h.apps.googleusercontent.com';

let prepare = null;

/**
 * Apple sur iOS, Google sur Android — et ce n'est pas un gout.
 *
 * ⚠️ DIRECTIVE 4.8 D'APPLE : une application qui propose un identifiant tiers
 * DOIT proposer Sign in with Apple a egalite. Offrir Google sur iOS sans Apple
 * est un rejet garanti. Comme Apple ne se propose pas hors de son ecosysteme, la
 * regle se resume a : chacun chez soi.
 */
export function fournisseur() {
  const cap = window.Capacitor;
  const os = cap && cap.getPlatform ? cap.getPlatform() : 'web';
  return os === 'ios' ? 'apple' : 'google';
}

function plugin() {
  const cap = window.Capacitor;
  return (cap && cap.Plugins && cap.Plugins.SocialLogin) || null;
}

/* ⚠️ `initialize` UNE SEULE FOIS, ET AVANT TOUT `login`. Appele a chaque
   connexion il rejoue la configuration native pour rien ; oublie, `login` echoue
   avec une erreur qui ne parle pas de configuration. On garde la promesse. */
function pret() {
  const p = plugin();
  if (!p) return Promise.reject(new Error('no plugin'));
  if (!prepare) {
    /* `mode: offline` ne rend QUE le code d'autorisation — pas de profil, pas de
       jeton d'acces. C'est exactement ce que le serveur attend, et c'est aussi
       le moins de donnees qu'on puisse demander. */
    /* ⚠️ ON NE DECLARE QUE LE FOURNISSEUR DE CETTE PLATEFORME. Declarer `apple`
       sur Android faisait echouer l'initialisation ENTIERE — le greffon y exige
       une `redirectUrl` pour le flux web d'Apple, qui n'a aucun sens ici — et
       Google ne demarrait donc jamais :
         « apple.android.redirectUrl is null or empty »
       Une option inutile sur une plateforme n'y est pas neutre : elle casse ce
       qui marchait a cote. */
    prepare = p.initialize(fournisseur() === 'apple'
      /* Apple ne demande aucun identifiant cote application : le systeme sait
         quelle application le demande, et c'est le serveur qui verifie que le
         jeton lui etait bien destine. */
      ? { apple: {} }
      : { google: { webClientId: CLIENT_WEB, iOSClientId: CLIENT_IOS, mode: 'offline' } });
    /* ⚠️ ON NE MEMOISE QUE LE SUCCES. Un echec transitoire (reseau, greffon pas
       encore pret) laissait `prepare` sur une promesse REJETEE pour toute la
       session : Google/Apple restaient morts jusqu'au redemarrage. On vide le
       cache sur rejet pour que l'appel suivant retente. Le rejet part quand meme
       a l'appelant, qui l'attrape. */
    prepare.catch(() => { prepare = null; });
  }
  return prepare;
}

export function googleAvailable() { return !!plugin(); }

/**
 * Ouvre une session. `interactive: false` au demarrage (silencieux : si le
 * joueur est deja connecte a Play Games, il ne voit rien passer) ; `true` quand
 * il clique lui-meme sur « se connecter ».
 */
export async function signIn(opts) {
  const interactive = !!(opts && opts.interactive);
  const games = plugin();

  /* ⚠️ LA REPRISE PASSE AVANT TOUT LE RESTE, et vaut pour les deux plateformes.
     C'est elle qui rend Apple utilisable : il n'a pas de reconnexion
     silencieuse, mais un jeton encore valide ne demande rien a personne. */
  if (!interactive) {
    const reprise = sessionGardee();
    if (reprise) { session = reprise; return session; }
  }

  if (games) {
    try {
      await pret();
      if (fournisseur() === 'apple') {
        /* ⚠️ APPLE N'A PAS DE REPRISE SILENCIEUSE. Il n'existe aucun moyen de
           savoir, sans ouvrir la fenetre, si l'utilisateur avait deja accorde
           son compte. Au demarrage on ne tente donc RIEN : le joueur entre en
           invite, et se lie quand il le decide. */
        if (!interactive) throw new Error('silent');
        const jeton = await jetonApple(games);
        if (jeton) {
          return garderSession(await claimApple(jeton), 'google');
        }
      }
      const out = fournisseur() === 'apple' ? null : await codeGoogle(games, interactive);
      if (out && out.serverAuthCode) {
        return garderSession(await claimGoogle(out.serverAuthCode, out.idToken), 'google');
      }
    } catch (e) {
      if (interactive) throw new Error(e && e.message ? e.message : 'Google sign-in failed');
      /* silencieux : on ne bloque pas l'ouverture du jeu pour ca */
    }
  }

  /* ⛔ UN COMPTE INVITE DEMANDE LE SERVEUR, ET LE SERVEUR PEUT ETRE ABSENT.
     Cette ligne etait la derniere de `start()` a pouvoir jeter : sans session
     rangee et sans reseau, `claimDevice()` echouait, `start()` rejetait, et
     l'application s'arretait sur la carte « le jeu n'a pas pu demarrer » — alors
     qu'elle sait tourner sans reseau. « Ca devrait m'afficher directement la
     page d'accueil pour jouer en mode hors ligne. »

     ⚠️ ET SEULEMENT QUAND LA DEMANDE EST SILENCIEUSE. Un joueur qui appuie sur
     « se connecter » depuis les reglages attend une reponse : lui rendre `null`
     sans un mot serait un bouton qui ne fait rien. Interactif, l'erreur remonte
     et l'ecran la dit. */
  try {
    return garderSession(await claimDevice(), 'guest');
  } catch (e) {
    if (interactive) throw e;
    console.warn('[identite] compte invite indisponible :', (e && e.message) || e);
    return null;
  }
}

/**
 * Le code d'autorisation, silencieusement si possible.
 *
 * ⚠️ UNE FENETRE DE CONNEXION AU DEMARRAGE EST UN MUR, et le demarrage promet le
 * contraire. On ne tente donc la reprise que si le telephone a DEJA accorde un
 * compte a cette application : le joueur ne voit alors rien passer. La fenetre
 * ne s'ouvre que lorsqu'il l'a demandee lui-meme, depuis les reglages.
 */
/**
 * Le JWT d'Apple, OU QU'IL SOIT RANGE.
 *
 * ⛔ LE GREFFON MET LE JETON D'IDENTITE DANS `accessToken.token`, ET LE CODE
 * D'AUTORISATION DANS `idToken`. Les deux champs sont inverses par rapport a
 * leur nom (`AppleProvider.swift` : `idToken:` recoit
 * `appleIDCredential.authorizationCode`). On envoyait donc au serveur un code
 * opaque de quelques caracteres la ou il attend un jeton signe en trois
 * morceaux — d'ou « malformed identityToken » a l'ecran, et une liaison de
 * compte impossible.
 *
 * On ne se fie donc pas au NOM du champ mais a sa FORME : un jeton d'identite
 * est un JWT, trois parties separees par des points. Le jour ou le greffon
 * remettra ses champs a l'endroit, ce code marchera encore.
 */
function jwtApple(out) {
  for (const candidat of [out && out.accessToken && out.accessToken.token,
                          out && out.idToken]) {
    if (typeof candidat === 'string' && candidat.split('.').length === 3) return candidat;
  }
  return null;
}

async function jetonApple(p) {
  const rep = await p.login({ provider: 'apple', options: { scopes: ['name'] } });
  const out = rep && rep.result ? rep.result : null;
  const jwt = jwtApple(out);
  if (!jwt) return null;
  /* ⚠️ APPLE NE DONNE LE NOM QU'A LA PREMIERE CONNEXION, jamais ensuite. On le
     transmet s'il vient ; le serveur ne le redemandera pas. */
  const prof = out.profile || {};
  const nom = [prof.givenName, prof.familyName].filter(Boolean).join(' ').trim();
  return { idToken: jwt, name: nom || undefined };
}

async function claimApple(jeton) {
  /* ⚠️ ON ENVOIE L'IDENTIFIANT DE L'APPAREIL AVEC. C'est lui qui dit au serveur
     QUEL pirate joue ici : sans lui, relier un compte Apple creait un joueur
     neuf et laissait les pieces, les achats et le classement derriere. */
  const body = await post('/api/apple', {
    identityToken: jeton.idToken, name: jeton.name, deviceId: deviceId(),
  });
  return {
    url: serverBase(), ws: wsFrom(serverBase()),
    token: body.token, expires: body.expires, player: body.player, google: true,
  };
}

async function codeGoogle(games, interactive) {
  /* ⚠️ PAS DE REPRISE SILENCIEUSE PAR LE GREFFON, ET CE N'EST PAS UN OUBLI. En
     mode « offline » — le seul qui rende un code pour le serveur — `isLoggedIn`
     repond « not implemented », et `login` ouvrirait une fenetre. Le demarrage
     promet justement de ne jamais mettre un mur devant le joueur : la reprise
     passe donc par la SESSION GARDEE, plus haut, qui vaut pour les deux
     plateformes. Ici, on n'agit que sur demande explicite. */
  if (!interactive) return null;
  /* ⚠️ NE PAS METTRE `forceRefreshToken: true` ICI : ca force une re-autorisation
     (ecran de consentement) dont le greffon ne recupere pas toujours le
     resultat en mode offline — la connexion RESTE BLOQUEE (rond qui tourne puis
     bouton grise, sans reponse). Le probleme du changement de compte se corrige
     ailleurs (verification de l'idToken cote serveur), pas par cette option. */
  const rep = await games.login({ provider: 'google', options: {} });
  return rep && rep.result ? rep.result : null;
}

async function claimGoogle(code, idToken) {
  /* ⛔ ON ENVOIE L'idToken AVEC LE CODE. Le serveur s'en sert pour identifier le
     compte REELLEMENT choisi : le code d'autorisation, lui, peut pointer un
     compte precedent (cache de l'AuthorizationClient). Voir google.js. */
  const body = await post('/api/google', { authCode: code, idToken, deviceId: deviceId() });
  return {
    url: serverBase(), ws: wsFrom(serverBase()),
    token: body.token, expires: body.expires, player: body.player, google: true,
  };
}

async function claimDevice() {
  const body = await post('/api/device', { deviceId: deviceId(), name: guestName() });
  return {
    url: serverBase(), ws: wsFrom(serverBase()),
    token: body.token, expires: body.expires, player: body.player, google: false,
  };
}

export async function signOut() {
  const games = plugin();
  /* ⚠️ `logout` AVANT `initialize` REPOND « Cannot find provider ». Le greffon
     ne connait ses fournisseurs qu'une fois prepare, et se deconnecter est
     souvent la premiere chose qu'on lui demande apres un lancement. */
  if (games) {
    try { await pret(); await games.logout({ provider: fournisseur() }); }
    catch (_) { /* deja dehors, ou greffon absent : rien a defaire */ }
  }
  localStorage.setItem(KEY_MODE, 'guest');
  localStorage.removeItem(KEY_SESSION);
  session = null;
}

/** Ce que les reglages affichent. Ne frappe pas le reseau. */
export function account() {
  const google = !!(session && session.google);
  const name = (session && session.player && session.player.name)
    || (google ? '' : guestName());
  return { google, name };
}

export function isSignedIn() { return !!(session && session.google); }

/**
 * Efface le compte — exigence de la fiche Play, et ce n'est pas une politesse :
 * le joueur doit pouvoir partir avec ses donnees. On efface CHEZ LE SERVEUR
 * d'abord ; le local ne sert plus a rien ensuite.
 */
export async function eraseAccount() {
  if (session && session.token) {
    try {
      /* Meme garde : un compte qu'on renomme ne doit pas figer l'ecran. */
      await fetch(serverBase() + '/api/me', {
        signal: avecDelai().signal,
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + session.token },
      });
    } catch (_) { /* hors ligne : le local part quand meme */ }
  }
  const games = plugin();
  if (games && games.signOut) { try { await games.signOut(); } catch (_) { /* rien a faire */ } }
  localStorage.removeItem(KEY_DEVICE);
  localStorage.removeItem(KEY_NAME);
  localStorage.removeItem(KEY_MODE);
  localStorage.removeItem(KEY_SESSION);
  session = null;
}

/** La session que `dice_net.js` attend — meme forme que la route du tool. */
export async function sessionForDevice() {
  if (!session || (session.expires && session.expires * 1000 < Date.now() + 60000)) {
    await signIn({ interactive: false });
  }
  if (!session) throw new Error('no session');
  return session;
}

/** Etat du service, pour l'ecran de panne. Ne leve jamais. */
export async function probeServer() {
  const base = serverBase();
  const started = Date.now();
  try {
    const r = await fetch(base + '/health', { cache: 'no-store', signal: avecDelai(3000).signal });
    if (!r.ok) return { ok: false, url: base, error: 'HTTP ' + r.status };
    return { ok: true, url: base, latency_ms: Date.now() - started, health: await r.json() };
  } catch (e) {
    return { ok: false, url: base, error: (e && e.message) || 'unreachable' };
  }
}
