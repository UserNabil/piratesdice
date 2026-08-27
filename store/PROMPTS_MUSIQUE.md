# La musique du jeu — de quoi la faire générer

Trois pistes suffisent, et une seule est indispensable : **le pont**. Le reste
peut arriver plus tard sans que personne ne le remarque.

⚠️ **Une boucle n'est pas un morceau court.** Un morceau de 40 s qui « finit »
s'entend au moment où il recommence : la coupure est ce que l'oreille retient.
Ce qu'il faut demander, c'est une boucle *sans début ni fin* — pas d'intro qui
s'installe, pas d'accord final qui se pose. Les générateurs comprennent
`seamless loop`, `no intro, no outro`, `loopable`.

⚠️ **Pas de voix.** Le jeu parle déjà (les capitaines, les effets, les alertes).
Une voix chantée entre en concurrence avec le seul texte qu'on veut lire.

⚠️ **Format à demander** : WAV ou MP3 320, 44,1 kHz. On convertit ensuite en
`.m4a` (AAC 96 kbps mono) pour l'application — une boucle d'une minute pèse
alors 700 Ko environ, contre 10 Mo en WAV.

---

## 1. Le pont — la boucle principale (la plus importante)

> Upbeat pirate sea-shanty arcade loop, 8-bit and orchestral hybrid: chiptune
> square-lead melody doubled by a small brass section, tin whistle counter-melody,
> hand-drums and tambourine, plucked mandolin ostinato, deep tuba on the downbeat.
> Playful, adventurous, slightly mischievous — a tavern full of pirates about to
> gamble. 118 BPM, D minor, 4/4. Seamless loop, no intro, no outro, no vocals,
> no sound effects. Clean stereo mix, light room reverb, master headroom -6 dB.
> Length: exactly 60 seconds, loop point at 0:00.

## 2. La partie — plus tendu, plus discret

> Tense arcade sea-shanty loop, same instruments as a pirate tavern theme but
> stripped back: muted mandolin ostinato, low tuba pulse, soft hand-drum,
> occasional chiptune arpeggio. Restrained and repetitive — it must sit UNDER a
> game, never in front of it. 104 BPM, D minor, 4/4. Seamless loop, no intro, no
> outro, no vocals, no crescendo, no big finish. Length: exactly 60 seconds.

## 3. La victoire — quatre secondes, pas plus

> Short triumphant pirate fanfare: brass stab, tin whistle flourish, tambourine
> roll, one cannon-boom hit at the end. Bright, celebratory, arcade-style.
> D major, 118 BPM. Exactly 4 seconds, ends cleanly on the downbeat. No loop, no
> vocals.

---

## Comment vérifier une boucle avant de l'intégrer

1. **La coller à elle-même.** Deux copies bout à bout : si l'on entend la
   jointure, la boucle n'en est pas une.
2. **L'écouter trente fois.** C'est ce que fera un joueur en une partie. Une
   figure trop marquée devient insupportable au dixième passage — c'est le
   défaut le plus courant des boucles générées.
3. **Baisser à -18 dB et jouer par-dessus.** La musique doit laisser passer le
   claquement des dés et la voix des capitaines. Si elle les couvre, c'est la
   musique qui a tort.

## Ce qu'il restera à faire côté code

Rien n'est encore câblé : `Sfx` ne joue que des sons courts. Une boucle demande
un second canal (volume propre, coupé avec l'application, repris au retour) et
son réglage dans les réglages, à côté du son. Une demi-journée, le jour où les
pistes existent.
