# Remplacer la parure S006 — brief pour l'agent d'images

## Le prompt a donner

> Draw a **4×3 sprite sheet** of a single pirate-themed dice set, 12 tiles.
> Each tile is **256×256 px, fully transparent outside the die**.
>
> **Row layout** — read left to right, top to bottom:
> tiles 1-6 = faces **1, 2, 3, 4, 5, 6** in their normal state;
> tiles 7-12 = the **same six faces in a "hot" state** (see below).
>
> **The die.** A rounded square seen flat, straight on, no perspective, no tilt.
> Its body must fill **92 % of the tile** and be **centred**, leaving an even 4 %
> margin on every side. Corner radius **27 % of the die's side** — generously
> rounded, the same softness as a well-worn wooden die. This is not negotiable:
> the game carves a socket whose corners are computed from that exact figure.
>
> **The style.** Comic, hand-inked, saturated — the same hand as a modern mobile
> board game: a thick clean outline, flat colour with one soft inner shadow, a
> single highlight. **No photorealism, no metallic ray-tracing, no gradients that
> look 3D-rendered.** Think painted prop, not rendered object.
>
> **The theme.** Bone and blackened brass, as if carved from whalebone and bound
> with a ship's fittings: warm ivory body, dark brass corner caps, pips struck
> like small rivets. Pirate, salt, rope — never fantasy, never neon.
>
> **The pips.** Standard dice arrangement. Each pip must stay readable when the
> whole die is only **82 px wide on screen** — so: few details, high contrast
> against the body, and never touching the corner caps.
>
> **The hot state (tiles 7-12).** The SAME die, visibly heated: the pips glow
> from within, the body picks up an ember tint, a faint rim light appears. It
> must be recognisable as the same die at a glance, and unmistakably different
> from its normal twin at 82 px. Do not simply brighten the image.
>
> **Do not bake in** any drop shadow, any background, any frame, any glow that
> spills outside the die's body. The game adds its own shadow and its own socket.

## Ce que je ferai en le recevant

1. Decouper la planche en 12 fichiers `die_1.png … die_6.png` et
   `die_1_hot.png … die_6_hot.png`, 256×256 chacun.
2. **Mesurer** le corps opaque (alpha >= 200) de chaque face et le recentrer sur
   (128, 128) — la boite alpha brute inclut le halo et ment de dix pixels.
3. Relever la part du corps et l'arrondi peint, puis les inscrire dans
   `src/game/… CORPS` et `ARRONDI` de `www/js/pages/dice_state.js` : c'est de la
   que le logement tire ses coins.
4. Verifier a l'ecran, sur les deux plateformes.

## Les chiffres a respecter — mesures du 2026-08-23

| | nos des d'origine | l'ancien S006 |
|---|---|---|
| corps opaque | 236 × 236 px | 218 × 233 px |
| part de la toile | 0,923 | 0,881 |
| centre | 127,9 / 127,9 | **125,3 / 129,4** (decentre) |
| arrondi peint | **27 %** | 16,1 % |

⚠️ **L'ARRONDI EST CE QUI COMPTE LE PLUS.** Le jeu creuse un logement dont les
coins se calculent a partir de ce pourcentage. A 16 %, comme l'ancien S006, le
de est trop carre pour son logement et laisse quatre angles vides visibles. A
27 % il epouse le creux, exactement comme les des d'origine.

⚠️ **LES DOUZE FACES DOIVENT AVOIR LE MEME CORPS.** Une face plus petite que les
autres se lit comme un defaut d'affichage, pas comme une variante. S005 varie de
14 px d'une face a l'autre : c'est le maximum tolerable, et c'est deja trop.

⚠️ **UNE FACE « HOT » IDENTIQUE A SA JUMELLE NE SERT A RIEN.** Les six faces
chaudes de S002 sont identiques aux normales, octet pour octet : le joueur n'a
donc aucun signal quand une paire se forme. A ne pas reproduire.
