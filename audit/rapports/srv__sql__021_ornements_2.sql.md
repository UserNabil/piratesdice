# srv/sql/021_ornements_2.sql — LOT 10 #119

Nature : SQL de donnees (4 ornements de plus). 0 fonction — conforme. 1 INSERT
... ON CONFLICT DO UPDATE + 1 UPDATE de remise a NULL. Meme patron que 017.

## a) Instructions
- INSERT INTO product (M009..M012) SELECT ... JOIN category 'Motif' ON CONFLICT DO UPDATE | 21
- UPDATE product SET basic_price=NULL, premium_price=NULL WHERE identify IN (M009..M012) | 34

## b) Analyse
- INSERT ornements 2 | ajoute 4 gravures recompenses non achetables | Idempotent.
  Prix NULL sur colonnes nullables : sain. enabled=true volontaire (inventaire). | OK
- UPDATE remise a NULL | reannule apres 010_prix | Correct tant que 010 passe
  avant. Idempotent. | OK

## c) Findings
Aucune faille. Meme observation d'ordonnancement non bloquante qu'en 017
(gratuite dependante de l'ordre des migrations rejouees). Non destructif.
