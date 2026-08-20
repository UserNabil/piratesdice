# Les prompts pour fabriquer l'identité visuelle

Tout est calé sur la direction artistique **déjà en place** dans le jeu — bois
`#3b281c`, laiton `#c9a227` → `#f3dc93`, feutre `#1f3823`, parchemin `#f0e3c2`,
cire `#a5332a`. Ne pas laisser un générateur inventer sa propre palette : c'est
ce qui ferait que l'icône ne ressemble pas au jeu qu'elle annonce.

**Règle Google Play qui décide de la composition** : l'icône est rognée en cercle
sur beaucoup de lanceurs. Tout ce qui compte doit tenir dans le **cercle central
(66 % de la largeur)**, et rien d'important dans les coins.

---

## 1. L'icône de l'application — 512×512 (obligatoire, PNG 32 bits)

```
A mobile game app icon, 512x512, centered composition inside a circular safe area.
Two antique bone dice — warm ivory with deep black pips, chipped edges, hand-worn —
tumbling over a dark green felt surface. Behind them, a polished brass ring like a
ship's porthole, with four small rivets at the compass points. Background: deep
aged oak, almost black at the corners, a single warm lantern light falling from the
upper left so the dice cast a soft shadow to the lower right.
Palette strictly: oak #3b281c, brass #c9a227 to #f3dc93 highlights, felt #1f3823,
bone #f0e3c2, deep shadow #100b06.
Painterly game-art rendering, thick confident brushwork, high contrast, readable at
48 pixels. No text, no letters, no numbers, no logo type, no border frame touching
the edges, no photorealism, no plastic 3D render, no gradients that wash out at
small size.
```

**Variante « crâne »** si vous voulez plus pirate et moins jeu de société :

```
Same brief, but replace one die with a small brass skull the size of a die, jaw
resting on the second die, one eye socket catching the lantern light. The skull is
BRASS, not bone — it reads as a decorative fitting, not gore. Keep it friendly
enough for a PEGI 3 / Everyone rating.
```

## 2. L'icône adaptative — deux images séparées

Android compose les deux couches et les anime au survol. **Ne pas donner une
icône plate** : le lanceur la posera dans un carré blanc et ce sera laid.

*Avant-plan* (`ic_launcher_foreground`, 432×432, **fond transparent**, sujet dans
les 264 px centraux) :

```
Transparent PNG, 432x432. Only the subject: two antique bone dice tumbling, ivory
with black pips, plus a thin brass ring behind them catching light from the upper
left. Nothing else — no background, no plate, no shadow on the background. The
subject must fit inside the central 264x264 pixels, everything outside is empty.
Painterly game art, palette bone #f0e3c2, brass #c9a227 to #f3dc93.
```

*Arrière-plan* (`ic_launcher_background`, 432×432, **plein**) :

```
432x432 seamless background tile for an app icon: dark aged oak planks running
horizontally, subtle grain, one warm light falling from the upper left corner,
corners fading to #100b06. No subject, no text, no logo, nothing that would be
recognisable when cropped to a circle. Palette #3b281c to #1b1208.
```

## 3. La bannière du Play Store — 1024×500 (« feature graphic »)

⚠️ Google recadre cette image sur beaucoup d'écrans et **pose parfois le nom de
l'app par-dessus**. Garder le tiers droit calme.

```
1024x500 store banner for a pirate dice game. Left third: two antique bone dice
mid-tumble over dark green felt, a brass-rimmed wooden board just visible beneath
them, gold coins scattered. Centre: warm lantern light from a hanging ship's
lantern, smoke haze. Right third: deliberately calm and dark — empty tavern
background, no detail, so a title can be laid over it.
Palette oak #3b281c, brass #c9a227, felt #1f3823, bone #f0e3c2.
Painterly game art, cinematic side lighting, no text, no logo, no watermark,
no human faces, nothing important in the outer 5% margin.
```

## 4. Le titre gravé (facultatif, pour la bannière)

```
The words "THE PIRATE'S DICE" as engraved brass letterforms, Cinzel-like Roman
capitals, warm gold #f3dc93 with dark #462c08 engraving depth, slight wear on the
high points, on a transparent background. No background plate, no border, no glow.
```

## 5. Les captures d'écran (2 à 8, au moins 320 px de côté)

À prendre **dans le jeu**, pas à générer : Google refuse les captures qui ne
montrent pas l'application. L'ordre qui vend le mieux :

1. la table en pleine partie (deux plateaux, un dé en cours de chute) ;
2. l'écran de victoire avec la pluie de pièces ;
3. la boutique du bord (les trois bonus) ;
4. le classement des capitaines ;
5. le menu, avec « Challenge a player ».

Une phrase courte peut être posée en haut de chaque capture (« Deny your rival.
Take the purse. »), en Cinzel or sur un bandeau de bois — jamais sur le plateau.

---

### Ce qu'il faut refuser à un générateur

- **Du texte dans l'icône** : illisible à 48 px et refusé par les revues de style.
- **Un cadre qui touche les bords** : rogné en cercle, il devient un anneau sale.
- **Un rendu 3D plastique** : il jure avec les dés peints du jeu.
- **Des dés à 6 faces vus de face** : ça ressemble à un jeu de société générique.
  Les dés doivent être **en mouvement**, pris de trois quarts.
