# PROTOCOLE D'AUDIT — à suivre à la lettre. NE CORRIGE RIEN.

Tu audites un LOT de fichiers listé dans `/Users/develop/piratesdice/audit/lots/lot_NN.txt`
(format : `#<tab>chemin<tab>lignes<tab>nb_fonctions`, un fichier par ligne).

MAPPING DES CHEMINS :
- `pd/xxx`  → `/Users/develop/piratesdice/xxx`
- `srv/xxx` → `/Users/develop/dice-server/xxx`

Pour CHAQUE fichier du lot, dans l'ordre :
1. Lis-le EN ENTIER si < 300 lignes. Si ≥ 300 lignes, lis-le par tranches de
   200 lignes (offset/limit) jusqu'au bout. Jamais de lecture partielle
   silencieuse.
2. Recense TOUTES les fonctions/méthodes : nom + ligne de début. Compte-les.
   Si ton compte diffère du `nb_fonctions` du lot, signale l'écart dans le
   rapport et recompte (la métrique auto est approximative — `=>` et méthodes
   la gonflent ; note l'écart, ne bloque pas).
3. Applique à CHAQUE fonction cette grille (8 points) :
   1) Exception jetée dedans : attrapée où ? Si nulle part → FAILLE.
   2) Async/Promise : rejet géré ? `await` manquant ? `.catch()` présent ?
   3) Callback différé (setTimeout/later/queue/interval) : corps protégé ?
   4) Entrées validées ? Que fait un argument null/undefined/hors bornes/
      envoyé par un client hostile ?
   5) Sortie d'erreur : le joueur / la partie reste-t-il BLOQUÉ si ça échoue ?
   6) Ressources (timer, listener, connexion, fichier, socket) libérées ?
   7) État partagé : deux appels concurrents cassent-ils un invariant ?
   8) Retour d'erreur ignoré par l'appelant ?

RAPPORT : écris `/Users/develop/piratesdice/audit/rapports/<chemin-aplati>.md`
où `<chemin-aplati>` = le chemin du fichier avec les `/` remplacés par `__`
(ex : `srv/src/game/match.js` → `srv__src__game__match.js.md`). Il contient :
  a) Liste de TOUTES les fonctions : `nom | ligne`.
  b) Par fonction : `nom | rôle en 1 phrase | risques (ou "aucun") | statut (OK/FAILLE)`.
  c) Findings détaillés : pour chaque faille, `chemin:ligne`, gravité
     (crash process / partie bloquée / état incohérent / fuite ressource /
     cosmétique), l'extrait de code fautif, et pourquoi c'est un risque.

Fichier sans fonction (i18n, données, HTML statique, SQL de données, YAML) :
rapport court « 0 fonction — <nature du fichier> », et signale tout de même un
risque évident s'il y en a (injection, secret en clair, commande dangereuse).

INTERDITS :
- Ne passe jamais au fichier suivant sans avoir écrit son rapport.
- Ne dis jamais « les autres sont similaires » / « le reste suit le pattern ».
- Ne corrige RIEN.

RÉPONSE FINALE (uniquement) : une ligne par fichier :
`#<num> <chemin> -> OK`  ou  `#<num> <chemin> -> FAILLES(<n>) [gravité max]`.
Rien d'autre — les rapports détaillés sont dans les fichiers.
Si tu manques de contexte avant la fin : dis exactement quels fichiers du lot
sont faits et lequel est le prochain. Ne compresse jamais pour « finir ».
