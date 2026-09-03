# srv/sql/013_des_couleurs.sql — LOT 10 #111

Nature : SQL de donnees (insertion de 3 skins). 0 fonction — conforme. 1
instruction INSERT ... ON CONFLICT DO UPDATE.

## a) Instructions
- INSERT INTO product (S008,S009,S010) SELECT ... JOIN product_category 'Skin' ON CONFLICT (identify) DO UPDATE | 9

## b) Analyse
- INSERT skins couleurs | ajoute 3 jeux de des cosmetiques | Idempotent via
  ON CONFLICT DO UPDATE (met enabled=true). Le prix (300/600 en dur dans le
  SELECT) est de toute facon reecrit par 010_prix ; le commentaire note que le
  prix « ne figure pas ici » alors qu'il est present dans les VALUES — divergence
  cosmetique sans effet, 010_prix tranchant. Si la categorie 'Skin' n'existe pas,
  le JOIN est vide et rien n'est insere. Pas de DELETE/DROP. | OK

## c) Findings
Aucune faille. Note cosmetique : les 300/600 ecrits dans le SELECT sont morts
(ecrases par 010_prix), le commentaire d'entete le dit lui-meme ; aucun impact.
