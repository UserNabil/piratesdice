# srv/sql/018_maudit_seul.sql — LOT 10 #116

Nature : SQL de donnees (prix en monnaie maudite). 0 fonction — conforme. 2 UPDATE.

## a) Instructions
- UPDATE product SET basic_price=NULL, premium_price=300 WHERE category IN ('Skin','Motif') AND identify NOT IN (M005..M008) | 25
- UPDATE product SET basic_price=NULL, premium_price=NULL WHERE identify IN (M005..M008) | 30

## b) Analyse
- UPDATE parures a 300 maudites | rend les parures payables en monnaie maudite
  seulement | Cible par categorie, exclut les 4 legendaires. basic_price=NULL sur
  colonne nullable : sain. Idempotent. Pas de DELETE/DROP. | OK
- UPDATE legendaires a NULL | garde M005..M008 hors de toute bourse | Idempotent,
  redondant avec 017 mais sans effet nuisible. | OK

## c) Findings
Aucune faille. Meme observation d'ordonnancement qu'en 017 (depend de passer
apres 010_prix/012_prix_bonus) — correct en l'etat, non destructif.
