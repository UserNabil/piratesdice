# Avant de lancer les testeurs payés

Deux applications : **The Pirate's Dice** (`4975621758251689754`, déjà en test
fermé) et l'**app pirate** (l'un des deux nouveaux identifiants). Compte
développeur : `7610471374542677978`.

---

## Partie 1 — The Pirate's Dice : ce qui est mesuré, et ce qui reste

### Mesuré par l'API le 2026-08-21, après la version 21

| Maillon de la chaîne | État |
|---|---|
| Binaire sur la piste **test fermé** | ✅ v21, statut `completed`, **tous pays** |
| Binaire sur la piste **test interne** | ✅ v21 |
| Notes de version | ✅ 4 langues (ar, en-US, es-ES, fr-FR) |
| Fiche : titre + descriptions | ✅ complète dans les 4 langues |
| Captures téléphone / 7″ / 10″ | ✅ 5 + 5 + 5 dans **chacune** des 4 langues |
| Icône 512² + bandeau 1024×500 | ✅ (posés sur la langue par défaut, Play y retombe) |
| Serveur de jeu joignable | ✅ `https://dice.my-officeapps.com` répond, base `up` |
| Adresse gravée dans l'APK envoyé | ✅ pointe bien sur la production, **aucune** adresse LAN |
| Cible Android | ✅ API 36 (Android 16) |
| Groupes Google sur les pistes | ❌ **aucun** — les testeurs sont gérés en liste d'adresses |

### Ce que l'API ne peut PAS voir, et qu'il faut ouvrir soi-même

Un binaire « accepté » n'est pas un binaire « disponible » : Play peut le garder
en revue, et les déclarations de contenu incomplètes bloquent la mise à
disposition **même sur une piste fermée**. Ces quatre pages tranchent.

**1. Aperçu de la publication — la page qui dit ce qui bloque**
https://play.google.com/console/u/0/developers/7610471374542677978/app/4975621758251689754/publishing

> Elle liste les modifications *en attente de revue*. Si la version 21 y apparaît
> encore, aucun testeur ne l'a. C'est la première page à ouvrir, avant toutes les
> autres.

**2. Contenu de l'application — tout doit être vert**
https://play.google.com/console/u/0/developers/7610471374542677978/app/4975621758251689754/app-content

Les sous-pages, directement :

| Déclaration | URL |
|---|---|
| Classification du contenu (IARC) | …/app-content/rating |
| Sécurité des données | …/app-content/data-privacy-security |
| Public cible et contenu | …/app-content/target-audience |

> ⚠️ Le questionnaire IARC : ce jeu comporte des **mises en monnaie de jeu, sans
> achat ni gain réel**. Répondre « non » à « jeux d'argent réels » et « oui » à
> « éléments de jeu simulés » — c'est ce qui a déjà valu un avertissement Google
> sur le jeu simulé, réglé en retirant la Corée du Sud.

**3. Statut des règles — s'il reste un avertissement ouvert**
https://play.google.com/console/u/0/developers/7610471374542677978/app/4975621758251689754/policy-status

**4. Test fermé — la liste des testeurs et le lien d'opt-in**
https://play.google.com/console/u/0/developers/7610471374542677978/app/4975621758251689754/tracks/closed-testing

> Onglet **Testeurs** : y coller les adresses Gmail des testeurs payés (une liste
> d'adresses, ou un groupe Google). Puis **copier le lien d'opt-in** en bas de la
> page — c'est CE lien qu'ils doivent ouvrir, connectés au compte Google qu'ils
> t'ont donné. Sans ce clic, ils n'apparaissent pas dans le décompte des 12.
>
> Vérifier aussi **Pays/régions** :
> …/tracks/closed-testing/countries — la Corée du Sud doit rester exclue.

### Ce qui reste cassé, et que je ne peux pas réparer sans toi

**La connexion Google échoue dans l'app.** Seul le client OAuth **Web** existe ;
il manque le client **Android**, qui exige le nom de paquet et l'empreinte SHA-1
de la clé de signature Play.

1. Relever l'empreinte :
   https://play.google.com/console/u/0/developers/7610471374542677978/app/4975621758251689754/app-integrity
   → *Certificat de la clé de signature de l'application* → copier le **SHA-1**.
2. La déclarer : https://console.cloud.google.com/apis/credentials?project=pirates-dice-506116
   → **Créer des identifiants** → *ID client OAuth* → type **Android** →
   nom de package `com.nabil.piratesdice` + le SHA-1 relevé.

Tant que ce client n'existe pas, les testeurs pourront jouer en invité mais pas
lier leur compte Google. **À faire avant de les payer** : c'est le premier
bouton qu'ils vont essayer.

**La piste de test OUVERT est vide** et l'API refuse de la créer tant qu'aucun
pays n'y est configuré. Si les testeurs payés utilisent un lien de test *ouvert*,
il faut d'abord la créer ici :
https://play.google.com/console/u/0/developers/7610471374542677978/app/4975621758251689754/tracks/open-testing

---

## Partie 2 — L'app pirate : ce que tu fais AVANT de lancer l'agent

L'agent ne peut rien faire tant que le compte de service n'est pas invité sur
cette application. Le compte de service ne voit aujourd'hui **que**
`com.nabil.piratesdice`.

**Page :** https://play.google.com/console/u/0/developers/7610471374542677978/users-and-permissions

1. Chercher `claude-api-key-654@pirates-dice-506116.iam.gserviceaccount.com`
2. **Modifier** → onglet **Applications** → **Ajouter une application** →
   choisir l'app pirate
3. Cocher : *Publier sur les canaux de test*, *Gérer les versions de production*,
   *Gérer la fiche Play et les prix*
4. **Inviter / Enregistrer**

Puis relève **le nom de paquet** de l'app pirate (Tableau de bord → en haut sous
le nom, ou dans `android/app/build.gradle` du projet) : l'API Play est indexée par
nom de paquet, **jamais** par l'identifiant numérique de la console.

