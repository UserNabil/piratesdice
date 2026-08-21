# Ce qu'il reste à faire — 2026-08-21

> Ce fichier annonçait encore « versionCode 3 » et un tunnel à monter, alors que
> les deux sont faits depuis. Il est réécrit à partir d'un **audit de l'API**,
> pas de mémoire. Le détail complet de la console est dans
> [`CONSOLE_CHECKLIST.md`](CONSOLE_CHECKLIST.md).

## Fait, et automatique

Dépôt GitHub, workflow, AAB signé, envoi sur la piste interne (**version 13**),
fiche en quatre langues avec captures **localisées** et captures **tablette**,
notes de version à jour. Une poussée sur `main` refait tout ça toute seule.
Le serveur de jeu répond sur `https://dice.my-officeapps.com` : l'application
marche hors du bureau.

## Il reste trois gestes, et ils sont tous à vous

L'API de publication ne les expose pas — chacun a été essayé, l'erreur est notée
dans `CONSOLE_CHECKLIST.md`.

### ① Corée du Sud — le seul point bloquant

Google a signalé le 2026-08-20 que le jeu **simule un jeu d'argent** (la mise en
pièces) et l'a retiré de Corée. Partout ailleurs, rien ne change.

**Console** → *Test* → *Test fermé* → la piste → **Pays/régions** → décocher
**Corée du Sud** → Enregistrer → *Aperçu de la publication* → envoyer à la
révision.

### ② Classification du contenu — à vérifier avant toute production

Le questionnaire IARC doit déclarer le **jeu d'argent simulé**. C'est l'origine
de l'avis. L'API ne permet pas de lire la réponse : si elle est « non », c'est
plus grave que la Corée.

### ③ Les formulaires « Contenu de l'application »

Sécurité des données · Public cible · Politique de confidentialité (l'URL doit
être renseignée là, pas seulement comme site de contact) · Publicités → **non**.

## Deux décisions qui vous appartiennent

- **La piste de test fermé porte encore la version 5** ; l'interne est à la 13.
  Vos testeurs jouent un build d'avant les capitaines.
  `python play_api.py --promote 13 --track alpha`
- **La production est vide.** Rien n'y sera envoyé sans que vous le demandiez.
