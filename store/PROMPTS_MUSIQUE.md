# La musique du jeu — de quoi la faire générer

L'admin a demandé « comme celle de Sea of Thieves ». Ce n'est donc ni du
chiptune ni de l'arcade : c'est un petit orchestre maritime — concertina,
violon en archets longs, violoncelle, guitare grattée doucement, contrebasse
pizzicato, bodhrán — en mode dorien, avec de l'air et une grande réverbération.

⚠️ **Une boucle n'est pas un morceau court.** Un morceau de 40 s qui « finit »
s'entend au moment où il recommence : la coupure est ce que l'oreille retient.
Ce qu'il faut demander, c'est une boucle *sans début ni fin*.

⚠️ **Pas de voix.** Le jeu parle déjà (les capitaines, les effets, les alertes).

⚠️ **Format à demander** : WAV, 44,1 kHz. On convertit ensuite en `.m4a`
(AAC-LC **96 kbps mono minimum**) pour l'application — une boucle de 96 s pèse
alors environ 1,1 Mo, contre 16 Mo en WAV. **Une seule fois, depuis le WAV** :
réencoder un MP3 en AAC empile deux pertes.

⛔ **ET LES CINQ FICHIERS ACTUELS NE RESPECTENT PAS CE CHIFFRE.** Mesuré à
`afinfo`, le 2026-08-28 : mono 44,1 kHz, **58 à 61 kbps** (la fanfare 43). À ce
débit, ce qui fait précisément le timbre visé — souffle du soufflet, bruit
d'archet, peau du bodhrán — est détruit **quelle que soit la source**. Refaire
la musique sans corriger l'encodage ne servirait à rien. Coût du passage à
96 kbps : environ 5,7 Mo au lieu de 3,4, sur une application de 32,6 Mo.

---

# Trois prompts — musique de fond, The Pirate's Dice

Principes appliqués (issus des critiques) : ancrage **English / West Country maritime**, jamais « Irish », « jig » ni « sea shanty » (ces tokens tirent vers Riverdance ou Wellerman) ; jamais le mot « pirate » (les générateurs collent des mouettes) ; jamais « Sea of Thieves » écrit en clair (filtre œuvre protégée sur Suno) ; **toutes les exclusions de style sorties du prompt** vers le champ prévu ; arithmétique vérifiée (6/8, noire pointée 80 → 1 mesure = 1,5 s) ; les trois morceaux partagent tonalité et pulsation, donc ils s'enchaînent et se superposent.

---

## 1) BOUCLE MENU / PONT — 96 s

**A. Style box (Suno v4.5/v5, Udio manual) — 998 caractères, passe sans troncature**

```
English West Country maritime chamber folk, five live players in a stone hall. A background bed, not a theme: pleasant to ignore, unnoticed at the thirtieth listen.
Anglo concertina low-mid; solo fiddle in long bows and open D/A double stops; low lyrical cello; soft-strummed parlour guitar; pizzicato upright bass, two notes a bar; bodhran, felt tipper; rare low whistle.
D dorian, B natural, Dm-C-G-Dm over a constant D-A drone; major IV and flat VII are the colour; plagal only, no leading tone, no V-i, no key change.
6/8, dotted quarter 80, slow boat-rocking lilt, never a dance tune, strict tempo.
64 bars = 96 s, starts in motion and ends on the voicing and density of bar 1: no intro, outro, fade, pickup or final chord.
One plain theme stated twice, never developed: no hook, no solo, no ornaments, no build, nothing enters or leaves. Guitar and bass cycle on 4 bars, concertina on 6, drone unmeasured.
Unquantised human playing, audible bellows, breath, bow noise, warm hall reverb 1.5 s.
```

**B. Champ court 200 caractères — 198**

```
English West Country maritime chamber folk, concertina, fiddle in long bows, cello, soft-strummed parlour guitar, pizzicato bass, soft bodhran, D dorian drone, 6/8 at 80, calm looping background bed
```

