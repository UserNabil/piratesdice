/* ============================================================================
   core/api.js — la version mobile.

   Dans le tool, `/api/dice/session` est une route DU TOOL : c'est lui qui signe
   le jeton du joueur, parce que le joueur EST l'utilisateur connecte. Sur un
   telephone il n'y a pas de tool. Le meme appel est donc servi ici, en frappant
   directement le serveur de jeu avec le secret de l'appareil (js/identity.js).

   Consequence voulue : `dice_net.js` n'est pas modifie. Il demande une session,
   il en recoit une ; d'ou elle vient ne le regarde pas.
   ============================================================================ */

import { serverBase, sessionForDevice, probeServer } from '../identity.js';

async function get(path) {
  if (path === '/api/dice/session') return sessionForDevice();
  if (path === '/api/dice/status') return probeServer();
  const r = await fetch(serverBase() + path);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function getOr(path, fallback) {
  try { return await get(path); } catch (_) { return fallback; }
}

export const api = { get, getOr };

export function errMessage(e) {
  return (e && e.message) ? e.message : String(e);
}
