# srv/sql/028_effets_3.sql

0 fonction — migration SQL de DONNEE (INSERT ... ON CONFLICT DO UPDATE + UPDATE), rejouable.
Ecart avec le lot (nb_fonctions=0) : conforme.

## Contenu
- `INSERT INTO product (...) SELECT ... FROM (VALUES ...) JOIN product_category ON CONFLICT (identify) DO UPDATE` (l.20-47)
- `UPDATE product SET enabled=true WHERE identify IN ('B012'..'B016')` (l.49-50)
- `UPDATE product SET basic_price=20, premium_price=40 WHERE category_id IN (SELECT ... 'Bonus','Malus')` (l.53-54)

## Risques
- Valeurs litterales, aucune entree client : pas d'injection.
- Idempotent (upsert). A noter : le dernier UPDATE (l.53-54) ecrase les prix 100/900
  du VALUES par 20/40 pour TOUTE la categorie Bonus/Malus ; c'est intentionnel
  (« Le prix des effets est aligne sur les autres ») et non une incoherence.

## Statut : OK
