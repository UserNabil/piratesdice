# Rapport — srv/src/index.js (52 lignes)

Point d'entrée : refuse de démarrer sans `DICE_SECRET`, crée la Gateway, monte le handler HTTP (avec filet de rattrapage), attache la WebSocket, gère l'arrêt propre et le log des rejets non gérés.

## a) Fonctions (nom | ligne)
- `shutdown` | 41
- (callbacks anonymes) createServer `(req,res)=>` | 20 ; `.catch(e=>)` | 21 ; `listen` cb | 32 ; `weightsStore.ensure().then/​.catch` | 36/38 ; `server.close(cb)` | 44 ; `pool.end().then(…, …)` | 45 ; `setTimeout(()=>)` | 47 ; handlers SIGTERM/SIGINT/unhandledRejection | 50-52

**Écart de comptage** : 1 fonction nommée (`shutdown`) contre 15 annoncées. L'écart correspond exactement aux callbacks/arrow ci-dessus comptés par la métrique auto. Fichier lu en entier.

## b) Grille par fonction
| nom | rôle | risques | statut |
|-----|------|---------|--------|
| createServer callback | délègue au handler et rattrape ses rejets | `handler(req,res).catch(...)` → 500 si `!res.headersSent` ; c'est LE filet du service | OK |
| listen callback | log de boot + charge les poids IA | `weightsStore.ensure().then().catch()` — rejet géré (log) | OK |
| shutdown | arrêt propre (gateway.close, server.close, pool.end) puis exit | `setTimeout(...).unref()` force l'exit à 5 s ; si `gateway.close()` throw sync, exception dans le handler de signal (process s'arrête de toute façon) | OK |
| unhandledRejection handler | log les rejets non gérés | avale le rejet (log seulement, pas d'exit) — résilience assumée | OK |

## c) Findings
Aucune faille. Ce fichier est le principal **facteur atténuant** des rejets async non attrapés localement dans `http.js`/`google.js` : le `.catch` global transforme toute promesse de handler rejetée en réponse 500 + `res.end`, et `process.on('unhandledRejection')` empêche un arrêt du process. Points de robustesse notables (non-failles) :

- **Garde de démarrage** (L12-15) : `DICE_SECRET` vide → `process.exit(2)`. Correct.
- **Arrêt borné** (L47) : `setTimeout(() => process.exit(0), 5000).unref()` garantit la sortie même si `server.close`/`pool.end` traînent.
- **Rejet global avalé** (L52) : `unhandledRejection` n'est que loggé — choix de résilience (ne fait pas tomber le serveur), au prix de masquer d'éventuels bugs. Acceptable pour un service de jeu.
- Cas limite mineur : si `res.headersSent` est déjà vrai quand le handler rejette (réponse partiellement écrite puis erreur), le filet ne fait que logger et la réponse peut rester tronquée — rare, non bloquant pour le process.

Statut : OK
