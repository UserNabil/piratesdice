# Audit — srv/sql/009_motifs.sql

Fichier : `/Users/develop/dice-server/sql/009_motifs.sql` — 43 lignes.
Nature : **migration SQL — 0 fonction**. Ajoute `player.dice_motif`, la catégorie `Motif` et 4 motifs (M001–M004). L'`ON CONFLICT DO UPDATE` **omet volontairement** le prix (fixé par 010_prix.sql).
Métrique du lot : 0. **Conforme.**

Risques évidents : **aucun**.
- Littéraux statiques, aucun secret, aucune commande shell → pas d'injection.
- Idempotent.

Observation (non-risque, bonne pratique documentée) : le commentaire (lignes 33-36) évite délibérément d'écrire `basic_price`/`premium_price` ici pour ne pas entrer en conflit avec 010_prix.sql — un seul fichier fait autorité sur le prix, ce qui supprime la dépendance à l'ordre pour ce champ.
