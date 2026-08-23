# assets/ — LA SOURCE UNIQUE DES ICONES ET DU RIDEAU

Ces cinq fichiers ne sont lus par aucun code : ce sont les ENTREES de
`capacitor-assets`, qui en tire l'icone et le rideau **des deux boutiques**.

    npx capacitor-assets generate --android --ios

⚠️ **NE JAMAIS LANCER `generate` SANS `--android --ios`.** Sans les drapeaux il
produit en plus une sortie PWA (`icons/`, `www/manifest.json`) dont ce projet n'a
aucun usage, et qui part alors dans les deux applications comme poids mort.

⚠️ **CES FICHIERS ONT DEJA MENTI UNE FOIS.** Ils portaient un DE en os alors que
les deux applications livraient le CRANE : regenerer les icones aurait remplace
la marque du jeu sans qu'aucun test ne s'en apercoive. Ils sont desormais
composes a partir de `www/dice/img/brand_mark.png`, qui est la marque, avec les
fonds releves dans les ressources Android — `#4A3079` pour l'icone, `#241C33`
pour le rideau.

| fichier | ce qu'il devient |
|---|---|
| `icon.png` | l'icone iOS (1024, sans transparence — Apple la refuse avec) |
| `icon-foreground.png` + `icon-background.png` | l'icone adaptative d'Android |
| `splash.png` / `splash-dark.png` | le rideau des deux plateformes |

Le crane occupe 70 % du carre pour l'icone iOS, 52 % pour le dessin adaptatif
d'Android — le systeme y rogne un cercle, et une part plus grande lui couperait
les oreilles.