**C. MusicGen (prose, zéro négation — MusicGen n'a pas de prompt négatif et lirait « chiptune » comme une commande)**

```
A calm English maritime folk loop in 6/8 at a walking pace: anglo concertina, fiddle in long bows, low cello, softly strummed acoustic guitar, pizzicato double bass and a soft bodhran, modal D dorian over an open drone, recorded live in a warm stone hall, steady and even throughout.
```

*À vérifier au rendu :* coller le fichier bout à bout avec lui-même — aucun clic, aucun trou, aucune bosse de niveau au raccord ; durée réelle 96 s à la mesure près ; aucune voix ni mouette n'a fui ; le si est bien naturel (le sol doit sonner **majeur**, sinon c'est du ré mineur triste et le rendu est à jeter) ; en mono sur haut-parleur de téléphone rien ne pique ; après cinq passages d'affilée, on ne doit pas pouvoir fredonner le thème de mémoire.

---

## 2) BOUCLE PENDANT LA PARTIE — 120 s, même famille, passe sous le jeu

Même tonalité et même pulsation que la n° 1, donc fondu enchaîné possible sans battement. Le whistle, la mandoline en trémolo, le tambourin, le shaker et toute attaque de médiator sont retirés **par l'arrangement** : c'est ça qui libère la bande 2–6 kHz pour `diceDrop.mp3`, `dropCoin.mp3` et `boom.mp3`, pas un EQ.

**A. Style box — 1006 caractères**

```
English West Country maritime chamber folk, four players. Furniture under a game, not music: heard thirty times a session, it must never become a landmark.
Anglo concertina holding long low chords, breathy; cello and fiddle in slow open fifths, long bows; parlour guitar fingerpicked, low, no plectrum; pizzicato upright bass, one note a bar. No drum with a downbeat: none, or a soft unaccented frame-drum roll.
D dorian, B natural, Dm-C-G-Dm over a constant D-A drone; plagal only, no leading tone, no V-i, no key change. 6/8, dotted quarter 80, slow rocking, strict tempo.
80 bars = 120 s, starts in motion, ends on the voicing and density of bar 1: no intro, outro, fade, pickup or final chord.
Theme implied: three-note fragments with long rests, never near the start or end. Nothing enters or leaves, no build, no accent. Cello cycles on 4 bars, concertina on 6, drone unmeasured.
Unquantised playing, bellows and bow noise as a continuous soft floor, warm hall reverb 1.5 s.
```

**B. Champ court 200 caractères — 196**

```
restrained English maritime chamber folk underscore, concertina long chords, cello and fiddle open fifths, fingerpicked guitar, pizzicato bass, D dorian drone, 6/8 at 80, no melody, quiet loop bed
```

**C. MusicGen**

```
A very quiet English maritime folk underscore in 6/8 at a walking pace: anglo concertina holding long chords, cello and fiddle in slow open fifths, fingerpicked acoustic guitar and pizzicato double bass over an open D drone, live in a warm stone hall, steady, sparse and even.
```

