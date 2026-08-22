# Prompt — configurer la console Google Play sans nouvel accès

À coller à l'agent du Mac. Il travaille sur `github.com/UserNabil/piratesdice`.

**La règle qui gouverne tout ce document :** il ne demande **aucun** accès
nouveau. Le compte de service existe déjà et sa clé vit dans les secrets du
dépôt. Un agent qui réclame « le fichier JSON » ou « un nouveau compte de
service » a mal lu — et fabrique un second identifiant à révoquer un jour.

---

```
Tu configures la fiche Google Play de « The Pirate's Dice »
(paquet `com.nabil.piratesdice`) depuis le dépôt UserNabil/piratesdice.

## ⛔ La contrainte, avant tout le reste

Tu ne crées AUCUN accès. Pas de compte de service, pas de clé, pas de projet
Google Cloud. Tout existe : le secret `PLAY_SERVICE_ACCOUNT_JSON` est déjà
posé sur le dépôt, et `play_api.py` sait s'en servir.

Tu ne demandes JAMAIS qu'on te confie la clé, même « juste pour tester ». Une
clé qui sort des secrets du dépôt est une clé qu'il faudra révoquer.

Ton levier, c'est GitHub Actions : les chaînes tournent AVEC le secret, sans
jamais te le montrer.

    gh workflow run play-listing.yml     # la fiche : textes, images, contacts
    gh workflow run android-release.yml  # une version (choisis la piste)

Si `gh` n'est pas authentifié sur le Mac, l'onglet Actions du dépôt fait la
même chose à la souris (« Run workflow »).

## Ce que l'API fait, et que tu dois donc automatiser

Ces points passent par les chaînes ci-dessus. Ne les fais pas à la main :

  · titre, description courte, description longue — 4 langues (fr, en, es, ar)
  · icône 512², bandeau, captures d'écran par langue et par format
  · coordonnées : e-mail, site web
  · notes de version, par langue
  · envoi d'un AAB, et promotion d'une piste à l'autre

La source est dans `store/` : `listing.json`, `graphics/`, `screenshots/`,
`whatsnew/`. Modifier un de ces fichiers et pousser sur `main` déclenche seul
la mise à jour de la fiche — c'est le comportement voulu, ne le contourne pas.

## Ce que l'API NE FAIT PAS — et qu'un humain doit ouvrir dans le navigateur

⚠️ Ces pages n'ont AUCUN point d'entrée dans l'API Play v3. Ne cherche pas : le
temps que tu passeras à en trouver un est perdu d'avance. Prépare plutôt la
liste exacte de ce qu'il faut cliquer, et donne-la.

  · **Politique de confidentialité** (Contenu de l'application). La valeur :
        https://usernabil.github.io/piratesdice-site/privacy
    ⚠️ Une URL invalide ici a DÉJÀ coûté un rejet sur cette application.
  · **Sécurité des données** — le questionnaire de collecte
  · **Classification du contenu** — le questionnaire d'âge. Le jeu fait miser
    des pièces qui ne s'achètent pas et ne se revendent pas : c'est du
    « jeu d'argent simulé », il faut le déclarer, pas l'esquiver.
  · **Public cible**, **accès à l'application**, **publicités**
  · **Listes de testeurs** et pistes ouvertes/fermées

## L'état réel, aujourd'hui — vérifie-le, ne le crois pas

    python3 play_api.py --check

Il donne les pistes et leurs versions. Au dernier relevé : `internal` en tête,
`alpha` derrière, `beta` et `production` vides. Ne suppose rien à partir de ce
document : il vieillit, la commande non.

## Un piège qui a déjà mordu, sur ce paquet précisément

Le compte de service sert PLUSIEURS applications du même compte développeur.
`play_api.py` cible `com.nabil.piratesdice` par défaut, et le dossier `store/`
qui va avec. Les deux se changent ENSEMBLE ou pas du tout :

    PLAY_PACKAGE=com.nabil.autre PLAY_STORE_DIR=/chemin/store python3 play_api.py …

Changer l'un sans l'autre pousse l'icône, les captures et les descriptions de
The Pirate's Dice sur une autre application, sans la moindre erreur. C'est
silencieux, et ça se répare à la main, page par page.

## Ce que tu rends

Deux listes, séparées :
  1. ce que les chaînes ont fait, avec le lien du run et sa conclusion ;
  2. ce qui reste à cliquer, page par page, avec l'URL de chaque page de la
     console et la valeur exacte à y saisir.

Ne déclare rien « fait » sur la foi d'un workflow vert : `--check` interroge
Google, un run vert ne prouve que l'absence d'erreur.
```

---

## Rappel côté humain

| Action | Où |
|---|---|
| URL de confidentialité | Play Console → Contenu de l'application |
| Sécurité des données, classification d'âge | Play Console → Contenu de l'application |
| Client OAuth **Android** (paquet + SHA-1 de signature Play) | console.cloud.google.com → Identifiants |
