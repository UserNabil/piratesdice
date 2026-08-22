# Prompt — porter The Pirate's Dice sur iOS et le déployer

À coller à l'agent qui travaille sur le Mac. Le dépôt est déjà là, la moitié du
travail aussi : il ne reste que la coque native et la chaîne de publication.

---

```
Tu portes « The Pirate's Dice » sur iOS et tu montes la chaîne qui le publiera
sans toi. Le dépôt : github.com/UserNabil/piratesdice, branche main.

## Ce qui existe déjà — ne le refais pas

  build.py                  assemble le bundle web dans www/ ET le copie dans le
                            projet natif, puis REFUSE de livrer si un module JS
                            ne se parse pas ou si un chemin ne résout pas
  www/                      le jeu, prêt : HTML, CSS, JS, images
  capacitor.config.json     Capacitor 7 — SplashScreen et StatusBar déclarés
  android/                  la coque Android, déjà publiée (versionCode 30)
  .github/workflows/android-release.yml   la CI Android : à chaque poussée sur
                            main, build signé et envoi sur la piste interne
  play_api.py               l'envoi chez Google, le même outil à la main et en CI

Le jeu est un client web dans une WebView. Le portage iOS ne réécrit RIEN du jeu :
il ajoute une seconde coque native autour du même www/.

    npx cap add ios
    python build.py --server https://dice.my-officeapps.com --build <n>
    npx cap copy ios

## Étape 0 — ce que tu ne peux pas faire seul, et qu'il faut demander

Ces quatre points passent par un humain avec le compte Apple. Demande-les AVANT
de commencer, en une seule fois :

1. Adhésion au Apple Developer Program active (99 $/an). Sans elle, rien.
2. L'app créée dans App Store Connect, bundle id `com.nabil.piratesdice`.
3. Une clé API App Store Connect (Users and Access → Integrations → App Store
   Connect API), rôle App Manager. Elle donne trois choses : le fichier .p8, le
   Key ID, l'Issuer ID. C'est elle qui rend la CI possible — sans elle, chaque
   envoi demande un Xcode ouvert et un humain devant.
4. Le certificat de distribution et le profil de provisionnement, OU l'accord
   pour utiliser la signature automatique Xcode avec le compte.

Si l'un manque, dis-le et arrête-toi. Ne contourne pas : une signature bricolée
se paie au premier envoi.

## Les six pièges qui vont mordre, et pourquoi

Ils ne sont pas théoriques : ce sont les écarts réels entre WKWebView et Chrome.

1. **Les marges d'encoche : déjà en place, NE Y TOUCHE PAS.**
   `www/index.html` porte bien `viewport-fit=cover`, et le CSS utilise
   `env(safe-area-inset-*)` partout — vérifié. Sans ce drapeau, ces variables
   valent 0 sur iOS et l'interface passe sous l'encoche en silence. Contente-toi
   de vérifier À L'ÉCRAN que l'en-tête reste dégagée.

2. **Le rebond de la page.** WKWebView fait rebondir tout le document au
   défilement, y compris quand rien ne défile — le plateau « décolle » du haut
   de l'écran. Mets `scrollEnabled = false` sur la WebView (config Capacitor
   `ios.scrollEnabled: false`), pas un `overflow: hidden` en CSS : le CSS ne
   contrôle pas le rebond natif.

3. **Le son au premier geste, pas avant.** iOS refuse toute lecture audio
   tant que l'utilisateur n'a pas touché l'écran, et la refuse *silencieusement* :
   pas d'erreur, pas de son. Le jeu joue des effets au lancer et à la pose —
   amorce le contexte audio sur le PREMIER contact, sinon un joueur peut faire
   une partie entière en silence sans comprendre pourquoi.

4. **Sign in with Apple, si tu offres une connexion tierce.** Directive 4.8 :
   une app qui propose un identifiant social DOIT proposer Sign in with Apple à
   égalité. Le jeu marche en invité et la connexion Google n'est pas encore
   branchée sur iOS — donc ne branche PAS Google sur iOS sans ajouter Apple en
   même temps, sinon rejet garanti.

5. **La suppression de compte doit être DANS l'app.** Apple l'exige depuis 2022.
   Elle existe déjà : ⚙ Réglages → « Effacer mes données et mon compte ». Vérifie
   qu'elle fonctionne sur iOS avant d'envoyer, c'est un motif de rejet fréquent.

6. **Le manifeste de confidentialité.** Depuis mai 2024, `PrivacyInfo.xcprivacy`
   est obligatoire, et les greffons Capacitor doivent avoir le leur. Capacitor 7
   les fournit ; vérifie qu'ils sont bien embarqués dans l'archive.

## La classification, et le mot qui compte

Le jeu fait miser des PIÈCES DE JEU sur une partie. Elles ne s'achètent pas, ne
se revendent pas, ne valent rien hors du jeu — mais la mécanique est celle d'une
mise, et Apple la classe en « Simulated Gambling ». Déclare-la : la cacher est un
retrait, la déclarer coûte une tranche d'âge.

Il n'y a AUCUN achat intégré : la boutique de dés se paie en pièces du jeu. Ne
déclare pas d'achats intégrés, et n'ajoute pas StoreKit — le jour où des pièces
seront vendues, ce sera une décision séparée.

La fiche, les captures et la politique de confidentialité existent :

  store/listing.json            textes FR, EN, ES, AR
  store/graphics/               icône 512², bandeau
  store/screenshots/<langue>/   captures par langue et par format
  https://usernabil.github.io/piratesdice/privacy

⚠️ Les tailles de captures d'Apple ne sont pas celles de Google. Il faut du
6,7 pouces (1290×2796) et du 5,5 pouces (1242×2208) au minimum. Les captures
Android ne passeront pas telles quelles : régénère-les depuis le simulateur.

## La chaîne : `.github/workflows/ios-release.yml`

Calque-la sur `android-release.yml`, qui est dans le dépôt. Mêmes principes,
quatre différences :

  runs-on: macos-latest        (obligatoire, Xcode n'existe pas ailleurs)
  le numéro de build : DEMANDE-LE À APPLE — voir juste en dessous
  secrets : ASC_KEY_P8, ASC_KEY_ID, ASC_ISSUER_ID
  destination : TestFlight, jamais l'App Store directement

⚠️ **LE NUMÉRO DE BUILD : NE LE DÉDUIS PAS DU NUMÉRO DE COMPILATION.** La chaîne
Android faisait exactement ça, et elle a échoué douze fois de suite sans que
personne s'en aperçoive : des envois partaient aussi à la main, avec leur propre
compte. Deux compteurs pour une seule suite. La collision est certaine, et elle
ne tombe qu'à la DERNIÈRE étape — après un build complet et signé, quand tout
avait l'air d'aller. App Store Connect a la même règle qu'Play. Demande-lui le
plus haut numéro déjà reçu et prends le suivant ; c'est la seule autorité sur ce
qui est pris. Côté Android, `play_api.py --next-version` fait exactement ça :
lis-le, la logique se transpose.

Les étapes :

  1. build.py --server https://dice.my-officeapps.com --build $BUILD
  2. npx cap copy ios
  3. LES CONTRÔLES QUI BLOQUENT — c'est là que la chaîne gagne sa place :
     · chaque module JS livré se parse :
           node --input-type=module --check < fichier
       ⛔ `node --check fichier.js` REND 0 SUR UN FICHIER CASSÉ quand il porte
       l'extension .js. Vécu sur ce projet : trois apostrophes non échappées ont
       tué l'application entière pendant que la vérification disait « ok ».
     · le dossier que tu as assemblé est bien celui que l'archive embarque.
       Avec Capacitor, `www/` et `ios/App/App/public/` sont deux copies que seul
       `npx cap copy` rapproche. L'oublier produit une archive parfaitement
       valide contenant le jeu d'il y a une heure, sans aucune erreur. Ce piège
       a déjà coûté une journée côté Android.
     · ouvre l'IPA et liste les URL qu'il contient. Une adresse locale qui
       traîne, et l'app ne se connecte à rien chez le testeur.
  4. xcodebuild archive, puis -exportArchive avec un exportOptions.plist en
     method app-store-connect
  5. xcrun altool --upload-app -f App.ipa -t ios --apiKey $ASC_KEY_ID
     --apiIssuer $ASC_ISSUER_ID

Chaque étape échoue bruyamment ou passe. Aucune ne « continue quand même ».

## Ce que tu vérifies sur un SIMULATEUR avant d'envoyer

Pas dans la documentation — à l'écran, sur un iPhone avec encoche (15 ou 16) :

  · l'en-tête ne passe pas sous l'encoche ni sous la barre de gestes ;
  · le plateau ne rebondit pas quand on tire vers le bas ;
  · une partie complète contre l'IA se joue jusqu'au bout ;
  · ⚙ Réglages → « Effacer mes données » supprime bien le compte ;
  · le retour par geste depuis le bord ne laisse pas un écran mort.

## Ce que tu rends

Un tableau : une ligne par étape, la commande exacte, la sortie qui la prouve.
Puis le numéro de build accepté par App Store Connect, et la liste des pages qui
restent à remplir à la main (classification d'âge, confidentialité, testeurs
TestFlight) avec leur URL.

Demande avant toute action irréversible. Ne pousse jamais sur `main` sans que la
chaîne soit verte.
```

---

## Ce qui reste à faire côté humain

| Action | Où |
|---|---|
| Adhésion Apple Developer Program | developer.apple.com/programs |
| Créer l'app, bundle `com.nabil.piratesdice` | appstoreconnect.apple.com |
| Clé API App Store Connect (rôle App Manager) | App Store Connect → Users and Access → Integrations |
| Déposer `ASC_KEY_P8`, `ASC_KEY_ID`, `ASC_ISSUER_ID` | github.com/UserNabil/piratesdice → Settings → Secrets |
| Classification d'âge, dont « Simulated Gambling » | App Store Connect, fiche de l'app |