*À vérifier au rendu :* lancer la boucle sous une vraie partie et jeter vingt dés — dé, pièce et explosion doivent rester parfaitement lisibles **sans baisser la musique** ; aucune attaque ni percussion accentuée ne doit être prise pour un dé qui tombe ; niveau plat de bout en bout (3–4 dB max, mesuré, pas à l'oreille) ; au dixième passage, aucun événement ne doit permettre de deviner où on en est dans la boucle ; et le raccord doit rester inaudible **avec les SFX qui jouent par-dessus**, pas seulement en écoute isolée.

---

## 3) FANFARE DE VICTOIRE — 4,0 s

Calée sur la même pulsation que les deux boucles (2 mesures de musique = 3,0 s, puis 1,0 s de queue = 4,000 s), et en **ré mixolydien** : le fa dièse contre le fa naturel de la boucle fait la bascule lumineuse, sans sensible ni V-I donc sans emphase hollywoodienne.

**A. Style box — 792 caractères**

```
English West Country maritime folk flourish, four live acoustic players, warm and joyful, a short tavern cheer at a table. Small and human, not epic, not orchestral, not cinematic.
Anglo concertina and fiddle in unison on a simple rising figure; tenor banjo and soft-strummed parlour guitar under them; cello and upright bass on the root; one soft bodhran flourish, no metal.
D mixolydian lift, C - G - D, landing on an open ringing D with a bare fifth. No leading tone, no V-I.
6/8, dotted quarter 80. Two bars of music, then the hall reverb rings out: 4 seconds total.
Full energy on the very first downbeat, then decay. No intro, no ramp, no roll-in, no crescendo, no build, no repeat. This is not a loop: it ends.
Unquantised human playing, bellows and bow noise, warm hall reverb 1.5 s.
```

**B. Champ court 200 caractères — 199**

```
short warm English maritime folk flourish, concertina and fiddle unison, tenor banjo, guitar, cello, bass, one soft bodhran hit, D mixolydian C-G-D, 6/8 at 80, four seconds, bright ending, not a loop
```

**C. MusicGen (le seul des trois outils capable de viser 4–5 s : `duration=5`)**

```
A short warm English maritime folk flourish: anglo concertina and fiddle in unison, tenor banjo, strummed acoustic guitar, cello and double bass, one soft frame drum hit, bright modal D major, live in a warm hall, four seconds, ending on a ringing open chord.
```

*À vérifier au rendu :* elle démarre plein pot **sur le premier échantillon** (le moindre silence ou la moindre montée en tête fait paraître le déclenchement en retard) ; tout est fini à 4,0 s, queue de réverbe comprise ; elle sonne franchement majeure contre le ré dorien de la boucle qui continue dessous ; elle ne masque pas `dropCoin.mp3` si les deux partent ensemble ; et la boucle qui reprend derrière ne fait ni saut de niveau ni trou.

---

## Champ « Exclude Styles » de Suno (à ne PAS mettre dans le prompt)

Identique pour les trois. C'est là que vont les négations : citées dans la style box elles augmentent la probabilité d'obtenir ce qu'elles interdisent.

```
vocals, choir, humming, oohs, whistling, spoken word, sea shanty, wellerman, irish jig, reel, hornpipe, celtic new age, ambient spa, chiptune, 8-bit, arcade, synth, drum machine, EDM, epic trailer, cinematic braams, taiko, brass fanfare, snare, cymbals, tambourine, shaker, hand claps, sound effects, seagulls, waves, thunder, cannon, ship creaks, field recording
```

## Notes de production (à ne pas coller dans le générateur)

- **Réglages** : cocher **Instrumental** sur Suno — c'est le seul levier fiable contre les voix, une phrase « no vocals » ne suffit pas. Ne jamais écrire le nom du jeu de référence.
- **La boucle se fabrique au montage, pas au prompt.** Aucun générateur ne rend un fichier bouclable. Méthode : rendre 3 minutes à tempo strict, repérer deux barres de mesure identiques, couper sur la barre, **replier 1 à 2 mesures de queue sur la tête en recouvrement** (crossfade par superposition, jamais un fade), vérifier en lecture bouclée. C'est ce repli qui fait passer la réverbe de 1,5 s à travers la couture.
- **La vraie parade aux 30 passages est une question de quantité de matière, pas de rédaction** : générer **2 ou 3 variantes de la boucle n° 2**, même tonalité, même tempo, même grille, et les alterner d'un duel à l'autre. Aucune formulation ne sauve 30 lectures des mêmes 120 secondes.
- **Master** : menu −18 LUFS, boucle de jeu −20 à −22 LUFS, true peak −3 dBTP, coupe-bas 60 Hz, creux de 2 dB à 3 kHz **sur la boucle de jeu uniquement**, contrôle final en mono sur un haut-parleur de téléphone, pas au casque.
- **Format de livraison, point bloquant du dépôt** : `/Users/develop/piratesdice/www/js/pages/dice_board.js:341` joue les sons avec `new Audio(this.base + file)` et tous les fichiers de `/Users/develop/piratesdice/www/dice/sfx/` sont des `.mp3`. Un MP3 en `loop = true` dans une WebView **n'est pas gapless** : le padding d'encodeur ajoute quelques dizaines de ms de blanc à chaque tour, ce qui annule tout le travail sur la couture. Livrer la musique en **`.m4a`/AAC gapless ou `.ogg`/Opus**, ou passer la musique en Web Audio (`AudioBufferSourceNode.loop`, qui boucle à l'échantillon près) ; les SFX courts peuvent rester en MP3.
- **Poids** : en Opus ~64 kb/s, la boucle de 120 s pèse ~1 Mo — compatible avec l'effort de perf du commit `5d4adbd` (APK 44 → 34 Mo). Éviter le WAV embarqué : le WAV 24 bits sert de master, pas d'asset.

---

## Côté code, c'est fait — il ne manque que les fichiers

`www/js/ui/musique.js` : canal séparé, boucle, rotation des trois pistes de
partie, silence quand l'application passe derrière, reprise au retour. Le
réglage existe aussi (deux curseurs, effets et musique, dans les réglages).

**Déposer les nouveaux `.m4a` dans `www/dice/music/` suffit** — mêmes noms,
mêmes durées, pas une ligne à toucher :

| fichier | durée | rôle |
|---|---|---|
| `music_menu.m4a` | 96 s | pont / menu |
| `music_game_01.m4a` | 120 s | partie, variante 1 |
| `music_game_02.m4a` | 120 s | partie, variante 2 |
| `music_game_03.m4a` | 120 s | partie, variante 3 |
| `music_victory.m4a` | 4 s | fanfare (pas encore déclenchée par le jeu) |

⚠️ **Ne pas réécrire `musique.js` en Web Audio sans avoir mesuré.** Le fichier
boucle avec `audio.loop = true`, et les cinq `.m4a` portent bien l'atome
`iTunSMPB` (vérifié) : WKWebView et Chromium honorent le gapless AAC. Écouter
la couture sur un vrai iPhone et un vrai Android AVANT d'engager la demi-journée
de réécriture — c'est peut-être zéro travail.


# Comment on les fabrique — état au 28 août 2026

Recherche menée par sept agents, chaque fiche passée à un contradicteur chargé
de la réfuter (une licence mal comprise coûte un retrait de l'App Store). Les
prix et les clauses ci-dessous ont été relus une seconde fois pour cette raison.

## Le chemin

**Suno Premier au mois — 30 $, un mois, puis résiliation.** C'est le seul
service qui nomme explicitement les jeux vidéo dans sa licence payante, accepte
les style boxes ci-dessus telles quelles, et donne le tempo verrouillé et les
téléchargements illimités dont dépend tout le travail de raccord.

⛔ **Pas l'annuel.** « 24 $/mois » est un engagement de douze mois facturé
d'avance : 288 $, pas 48 $. Le palier Pro à 10 $ ne suffit pas — pas de Studio,
donc pas de tempo manuel, et 20 téléchargements par mois.

## La marche à suivre

1. **Avant de payer**, vérifier les deux seules choses qui justifient Premier,
   et qu'aucune documentation ne garantit : le minimum réel du curseur de durée,
   et le tempo manuel dans Studio. Studio est **Chrome desktop uniquement**,
   ≥ 768 px — ni Safari, ni mobile.
2. **Réglages** : Create → Custom Mode → v5.5 → **Instrumental activé**, champ
   Lyrics vide. Style box A collée verbatim, champ *Exclude Styles* collé tel
   quel, Weirdness bas, Style Influence haut.
3. **Générer à 180 s**, jamais à la durée cible : on découpe une boucle dans de
   la matière longue. La fanfare se génère au minimum du curseur (~10 s), puis
   se taille à 3,000 s de musique + 1,000 s de queue.
4. **Les trois variantes de partie** : même style box, puis **Cover/Remix** du
   rendu retenu — c'est ce qui garde le même ensemble dans la même salle.
   ⛔ Pas de Custom Model : il en exige six morceaux uploadés minimum.
5. **Tempo** : dans Studio, *Follow Track → Manual Tempo* = **160**. Une mesure
   4/4 à 160 dure 1,500 s, soit exactement une mesure du 6/8 à la noire pointée
   80. ⚠️ Studio réduit la dérive, il ne la supprime pas — Suno prévient
   lui-même que « some users may experience timing issues ». Vérifier au
   métronome.
6. **Stems**, si besoin : *Auto Split*, jamais *Advanced Split* — ce dernier ne
   sépare pas, il **régénère** la piste choisie ; les stems ne resomment pas au
   mix et peuvent dériver en timing.
7. **Télécharger en WAV depuis suno.com sur desktop** (le mobile retombe en
   MP3), et **avant de résilier** — voir la licence ci-dessous.

## La licence, et ses deux pièges

**Ce qu'elle donne** : le centre d'aide accorde aux abonnés payants l'usage
« in film, tv, or video games ». Pas de royalties, pas d'attribution, plusieurs
projets, développeur individuel inclus. Ces droits sont **perpétuels** — ils
survivent à la résiliation.

**Piège 1 — la génération, pas seulement le téléchargement.** Un morceau généré
en gratuit n'acquiert **jamais** de droits commerciaux, même téléchargé plus
tard depuis un compte payant. Tout ce qui aurait été prototypé avant
l'abonnement est à regénérer une fois abonné.

**Piège 2 — il faut avoir téléchargé.** Depuis le 3 septembre 2026 : « You may
not commercially exploit Output that has not been downloaded by you ». Un
morceau parfait laissé dans la bibliothèque n'est pas exploitable. **Tout
descendre avant de résilier.**

**Ce qu'elle n'apporte pas, et qu'il faut assumer :**

- **Aucun copyright opposable.** Suno « makes no representation or warranty that
  any copyright will vest in any Output ». On obtient le droit d'utiliser, pas
  celui d'interdire : un tiers peut sortir une piste très proche. Acceptable
  pour une musique de fond, pas pour une identité sonore qu'on défendrait.
- **Aucune indemnisation, et elle va dans l'autre sens** : c'est l'utilisateur
  qui s'engage à défendre Suno. Aucune garantie de non-contrefaçon sur les
  paliers self-serve, contentieux Universal / Sony toujours ouvert. Si un rendu
  s'avère contrefaisant, les frais sont pour l'éditeur du jeu.
- **Filigrane.** Depuis le 6 août 2026, Suno appose un marquage audio inaudible
  présenté comme survivant à l'édition et à la compression. Les pistes resteront
  identifiables comme générées par Suno après découpe et réencodage. Pas
  bloquant pour les boutiques, mais c'est une caractéristique du livrable.
- **Fenêtre courte.** Suno annonce qu'« all prior models will be retired » à
  chaque nouveau modèle : générer et descendre les cinq pistes **dans la même
  semaine**, sinon le timbre du menu et celui de la partie ne se ressembleront
  plus.

## Les replis

1. **Le timbre ne suit pas après deux heures** — c'est le cas le plus probable :
   les modèles rendent mal exactement ce qu'on demande, anches libres
   (concertina) et peaux (bodhrán). Alors **AudioJungle, licence *Music Mass
   Reproduction*** : ~19 $ la piste, ~95 $ les cinq, payé une fois, perpétuel,
   « apps, games » nommés. Deux réserves : la licence vaut pour **un seul
   produit fini**, et des redevances P.R.O. peuvent s'appliquer à part. On prend
   ce qui existe — du celtique de production plutôt que du folk de chambre — et
   la couture reste entièrement à faire.
2. **Dépannage gratuit, dans l'heure** : `soundimage.org` (Eric Matyas),
   commercial gratuit avec attribution, pistes déjà bouclées, dont HIGH SEAS
   ADVENTURES. Ou OpenGameArt en CC0, qui n'exige même pas l'attribution.
   L'esthétique est loin du brief, mais c'est licencié et propre.
3. **Si le timbre est vraiment le critère** : aucun générateur ne le donnera. Un
   compositeur indépendant avec de vrais instruments, 300 à 800 € les cinq
   pistes, cession écrite et stems livrés, deux à trois semaines.

## Ce qu'il ne faut pas essayer — vérifié, pas supposé

- **Udio** : conditions du 12 novembre 2025 toujours en vigueur — « personal and
  non-commercial purposes », « You may not download copies of any Output », et
  l'exploitation commerciale figure parmi les conduites interdites. **Aucun
  palier payant ne lève cela.** Les articles datés 2026 qui disent l'inverse
  recyclent de l'information d'avant octobre 2025.
- **ElevenLabs** : la réserve « Studio Games » exclut les jeux commercialisés
  **et** disponibles sur plus d'une plateforme. iOS + Android : la seconde
  condition est déjà remplie.
- **Soundraw** : le BPM n'est pas librement réglable (±10 à 20 autour du tempo
  d'origine) — on n'obtiendra pas 80. Et l'article 10.13 interdit de distribuer
  la musique générée en tant que telle, avec une exception rédigée autour de la
  **vidéo** ; or un APK embarque un `.m4a` autonome et extractible.
- **MusicGen / AudioCraft** : poids en CC-BY-NC 4.0. Inutilisable
  commercialement, quoi qu'on lise ailleurs.
- **Epidemic Sound / Artlist** : le jeu vidéo est hors des offres self-serve.
- **Pixabay** : dépôts d'utilisateurs, aucune vérification de provenance, aucune
  indemnisation. Mauvaise idée dans un binaire signé sur deux boutiques.
- **Stable Audio en poids ouverts** est la seule voie gratuite juridiquement
  propre (Community License, commercial libre sous 1 M$ de chiffre d'affaires),
  mais c'est une installation locale avec GPU : pas un chemin « cette semaine ».
