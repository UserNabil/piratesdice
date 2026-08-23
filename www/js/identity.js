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

const CREWS = ['Barbarossa', 'Anne Bonny', 'Blackbeard', 'Calico Jack', 'Mary Read',
  'Long John', 'Grace O\'Malley', 'Ching Shih', 'Henry Every', 'Bartholomew'];

let session = null;                  // { url, ws, token, expires, player }

export function serverBase() {
  const baked = (window.PD_CONFIG && window.PD_CONFIG.server) || '';
  return baked.replace(/\/+$/, '');
}

function wsFrom(base) {
  if (base.startsWith('https://')) return 'wss://' + base.slice(8) + '/ws';
  if (base.startsWith('http://')) return 'ws://' + base.slice(7) + '/ws';
  return base + '/ws';
}

async function post(path, body) {
  const r = await fetch(serverBase() + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
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
    prepare = p.initialize({
      google: { webClientId: CLIENT_WEB, mode: 'offline' },
      /* Apple ne demande aucun identifiant cote application : le systeme sait
         deja quelle application le demande, et c'est le serveur qui verifie que
         le jeton lui etait bien destine. */
      apple: {},
    });
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
          session = await claimApple(jeton);
          localStorage.setItem(KEY_MODE, 'google');
          return session;
        }
      }
      const out = fournisseur() === 'apple' ? null : await codeGoogle(games, interactive);
      if (out && out.serverAuthCode) {
        session = await claimGoogle(out.serverAuthCode);
        localStorage.setItem(KEY_MODE, 'google');
        return session;
      }
    } catch (e) {
      if (interactive) throw new Error(e && e.message ? e.message : 'Google sign-in failed');
      /* silencieux : on ne bloque pas l'ouverture du jeu pour ca */
    }
  }

  session = await claimDevice();
  localStorage.setItem(KEY_MODE, 'guest');
  return session;
}

/**
 * Le code d'autorisation, silencieusement si possible.
 *
 * ⚠️ UNE FENETRE DE CONNEXION AU DEMARRAGE EST UN MUR, et le demarrage promet le
 * contraire. On ne tente donc la reprise que si le telephone a DEJA accorde un
 * compte a cette application : le joueur ne voit alors rien passer. La fenetre
 * ne s'ouvre que lorsqu'il l'a demandee lui-meme, depuis les reglages.
 */
async function jetonApple(p) {
  const rep = await p.login({ provider: 'apple', options: { scopes: ['name'] } });
  const out = rep && rep.result ? rep.result : null;
  if (!out || !out.idToken) return null;
  /* ⚠️ APPLE NE DONNE LE NOM QU'A LA PREMIERE CONNEXION, jamais ensuite. On le
     transmet s'il vient ; le serveur ne le redemandera pas. */
  const prof = out.profile || {};
  const nom = [prof.givenName, prof.familyName].filter(Boolean).join(' ').trim();
  return { idToken: out.idToken, name: nom || undefined };
}

async function claimApple(jeton) {
  const body = await post('/api/apple', { identityToken: jeton.idToken, name: jeton.name });
  return {
    url: serverBase(), ws: wsFrom(serverBase()),
    token: body.token, expires: body.expires, player: body.player, google: true,
  };
}

async function codeGoogle(games, interactive) {
  if (!interactive) {
    if (!games.isLoggedIn) return null;
    const deja = await games.isLoggedIn({ provider: 'google' }).catch(() => null);
    if (!deja || !deja.isLoggedIn) return null;
  }
  const rep = await games.login({ provider: 'google', options: {} });
  return rep && rep.result ? rep.result : null;
}

async function claimGoogle(code) {
  const body = await post('/api/google', { authCode: code });
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
  if (games) { try { await games.logout({ provider: fournisseur() }); } catch (_) { /* deja dehors */ } }
  localStorage.setItem(KEY_MODE, 'guest');
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
      await fetch(serverBase() + '/api/me', {
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
    const r = await fetch(base + '/health', { cache: 'no-store' });
    if (!r.ok) return { ok: false, url: base, error: 'HTTP ' + r.status };
    return { ok: true, url: base, latency_ms: Date.now() - started, health: await r.json() };
  } catch (e) {
    return { ok: false, url: base, error: (e && e.message) || 'unreachable' };
  }
}
