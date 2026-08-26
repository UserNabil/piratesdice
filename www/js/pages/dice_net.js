/* ============================================================================
   pages/dice_net.js — the link to the dice game server.

   The game does NOT live in this tool: it is a Node service (`eden-dice`) on the
   dev box, with its own PostgreSQL database. This module is the ONLY place that
   knows how to reach it.

   Identity: the player IS the signed-in tool user. `/api/dice/session` mints a
   short-lived HMAC token that the game server verifies; no second account, no
   second password. The token also authorises the plain REST calls (shop,
   purchase, leaderboard) — the same header the socket uses.
   ============================================================================ */

import { api } from '../core/api.js';

/* ⚠️ SIX SECONDES, ET C'EST LE SEUL SIGNE DE VIE QUI COMPTE. Cloudflare est
   devant le serveur : il tient la connexion ouverte quand l'application
   disparait et absorbe les trames de controle, si bien qu'une partie a
   continue quatre-vingt-cinq secondes contre un joueur ferme — l'adversaire
   jouait seul sans un mot. Ce battement-la traverse le proxy parce qu'il est
   dans le protocole DU JEU ; le serveur declare partie toute session muette
   trois fois de suite, et previent l'autre joueur. Douze octets toutes les six
   secondes, contre une minute et demie devant une table morte. */
const PING_MS = 6000;

export class DiceNet {
  constructor(handlers) {
    this.on = handlers || {};
    this.session = null;
    this.ws = null;
    this.pinger = null;
    this.closedByUs = false;
  }

  get ready() { return !!(this.ws && this.ws.readyState === WebSocket.OPEN); }

  /** Fetches a token, opens the socket and says hello. Resolves once welcomed. */
  async connect() {
    this.closedByUs = false;
    this.session = await api.get('/api/dice/session');

    await new Promise((resolve, reject) => {
      let settled = false;
      const done = (fn, arg) => { if (!settled) { settled = true; fn(arg); } };

      let ws;
      try { ws = new WebSocket(this.session.ws); }
      catch (e) { return done(reject, new Error('cannot reach the game server: ' + e.message)); }
      this.ws = ws;

      const guard = setTimeout(() => {
        done(reject, new Error('the game server did not answer in time'));
        try { ws.close(); } catch (_) { /* already dead */ }
      }, 8000);

      /* On annonce notre cadence : le serveur ne peut pas la deviner, et les
         versions deja distribuees ne la disent pas. */
      ws.onopen = () => this.send({ t: 'hello', token: this.session.token, pingMs: PING_MS });

      ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch (_) { return; }
        if (msg.t === 'welcome') { clearTimeout(guard); done(resolve); }
        if (msg.t === 'denied') { clearTimeout(guard); done(reject, new Error(msg.msg || 'refused')); }
        this.dispatch(msg);
      };

      ws.onerror = () => {
        clearTimeout(guard);
        done(reject, new Error('cannot reach the game server at ' + this.session.url));
      };

      ws.onclose = () => {
        clearTimeout(guard);
        this.stopPing();
        done(reject, new Error('the connection to the game server closed'));
        if (this.on.closed) this.on.closed(this.closedByUs);
      };
    });

    this.startPing();
  }

  dispatch(msg) {
    const fn = this.on[msg.t];
    if (fn) { try { fn(msg); } catch (e) { console.error('[dice] handler', msg.t, e); } }
    else if (this.on.any) this.on.any(msg);
  }

  send(payload) {
    if (!this.ready) return false;
    try { this.ws.send(JSON.stringify(payload)); return true; }
    catch (_) { return false; }
  }

  startPing() {
    this.stopPing();
    this.pinger = setInterval(() => this.send({ t: 'ping' }), PING_MS);
  }

  stopPing() {
    if (this.pinger) { clearInterval(this.pinger); this.pinger = null; }
  }

  close() {
    this.closedByUs = true;
    this.stopPing();
    if (this.ws) { try { this.ws.close(); } catch (_) { /* already closing */ } }
    this.ws = null;
  }

  /** REST call against the game server, carrying the same token as the socket. */
  async rest(path, method, body) {
    if (!this.session) throw new Error('not connected');
    const init = {
      method: method || 'GET',
      headers: { Authorization: 'Bearer ' + this.session.token },
    };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const r = await fetch(this.session.url + path, init);
    const text = await r.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : {}; } catch (_) { parsed = null; }
    if (!r.ok) throw new Error((parsed && parsed.error) || ('HTTP ' + r.status));
    return parsed || {};
  }
}

/** Health of the game service, as seen from this machine. Never throws. */
export async function diceStatus() {
  return api.getOr('/api/dice/status', { ok: false, error: 'the tool could not be reached' });
}
