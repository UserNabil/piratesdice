# srv/sql/017_ornements.sql — LOT 10 #115

Nature : SQL de donnees (4 ornements non achetables). 0 fonction — conforme. 1
INSERT ... ON CONFLICT DO UPDATE + 1 UPDATE de remise a NULL.

## a) Instructions
- INSERT INTO product (M005..M008) SELECT ... JOIN category 'Motif' ON CONFLICT DO UPDATE | 17
- UPDATE product SET basic_price=NULL, premium_price=NULL WHERE identify IN (M005..M008) | 34

## b) Analyse
- INSERT ornements | ajoute 4 gravures recompenses, sans prix | Idempotent.
  basic_price/premium_price mis a NULL — colonnes nullables (001_schema.sql:28-29),
  aucun crash. enabled=true volontaire (sinon disparaissent de l'inventaire). | OK
- UPDATE remise a NULL | reannule le prix apres 010_prix | Necessaire car
  010_prix pose 300/600 sur toute la categorie Motif a chaque demarrage. Correct
  tant que l'ordre des fichiers (010 avant 017) tient. | OK

## c) Findings
Aucune faille. Observation (fragilite d'ordonnancement, non bloquante) : la
gratuite de ces 4 ornements depend de l'ordre lexicographique des migrations
toutes rejouees au demarrage (010_prix puis 017). Correct aujourd'hui ; un
renommage ou une migration intercalee les rendrait achetables en silence. Defaut
de conception documente, pas une operation destructive.
