# Générer les trois jeux de dés de la boutique — prompts Runway

À coller dans Runway (Gen-4 Image / Frames). Trois jeux : **Or**, **Obsidienne**,
**Rubis**. Six faces chacun, plus une image de dos commune.

---

## 1. Avant de commencer — ce que Runway ne sait PAS faire

Trois limites, et elles décident de toute la méthode :

| Ce dont le jeu a besoin | Ce que Runway rend | Qui s'en occupe |
|---|---|---|
| Fond **transparent** | fond opaque, toujours | **détourage après coup** — script existant |
| Corps de **239 px** sur une toile de 256 | une taille quelconque | **normalisation après coup** |
| Six faces **strictement identiques** sauf les points | dérive à chaque génération | **image de référence** — voir §3 |

Autrement dit : Runway dessine la matière, pas la géométrie. On récupère la
première et on impose la seconde.

⚠️ **Ne pas demander « fond transparent » dans le prompt.** Runway l'ignore et,
pire, il ajoute parfois un damier gris qu'il faut ensuite effacer à la main.
On demande un **fond vert uni**, qui se découpe proprement.

---

## 2. La règle qui fait tout tenir : une image de référence

**Génère la face 5 en premier, valide-la, puis utilise-la comme image de
référence pour les cinq autres.** Sans référence, chaque face repart d'une
interprétation différente : corps plus large, arrondi plus sec, or plus rouge —
et on obtient six dés qui ne sont pas du même jeu. Avec référence, seul le nombre
de points change.

Pour le **premier** jeu (l'Or), joins aussi en référence l'un de nos dés actuels :

    tools/eden_ultimate_tool/static/dice/img/die_5.png

C'est lui qui porte le style de la maison : liseré blanc épais, trame de points,
arrondi de galet.

---

## 3. Le socle commun — à mettre en tête de CHAQUE demande

```
A single game die seen straight on, flat 2D comic pop-art sticker illustration.

SHAPE — a square with extremely rounded corners, the corner radius about 27% of
the side, close to a pebble. A thick pure-white outline runs all the way around,
roughly 5% of the side, doubled on the outside by a thin dark navy line. No
perspective, no 3D rotation, no tilt: the face is dead flat and fills the frame.

SURFACE — a halftone dot texture over the shaded half, one warm gradient across
the body, flat cartoon shading. No photorealism, no metal reflections of the
room, no text, no logo.

PIPS — round, domed, each with a small white specular highlight at its upper
left. Standard die layout for the number NNN.

BACKGROUND — flat solid chroma green #00B140, nothing else. No table, no shadow
cast on the background, no vignette, no frame, no border.

The die is centred and occupies about 90% of the image.
```

Remplacer `NNN` par `one`, `two`, `three`, `four`, `five`, `six`.

---

## 4. Les trois jeux

### 4.1 Or — « Le trésor du capitaine »

```
MATERIAL — polished gold. The body runs from a bright #FFE479 at the upper left
to a deep amber #C87A05 at the lower right. The halftone dots read as a warm
burnished texture, not as rust.

PIPS — dark chocolate brown #2A1A00, glossy and domed.

The white outline stays pure white — it must not turn cream or gold.
```

### 4.2 Obsidienne — « La nuit sans lune »

```
MATERIAL — black volcanic glass. The body runs from #3A2A63 at the upper left to
#0E0818 at the lower right, with a faint violet halftone and a few sharp glassy
glints, as if a shard had been polished flat.

PIPS — pale bone #F6EFD8, glossy and domed, standing out strongly against the
dark body.

The white outline stays pure white and must read clearly against the dark body.
```

### 4.3 Rubis — « Le sang de la bordée »

```
MATERIAL — cut ruby. The body runs from a bright #FF8FA3 at the upper left to a
deep #8E1218 at the lower right, with faint internal facets catching the light
inside the stone. The halftone reads as a deep red grain.

PIPS — near-black #14060A, glossy and domed.

The white outline stays pure white — it must not turn pink.
```

---

## 5. Combien d'images demander

**Six par jeu.** Les faces au repos, rien d'autre : `1`, `2`, `3`, `4`, `5`, `6`.

⚠️ **Ne demande PAS les variantes incandescentes.** Le jeu en a besoin (le dernier
dé posé rougeoie), mais elles se **dérivent** des faces au repos par recoloration
des points : la géométrie reste alors exacte au pixel près, ce qu'une seconde
génération ne garantirait jamais. Même chose pour l'image de dos.

Soit **18 images à générer** au total, pas 39.

---

## 6. Nommage à la livraison

Un dossier par jeu, six fichiers dedans, exactement ces noms :

```
or/          die_1.png  die_2.png  die_3.png  die_4.png  die_5.png  die_6.png
obsidienne/  die_1.png  …
rubis/       die_1.png  …
```

Le fond vert et la taille n'ont pas d'importance à ce stade — c'est le détourage
qui s'en occupe. Ce qui compte : **une face par fichier, le bon nombre de points,
et six dés qui se ressemblent.**

---

## 7. Le contrôle avant intégration

⚠️ **Mesurer, jamais intégrer à l'œil.** Sur les premières planches livrées pour
ce jeu, le corps occupait de **58 % à 85 %** de la toile selon le fichier : les
dés sautaient d'une case à l'autre en jouant. Le contrôle, sur chaque image :

1. corps centré, **239 px** de côté sur une toile de **256** ;
2. rayon des coins à **27 %**, mesuré sur la diagonale du coin — pas à l'œil ;
3. fond réellement transparent, pas blanc, pas vert résiduel ;
4. les six faces d'un même jeu **exactement** la même taille de corps ;
5. le liseré blanc intact — c'est lui qui fait reconnaître un dé de la maison.

Les scripts existent : celui qui a mesuré l'arrondi des alvéoles rend le côté, le
rayon et la marge de chaque fichier, et celui du détourage (`tools/key_fx.py`)
sait retirer un fond uni **à pleine résolution**.

⚠️ Détourer **avant** de réduire. Détourer après réduction mélange le vert du fond
dans le bord du sujet, qui devient à moitié transparent et perd son éclat. Et la
teinte annoncée (#00B140) n'est jamais la vraie après compression : la mesurer
image par image.

---

## 8. Ce qui se passe ensuite

Une fois les 18 images livrées :

1. détourage à pleine résolution, puis normalisation à 239/256 centré ;
2. dérivation des 6 variantes incandescentes + du dos, par recoloration ;
3. trois entrées en base (`S002` Or, `S003` Obsidienne, `S004` Rubis) — le
   mécanisme de boutique existe déjà et se vérifie en base ;
4. la vignette de boutique est la face 5 du jeu, prise automatiquement.

Rien d'autre à préparer de ton côté.
