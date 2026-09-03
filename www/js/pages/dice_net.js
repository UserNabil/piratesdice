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

/* ⛔ HUIT SECONDES D'ATTENTE MUETTE COUTAIENT DES PARTIES. Quand la socket
   tombe EN PLEINE PARTIE, le seul chronometre qui compte est la fenetre de
   reprise du serveur : passe ce delai il declare forfait, et le classement
   bouge. Une garde de huit secondes y consomme un quart de la fenetre PAR
   TENTATIVE — deux essais malheureux et la table est perdue avant qu'on ait pu
   revenir. Hors partie, rien ne presse et la garde large evite de declarer
   morte une liaison lente. L'appelant dit donc ce qu'il attend. */
const GARDE_DEFAUT = 8000;

/* Combien de cadences sans un mot du serveur valent une liaison morte. Trois,
   comme cote serveur : les deux bouts mesurent la meme chose. Voir `perdue()`. */
const SILENCES_TOLERES = 3;

export class DiceNet {
  constructor(handlers) {
    this.on = handlers || {};
    this.session = null;
    this.ws = null;
    this.pinger = null;
    this.closedByUs = false;
    /* La derniere fois qu'on a entendu LE SERVEUR. Voir `perdue()`. */
    this.vu = 0;
  }

  get ready() { return !!(this.ws && this.ws.readyState === WebSocket.OPEN); }

  /* ⚠️ « OPEN » NE VEUT PAS DIRE « VIVANT ». Une socket a demi-morte — reveil
     apres veille iOS, proxy qui a lache sans trame de cloture — garde son
     readyState a OPEN alors que plus rien ne passe. `vivant` ajoute la seule
     preuve qui compte : un mot du serveur dans la derniere fenetre de silence
     toleree. C'est ce que la reprise au premier plan doit interroger, pas
     `ready`. Gratuit : une soustraction, aucun paquet emis. */
  get vivant() {
    return this.ready && (Date.now() - this.vu) < PING_MS * SILENCES_TOLERES;
  }

  /* En train de s'ouvrir : la garde de `connect()` tranchera d'elle-meme. Le
     reveil ne doit pas la remplacer — ce serait interrompre une tentative
     saine pour en relancer une identique. */
  get enCours() { return !!(this.ws && this.ws.readyState === WebSocket.CONNECTING); }

  /**
   * Fetches a token, opens the socket and says hello. Resolves once welcomed.
   *
   * `options.garde` : combien de temps on laisse au serveur pour repondre. Une
   * reprise de partie en veut une courte (voir GARDE_DEFAUT).
   */
  async connect(options) {
    this.closedByUs = false;
    this.session = await api.get('/api/dice/session');
    const garde = (options && Number(options.garde)) || GARDE_DEFAUT;

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
      }, garde);

      /* On annonce notre cadence : le serveur ne peut pas la deviner, et les
         versions deja distribuees ne la disent pas. */
      ws.onopen = () => this.send({ t: 'hello', token: this.session.token, pingMs: PING_MS });

      ws.onmessage = (ev) => {
        /* Le signe de vie du SERVEUR, quel que soit le message : un `pong`, un
           instantane de partie, une annonce. Voir `perdue()`. */
        this.vu = Date.now();
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

  /* ⛔ ON PARLAIT SANS JAMAIS VERIFIER QU'ON ETAIT ENTENDU, et c'est ainsi
     qu'une partie se perdait sans qu'aucun des deux cotes n'ait tort.

     Le serveur, lui, a sa mesure : trois silences et il termine la session
     (SILENCE_DEFAUT). Le telephone n'en avait aucune. Or une socket a demi
     morte — le cas ordinaire d'un passage wifi vers 4G, d'un tunnel, d'un
     changement de cellule — ne rend PAS d'erreur : `ws.send()` met la trame
     dans un tampon et repond vrai, `readyState` reste OPEN, et `onclose`
     n'arrive jamais parce que le paquet qui l'annoncerait ne traverse plus.

     Resultat, vu de l'exterieur : le serveur declare la session muette, range
     la table, lance la pendule de reprise et finit par declarer forfait — pendant
     que le telephone, persuade d'etre connecte, n'a pas lance la moindre
     tentative de reconnexion. « Ejecte du serveur et n'a pas pu la reprendre. »
     La fenetre de reprise ne servait a rien : personne ne s'en servait.

     On adopte donc la MEME regle que le serveur, dans l'autre sens : toute
     trame recue est un signe de vie (le `pong` en est un, les instantanes de
     partie aussi), et trois cadences sans un mot valent une liaison morte. On
     ferme alors nous-memes, ce qui declenche `closed` — donc le chemin normal
     de la relance, celui qui sait deja quoi faire. */
  startPing() {
    this.stopPing();
    this.vu = Date.now();
    this.pinger = setInterval(() => {
      if (Date.now() - this.vu > PING_MS * SILENCES_TOLERES) return this.perdue();
      this.send({ t: 'ping' });
    }, PING_MS);
  }

  /**
   * La liaison ne repond plus. On la termine soi-meme.
   *
   * ⚠️ `closedByUs` RESTE FAUX : ce n'est pas le joueur qui part, c'est la
   * liaison qui est morte. Le gestionnaire `closed` doit donc relancer, comme
   * pour n'importe quelle coupure — le marquer comme voulu ferait exactement le
   * contraire de ce qu'on cherche.
   */
  perdue() {
    this.stopPing();
    const ws = this.ws;
    this.ws = null;
    if (!ws) return;
    /* ⚠️ ON DETACHE AVANT DE FERMER. Une socket a demi morte peut rendre son
       `close` bien plus tard — parfois apres qu'une NOUVELLE liaison a ete
       etablie. Le gestionnaire du jeu, lui, ne fait pas la difference : il
       remettrait `S.net` a null et jetterait la liaison neuve. La sortie est
       prise ici, une seule fois. */
    ws.onclose = null; ws.onmessage = null; ws.onerror = null; ws.onopen = null;
    try { ws.close(); } catch (_) { /* deja morte */ }
    if (this.on.closed) this.on.closed(false);
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
      /* ⚠️ RIEN DE CE QUI PASSE PAR ICI NE SE GARDE. Bourse, inventaire,
         classement : ce sont des etats qui bougent pendant qu'on joue. Une
         reponse relue dans le cache de la coque montre le monde d'il y a une
         minute, et c'est exactement ce qu'on est venu verifier. */
      cache: 'no-store',
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
