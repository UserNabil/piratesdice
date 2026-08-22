# `com.nabil.pirate` — état mesuré le 2026-08-21

Tout ce qui suit vient d'un appel d'API dont la réponse est reproduite. **Rien
n'a été validé sur la console** : chaque édition ouverte a été supprimée
(`DELETE /edits/{id}`), y compris celle de la sonde d'envoi.

## Conclusion, en une ligne

Le brief vise le mauvais paquet. Tout ce qu'il demande est **déjà fait** sur
`com.nabil.piratesdice`, et il est **impossible** d'y arriver sur
`com.nabil.pirate` sans créer une seconde application distincte.

## La preuve qui tranche

Un binaire ne peut pas changer d'application. Sondé sans valider :

```
$ PLAY_PACKAGE=com.nabil.pirate py probe_upload.py app-release.aab
paquet vise : com.nabil.pirate
edition     : 05145275359526093918 (sera supprimee)
envoi de 31.5 Mo dans l'edition (AUCUN commit)…
REPONSE : {"error": {"code": 403, "message": "APK has the wrong package name.",
                     "status": "PERMISSION_DENIED"}}
verdict : REFUSE
edition supprimee : True
```

Remplir `com.nabil.pirate` oblige donc à changer `applicationId` dans
`android/app/build.gradle`. Ce n'est pas un réglage : sur Play, deux paquets sont
**deux applications**. Installs séparées, avis séparés, examen séparé — et les
testeurs déjà sur `com.nabil.piratesdice` ne migrent pas, ils devraient
réinstaller. Un `applicationId` publié ne se change plus jamais.

## Ce que contient déjà `com.nabil.piratesdice`

Piste **alpha** (c'est-à-dire le test fermé) :

```
"track": "alpha", "releases": [{ "name": "1.0.22", "versionCodes": ["22"],
  "status": "completed", "releaseNotes": [ar, en-US, es-ES, fr-FR] }]
```

Fiche :

```
DETAILS : {"defaultLanguage":"en-US",
           "contactWebsite":"https://usernabil.github.io/piratesdice-site/",
           "contactEmail":"n.ouldterki@gmail.com"}
  en-US  icon 1  featureGraphic 1  phone 5  sevenInch 5  tenInch 5
  fr-FR                            phone 5  sevenInch 5  tenInch 5
  es-ES                            phone 5  sevenInch 5  tenInch 5
  ar                               phone 5  sevenInch 5  tenInch 5
```

Soit **60 captures** dans les trois formats et les quatre langues — les deux
formats grand écran compris, ceux qui décident si Play juge l'app apte aux
tablettes. L'icône et la bannière ne vivent que sur la langue par défaut, ce qui
est correct : elles ne portent aucun mot et Play les reprend.

Les quatre exigences techniques du brief, vérifiées dans les sources :

| exigence | état |
|---|---|
| `targetSdkVersion` = 36 | ✅ `android/variables.gradle` |
| `compileSdkVersion` = 36 | ✅ `android/variables.gradle` |
| `android:enableOnBackInvokedCallback="true"` | ✅ présent au manifeste |
| `padding-top: max(env(safe-area-inset-top), 26px)` | ✅ `app/css/mobile.css:57` |
| `box-sizing: border-box` (piège 16.1) | ✅ présent |
| notes ≤ 500 caractères par langue | ✅ 167 à 209 |
| aucune adresse LAN dans l'AAB | ✅ `inspect_aab.py`, hôte réel `dice.my-officeapps.com` |

## Le dépôt GitHub est en AVAL, et il est en retard

`export_repo.py` le dit dans sa première ligne : « Fabrique le dépôt autonome
`piratesdice` **à partir d'ici** ». La source est `ee_admin` ; GitHub est un
export pour que les Actions puissent bâtir sans accès au dépôt privé.

Comparé en ignorant les fins de ligne — la plupart des écarts n'étaient que des
CRLF — il manque au dépôt public :

- `res/drawable-{h,m,x,xx,xxx}dpi/` : les cinq densités de `ic_splash_logo`
- `res/values/colors.xml`
- le `styles.xml` corrigé, avec `windowSplashScreenBackground` et
  `windowSplashScreenAnimatedIcon`

C'est **exactement le correctif du piège 16.4** : depuis Android 12,
`android:background` ne fait plus rien sur l'écran d'ouverture. Un agent qui
clonerait GitHub et bâtirait de là livrerait le logo sur fond blanc, sans
qu'aucune erreur ne le signale.

⚠️ **Bâtir depuis `ee_admin`, jamais depuis le clone GitHub**, tant qu'un
`export_repo.py` n'a pas été relancé.

## Deux choses vues en passant

**La CI publie pendant qu'on travaille.** `--check` a rendu `alpha 21` à 18 h 40,
et la lecture détaillée `alpha 22` quarante minutes plus tard. Aucun envoi n'est
venu d'ici. GitHub Actions pousse donc tout seul, et deux éditions simultanées
s'annulent — c'est ce que `with_retry` absorbe déjà, mais il faut le savoir avant
de s'étonner.

**Le paquet est devenu une variable d'environnement.** Réécrire la constante
`PACKAGE` dans `play_api.py` ne provoque aucune erreur et pousserait la fiche,
l'icône, la bannière et les soixante captures de *The Pirate's Dice* sur une
autre application. `PLAY_PACKAGE=… py play_api.py` évite ce coup-là ; sans la
variable, rien ne change.

## Ce qui reste, et qui n'est pas une question d'API

Pour un test fermé **payé** sur `com.nabil.piratesdice`, il manque uniquement ce
que la console seule sait faire :

1. Classification IARC
2. Sécurité des données
3. Public cible
4. Catégorie
5. Liste de testeurs sur la piste fermée (groupe Google — les listes par adresse
   ne sont pas visibles par l'API)
6. Le pays de ciblage de la piste

Et le consentement de chaque testeur, qui est un geste humain. **Aucun compte de
testeur ne doit jamais être inventé** : c'est le motif que Google détecte, et la
sanction est la fermeture du compte développeur.
