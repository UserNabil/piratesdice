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

/* ── Google Play Games : le module natif, s'il est la ────────────────────── */

function plugin() {
  const cap = window.Capacitor;
  return (cap && cap.Plugins && cap.Plugins.PlayGames) || null;
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
      const out = await games.signIn({ interactive });
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
  if (games && games.signOut) { try { await games.signOut(); } catch (_) { /* deja dehors */ } }
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
