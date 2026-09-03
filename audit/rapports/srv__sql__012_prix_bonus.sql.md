# srv/sql/012_prix_bonus.sql — LOT 10 #110

Nature : SQL de donnees (mise a jour de prix). 0 fonction — conforme a la
metrique du lot. 1 instruction UPDATE.

## a) Instructions
- UPDATE product SET basic_price=20, premium_price=40 WHERE category ('Bonus','Malus') | 15

## b) Analyse
- UPDATE prix effets | met tous les effets a 20/40 | UPDATE cible par
  sous-requete de categorie ; si la categorie manque, la sous-requete est vide
  et l'UPDATE ne touche rien (sans danger). Idempotent, rejoue a chaque
  demarrage par conception. Pas de DELETE/DROP. | OK

## c) Findings
Aucune faille. Fichier « autorite » de prix, rejoue au demarrage — un UPDATE
manuel en base serait ecrase, comportement documente et voulu, pas un risque.
