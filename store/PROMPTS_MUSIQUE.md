# La musique du jeu — de quoi la faire générer

L'admin a demandé « comme celle de Sea of Thieves ». Ce n'est donc ni du
chiptune ni de l'arcade : c'est un petit orchestre maritime — concertina,
violon en archets longs, violoncelle, guitare grattée doucement, contrebasse
pizzicato, bodhrán — en mode dorien, avec de l'air et une grande réverbération.

⚠️ **Une boucle n'est pas un morceau court.** Un morceau de 40 s qui « finit »
s'entend au moment où il recommence : la coupure est ce que l'oreille retient.
Ce qu'il faut demander, c'est une boucle *sans début ni fin*.

⚠️ **Pas de voix.** Le jeu parle déjà (les capitaines, les effets, les alertes).

⚠️ **Format à demander** : WAV ou MP3 320, 44,1 kHz. On convertit ensuite en
`.m4a` (AAC 96 kbps mono) pour l'application — une boucle de 96 s pèse alors
environ 1,1 Mo, contre 16 Mo en WAV.

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
Unquantised playing, bellows and bow noise as a continuous soft floor, warm hall reverb 1.5 s. Nothing bright or picked.
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

## Ce qu'il restera à faire côté code

Rien n'est encore câblé : `Sfx` ne joue que des sons courts. Une boucle demande
un second canal — volume propre, coupé quand l'application passe derrière (le
mécanisme existe déjà depuis qu'on a fait taire les effets), repris au retour —
et son réglage à côté du son. Une demi-journée, le jour où les pistes existent.