---

## Partie 3 — Le prompt pour l'agent

Colle ceci tel quel, après avoir remplacé les deux valeurs entre chevrons.

```
Tu prépares une application Android à un test fermé PAYÉ sur Google Play. Des
testeurs vont être rémunérés pour l'installer : une configuration incomplète leur
fait perdre leur temps et coûte de l'argent à l'admin. Tu vérifies donc chaque
maillon par une MESURE, jamais par une supposition.

## Cible

- Compte développeur : 7610471374542677978
- Application        : <IDENTIFIANT DE L'APP PIRATE>
- Nom de paquet      : <applicationId, ex. com.nabil.xxx>
- Tableau de bord    : https://play.google.com/console/u/0/developers/7610471374542677978/app/<IDENTIFIANT>/app-dashboard

## Accès dont tu disposes (ne recrée RIEN)

- Compte de service Play :
  tools/eden_ultimate_tool/dice_server/mobile/signing/play-service-account.json
  (claude-api-key-654@pirates-dice-506116.iam.gserviceaccount.com)
- Clé de signature d'envoi et ses mots de passe :
  tools/eden_ultimate_tool/dice_server/mobile/signing/piratesdice-upload.jks
  tools/eden_ultimate_tool/dice_server/mobile/signing/keystore.properties
  Une même clé d'envoi peut servir plusieurs applications ; Play resigne avec la
  sienne de toute façon.
- Autres secrets : tools/eden_ultimate_tool/.secrets.json
- ⛔ Ces fichiers sont hors dépôt. Ne les copie jamais dans un fichier suivi, ne
  les colle pas dans un message, ne les mets pas dans une URL.

## L'outillage à réutiliser — LIS-LE AVANT D'ÉCRIRE UNE LIGNE

- dice_server/mobile/play_api.py — client complet de l'API Play Developer v3 :
  JWT RS256 signé à la main, cycle edits → upload → tracks → listings → images,
  réessais sur conflit ET sur 5xx. Sous-commandes : --check, --listing,
  --details, --upload, --promote, --notes.
- dice_server/mobile/build.py — assemblage du bundle + deux contrôles qui
  refusent une livraison cassée (voir « pièges » plus bas).
- dice_server/mobile/store/CONSOLE_CHECKLIST.md — état relevé PAR L'API de tout
  ce que la console demande, avec les liens directs.
- dice_server/mobile/store/AVANT_LES_TESTEURS.md — la marche à suivre côté
  console, celle-là même dont ce prompt est issu.
- dice_server/STATUS.md, sections 16 et 17 — les pièges déjà payés.

## Étape 0 — prouve ton accès avant tout le reste

Remplace PACKAGE en tête de play_api.py par le nom de paquet ci-dessus, puis :

    python play_api.py --check

Un 401 ou un 404 signifie que le compte de service n'a pas été invité sur CETTE
application. Dis-le à l'admin, donne-lui l'URL
https://play.google.com/console/u/0/developers/7610471374542677978/users-and-permissions
et ARRÊTE-TOI. Ne contourne rien.

## Ce que tu configures

1. **Viser Android 16.** compileSdkVersion = 36 ET targetSdkVersion = 36 dans
   android/variables.gradle — obligatoire pour toute nouvelle livraison. Deux
   comportements changent, et tu les vérifies SUR UN ÉMULATEUR API 36 RÉEL :
   - retour prédictif actif par défaut : sans
     android:enableOnBackInvokedCallback="true" sur <application>, le bouton
     RETOUR ferme l'APPLICATION au lieu de la vue courante ;
   - bord à bord imposé : la barre d'état se superpose au contenu, et demander au
     système de ne pas la superposer est IGNORÉ depuis Android 15. La seule chose
     qui marche : padding-top: max(env(safe-area-inset-top), 26px).
2. **Signature** : chemin et mots de passe lus depuis keystore.properties ou des
   variables d'environnement, jamais en dur dans le gradle.
3. **La fiche**, dans les langues visées : titre, description courte, description
   longue, icône 512², bandeau 1024×500.
4. **Les captures se posent PAR LANGUE**, et dans les trois formats
   (phoneScreenshots, sevenInchScreenshots, tenInchScreenshots) : ce sont les
   deux derniers qui décident si Play juge l'app apte aux grands écrans. JPEG
   q=92 accepté, 29 % du poids d'un PNG pour un écart invisible.
5. **Envoi puis promotion** : --upload sur internal, --promote vers alpha.
6. **Notes de version : 500 caractères MAXIMUM par langue.** L'envoi échoue en
   403 en nommant la langue fautive et s'arrête à la PREMIÈRE : corrige-les
   toutes d'un coup.
7. **Avant de déclarer que c'est prêt**, ouvre l'AAB que tu viens d'envoyer et
   vérifie les URL qu'il contient. Une adresse LAN qui traîne, et l'app ne se
   connecte à rien chez le testeur.

## Ce qui est IMPOSSIBLE par l'API — n'y passe pas la nuit

Mesuré, avec les erreurs exactes, dans CONSOLE_CHECKLIST.md :

- Classification du contenu (IARC), sécurité des données, public cible,
  catégorie : console uniquement.
- Ciblage par pays : n'existe que sur la production, et seulement en déploiement
  progressif. Sur une version `completed` : « Country targeting is only supported
  for staged releases ». Sur la piste interne : « Track internal does not support
  country availability ». `countryAvailability` est en LECTURE SEULE.
- Créer la piste de test ouvert : refusée tant qu'aucun pays n'y est configuré
  (FAILED_PRECONDITION).
- Testeurs : seuls les groupes Google sont lisibles et modifiables
  (edits/{id}/testers/{piste}, champ googleGroups). Les listes d'adresses
  individuelles ne sont visibles que dans la console.
- Faire opter un testeur : impossible par construction, c'est un consentement par
  compte Google. N'invente jamais de comptes — c'est le motif que Google détecte,
  et la sanction est la fermeture du compte développeur.

Utilise edits:validate pour essayer une écriture SANS la commiter : une édition
Play n'a d'effet qu'au commit, donc tu peux sonder ce qui passe sans rien casser.

## Les pièges qui ont déjà coûté une livraison

- **Le dossier que le build assemble n'est pas celui que l'APK embarque.** Avec
  Capacitor, www/ et android/app/src/main/assets/public/ sont deux copies que
  seul `npx cap copy android` rapproche. L'oublier ne casse rien, n'affiche
  aucune erreur, et produit un APK parfaitement valide contenant le code d'il y a
  une heure. Automatise la copie dans le build.
- **`node --check fichier.js` REND 0 SUR UN FICHIER CASSÉ.** Sur un .js (par
  opposition à un .mjs) Node choisit son analyseur d'après le paquet. Trois
  apostrophes non échappées ont tué une application entière pendant que la
  vérification disait « ok ». Le seul contrôle fiable :
  `node --input-type=module --check < fichier`. Mets-le dans le build, sur chaque
  module livré.
- **Depuis Android 12, android:background ne fait RIEN sur l'écran d'ouverture.**
  Le système le dessine depuis windowSplashScreenBackground et
  windowSplashScreenAnimatedIcon ; la couleur réglée côté Capacitor ne vaut que
  pour les versions antérieures. Sinon le logo apparaît sur du blanc.
- **Écrire un fichier, c'est écrire PUIS remplacer.** open(p,'w').write(s) vide
  le fichier avant la première écriture ; une exception à ce moment-là laisse un
  fichier VIDE, pas partiel. Écris dans un .tmp puis os.replace.
- **Un z-index ne se compare qu'entre frères du même contexte d'empilement.** Un
  parent qui porte un filter ou un transform crée son propre contexte et peut
  recouvrir un enfant au z-index élevé.

## Ce que tu rends à la fin

Un tableau, une ligne par maillon de la chaîne que parcourt un testeur — reçoit
le lien, opte, le Store lui propose la version — avec pour chaque ligne la
réponse d'API qui le prouve, et le nom du premier maillon qui casse s'il y en a
un. Puis la liste des pages de console que l'admin doit ouvrir lui-même, avec
leur URL directe.

Tu demandes à l'admin AVANT toute action qu'il ne pourrait pas défaire.
```
