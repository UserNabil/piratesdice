# Deux prompts pour déployer une nouvelle app Android sur la Play Console

Ces prompts donnent à un agent **les mêmes accès et le même savoir** que celui qui a
publié *The Pirate's Dice*. Ils sont écrits pour être collés tels quels.

**Avant de coller quoi que ce soit — une action que seul le propriétaire du compte
peut faire :** inviter le compte de service à chacune des deux applications.

> Play Console → **Utilisateurs et autorisations** → chercher
> `claude-api-key-654@pirates-dice-506116.iam.gserviceaccount.com` → **Modifier** →
> onglet **Applications** → ajouter l'app → autorisations *Publier sur les canaux de
> test*, *Gérer les versions de production*, *Gérer la fiche Play*.

Sans cette invitation l'API répond `401` ou `404`, et l'agent ne pourra rien faire.
Le compte de service voit aujourd'hui **uniquement** `com.nabil.piratesdice`.

---

## Prompt n° 1 — application `4975170481820567544`

```
Tu déploies une application Android sur Google Play. Un agent a déjà publié une
autre app de ce compte (The Pirate's Dice) ; tout son outillage et ses pièges sont
réutilisables, et tu dois t'en servir plutôt que de repartir de zéro.

## Les identifiants

- Compte développeur : 7610471374542677978
- Application       : 4975170481820567544
- Tableau de bord   : https://play.google.com/console/u/0/developers/7610471374542677978/app/4975170481820567544/app-dashboard

## Ce dont tu disposes déjà (ne recrée RIEN de tout ça)

- Compte de service Play, avec sa clé :
  tools/eden_ultimate_tool/dice_server/mobile/signing/play-service-account.json
  (identité : claude-api-key-654@pirates-dice-506116.iam.gserviceaccount.com)
- Clé de signature d'envoi + ses mots de passe :
  tools/eden_ultimate_tool/dice_server/mobile/signing/piratesdice-upload.jks
  tools/eden_ultimate_tool/dice_server/mobile/signing/keystore.properties
  (storeFile, storePassword, keyAlias, keyPassword — une même clé d'envoi peut
  servir à plusieurs applications ; Play resigne avec SA propre clé de toute façon)
- Secrets divers (Cloudflare, R2, GitHub) : tools/eden_ultimate_tool/.secrets.json
- ⛔ Tous ces fichiers sont hors dépôt. Ne les copie JAMAIS dans un fichier suivi,
  ne les colle pas dans un message, ne les mets pas dans une URL.

## L'implémentation de référence — LIS-LA AVANT D'ÉCRIRE UNE LIGNE

- tools/eden_ultimate_tool/dice_server/mobile/play_api.py
  Client complet de l'API Play Developer v3 : JWT RS256 signé à la main, cycle
  edits → upload → tracks → listings → images, réessais sur conflit ET sur 5xx.
  Sous-commandes : --check, --listing, --details, --upload, --promote, --notes.
- tools/eden_ultimate_tool/dice_server/mobile/build.py
  Assemblage du bundle web + contrôles qui refusent une livraison cassée.
- tools/eden_ultimate_tool/dice_server/mobile/store/CONSOLE_CHECKLIST.md
  État relevé PAR L'API de tout ce que la console demande, avec les liens directs.
- tools/eden_ultimate_tool/dice_server/STATUS.md, sections 16 et 17
  Les pièges déjà payés. Relis-les : chacun a coûté une livraison ratée.

## Étape 0 — ce que tu ne peux pas deviner

L'API Play est indexée par NOM DE PAQUET, jamais par identifiant d'application.
Le numéro 4975170481820567544 ne sert qu'aux liens de la console. Commence donc par
demander à l'admin le nom de paquet (applicationId) de cette app, ou lis-le dans
android/app/build.gradle du projet concerné. Puis prouve ton accès :

    python play_api.py --check      (après avoir remplacé PACKAGE en tête du fichier)

Si tu obtiens 401/404, l'invitation du compte de service à CETTE app n'a pas été
faite : dis-le à l'admin et arrête-toi là, ne contourne rien.

## Ce que tu dois configurer

1. **Viser Android 16.** compileSdkVersion = 36 ET targetSdkVersion = 36 dans
   android/variables.gradle. Obligatoire pour toute nouvelle livraison.
   Deux comportements changent et doivent être vérifiés SUR UN APPAREIL, pas dans
   la documentation :
   - le retour prédictif devient actif : ajoute
     android:enableOnBackInvokedCallback="true" sur <application> dans le manifeste,
     sinon le bouton RETOUR ferme l'APPLICATION au lieu de la vue courante ;
   - le bord à bord est imposé : la barre d'état se superpose au contenu, et
     demander au système de ne pas la superposer est IGNORÉ depuis Android 15.
     La seule chose qui marche est une marge haute plancher :
     padding-top: max(env(safe-area-inset-top), 26px).
2. **Signature.** Réutilise le keystore ci-dessus, ou génère-en un ; dans les deux
   cas, le chemin et les mots de passe se lisent depuis signing/keystore.properties
   ou depuis des variables d'environnement, JAMAIS en dur dans le gradle.
3. **La fiche**, dans les langues visées. Titre, description courte, description
   longue, icône 512², bandeau 1024x500.
4. **Les captures se posent PAR LANGUE.** Sans cela un visiteur francophone voit la
   fiche anglaise. Et sevenInchScreenshots / tenInchScreenshots décident si Play
   juge l'app apte aux grands écrans. Le JPEG q=92 est accepté et pèse 29 % d'un
   PNG pour un écart invisible.
5. **Envoi puis promotion** : --upload sur internal, --promote sur les autres.
6. **Notes de version : 500 caractères MAXIMUM par langue.** L'envoi échoue en 403
   en nommant la langue fautive, et s'arrête à la PREMIÈRE : corrige-les toutes.

## Ce qui est IMPOSSIBLE par l'API — n'y passe pas d'heures

Mesuré, avec les erreurs exactes, dans CONSOLE_CHECKLIST.md :

- **Classification du contenu (IARC)**, **sécurité des données**, **public cible**,
  **catégorie** : console uniquement.
- **Ciblage par pays** : n'existe que sur la production, et seulement en
  déploiement progressif. Sur une version `completed` : « Country targeting is only
  supported for staged releases ». Sur la piste interne : « Track internal does not
  support country availability ». `countryAvailability` est en LECTURE SEULE.
- **Créer la piste de test ouvert** : refusée tant qu'aucun pays n'y est configuré
  (FAILED_PRECONDITION).
- **Testeurs par adresses individuelles** : seuls les groupes Google sont visibles
  et modifiables (`edits/{id}/testers/{piste}`, champ googleGroups).
- **Faire opter un testeur** : impossible par construction — c'est un consentement
  par compte Google. N'invente pas de comptes : c'est le motif exact que Google
  détecte, et la sanction est la fermeture du compte développeur.

Utilise `edits:validate` pour essayer une écriture SANS la commiter : une édition
Play n'a d'effet qu'au commit, donc tu peux sonder ce qui passe sans rien casser.

## Les pièges qui ont déjà coûté une livraison

- **Le dossier que le build assemble n'est pas celui que l'APK embarque.** Avec
  Capacitor, `www/` et `android/app/src/main/assets/public/` sont deux copies que
  seul `npx cap copy android` rapproche. L'oublier ne casse rien, n'affiche aucune
  erreur et produit un APK parfaitement valide contenant le code d'il y a une
  heure. Automatise la copie dans ton script de build.
- **`node --check fichier.js` REND 0 SUR UN FICHIER CASSÉ.** Sur un `.js` (par
  opposition à un `.mjs`) Node choisit son analyseur d'après le paquet. Trois
  apostrophes non échappées ont tué une application entière pendant que la
  vérification disait « ok ». Le seul contrôle fiable :
  `node --input-type=module --check < fichier`. Mets-le dans le build, sur chaque
  module livré.
- **Depuis Android 12, `android:background` ne fait RIEN sur l'écran d'ouverture.**
  Le système le dessine depuis `windowSplashScreenBackground` et
  `windowSplashScreenAnimatedIcon` ; la couleur réglée côté Capacitor ne vaut que
  pour les versions antérieures. Sinon le logo apparaît sur du blanc.
- **Un build.py sans `--server` remet l'adresse LAN par défaut** : l'app publiée ne
  se connecte alors à rien. Ouvre l'archive et vérifie l'adresse AVANT d'envoyer.
- **Écrire un fichier, c'est écrire PUIS remplacer.** `open(p,'w').write(s)` vide le
  fichier avant la première écriture ; une exception à ce moment-là laisse un
  fichier VIDE, pas partiel. Écris dans un `.tmp` puis `os.replace`.

## Comment tu travailles

Tu mesures, tu ne supposes pas : chaque affirmation sur l'état de la console vient
d'un appel d'API dont tu montres la réponse. Tu vérifies l'application sur un
émulateur Android 16 réel avant de publier. Tu consignes ce que tu apprends dans un
.md à côté du projet, pour que la prochaine session ne recherche pas deux fois. Et
tu demandes à l'admin AVANT toute action qu'il ne pourrait pas défaire.
```

---

## Prompt n° 2 — application `4975264627604041506`

Identique au premier, **en remplaçant les deux lignes d'identification** :

```
- Application       : 4975264627604041506
- Tableau de bord   : https://play.google.com/console/u/0/developers/7610471374542677978/app/4975264627604041506/app-dashboard
```

Tout le reste — accès, outillage, pièges, ce qui est impossible — vaut mot pour mot.

---

## Ce qu'il reste à faire à la main, pour les deux

1. **Inviter le compte de service** aux deux applications (voir en tête).
2. **Classification du contenu**, **sécurité des données**, **public cible**,
   **catégorie** : console uniquement, aucune API.
3. **Le client OAuth Android** si l'app utilise la connexion Google : il faut le
   paquet + l'empreinte SHA-1 de la clé de signature Play
   (Play Console → Intégrité de l'app → Certificat de la clé de signature).
   Un client **Web** seul ne suffit pas — c'est ce qui bloque encore la connexion
   Google de The Pirate's Dice.
