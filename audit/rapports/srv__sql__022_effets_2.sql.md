# srv/sql/022_effets_2.sql — LOT 10 #120

Nature : SQL de donnees (6 effets B006..B011). 0 fonction — conforme. 1 INSERT
... ON CONFLICT DO UPDATE + 2 UPDATE. 75 lignes, lues en entier.

## a) Instructions
- INSERT INTO product (B006..B011) SELECT ... JOIN category v.category ON CONFLICT DO UPDATE | 28
- UPDATE product SET enabled=true WHERE identify IN (B006..B011) | 65
- UPDATE product SET basic_price=20, premium_price=40 WHERE category IN ('Bonus','Malus') | 74

## b) Analyse
- INSERT effets | (re)definit 6 effets ; B006 change de sens en gardant son id |
  Idempotent via ON CONFLICT DO UPDATE. La redefinition de B006 (vol de tour ->
  gel de colonne) conserve l'id : les inventaires des joueurs restent valides,
  l'objet fait juste autre chose. Aucune migration de donnees joueur, aucune
  perte. Categorie resolue par JOIN sur v.category ; si une categorie manque, la
  ligne n'est pas inseree (pas de crash). | OK
- UPDATE enabled=true | active les 6 effets | Idempotent. | OK
- UPDATE prix 20/40 | reapplique le prix apres l'ON CONFLICT qui a remis 100/900 |
  Necessaire car 012_prix_bonus passe avant et l'ON CONFLICT ci-dessus reecrit
  100/900 ; sans cette derniere ligne les 6 effets couteraient 5x le prix des
  autres. Idempotent. Pas de DELETE/DROP. | OK

## c) Findings
Aucune faille. Observation d'ordonnancement (comme 017/021) : la coherence du
prix depend de l'ordre des migrations rejouees, ici auto-corrigee par la
derniere ligne du fichier. Etat correct, non destructif, pas de donnee sensible.
