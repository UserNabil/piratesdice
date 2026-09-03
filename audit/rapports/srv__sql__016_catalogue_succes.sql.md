# srv/sql/016_catalogue_succes.sql — LOT 10 #114

Nature : SQL de donnees (catalogue de 100 succes). 0 fonction — conforme. 1
instruction INSERT ... VALUES (100 lignes) ... ON CONFLICT DO UPDATE. 184 lignes,
lues en entier.

## a) Instructions
- INSERT INTO achievement (A001..A100) ... ON CONFLICT (identify) DO UPDATE | 64

## b) Analyse
- INSERT catalogue succes | pose/actualise les 100 hauts faits (famille, tally,
  cible, recompenses) | Idempotent via ON CONFLICT DO UPDATE ; rejoue a chaque
  demarrage par conception. Ne touche PAS player_achievement (les succes gagnes
  restent gagnes meme si un seuil change) — c'est le bon comportement, corrige un
  UPDATE manuel qui serait ecrase. reward_item pointe des ids produit (M0xx,
  S0xx, B0xx) sans FK : voulu (voir 015). Pas de DELETE/DROP, pas de texte
  utilisateur, pas de donnee sensible ; identifiants et nombres uniquement. | OK

## c) Findings
Aucune faille. Fichier de donnees pur, idempotent. Aucune injection possible
(valeurs litterales cotees serveur, pas d'entree client).
