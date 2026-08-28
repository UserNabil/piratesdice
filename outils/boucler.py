#!/usr/bin/env python3
"""Fabriquer une VRAIE boucle a partir d'un morceau qui a une fin.

⛔ UN MORCEAU QUI FINIT NE BOUCLE PAS. Les deux pistes s'eteignent — l'une sur
deux secondes, l'autre sur un fondu de quatre — puis une seconde de silence. En
lecture bouclee on entend la musique mourir puis repartir, et cette coupure est
justement ce que l'oreille retient.

⚠️ ET ON NE CHERCHE PAS LE POINT DE COUPE AU TEMPO SUPPOSE. Un tempo estime a
2 bpm pres decale la jointure d'un demi-temps au bout d'une minute. On mesure
plutot DEUX ressemblances entre la fin et le debut :

  - le dessin des attaques (flux spectral) : il est pique, donc il ne coincide
    que si la grille rythmique tombe juste. C'est lui qui donne la precision.
  - la couleur harmonique (12 classes de hauteur) : elle dit si l'accord de la
    fin menait bien a celui du debut. C'est elle qui evite un raccord juste en
    rythme et faux en musique.

Ce qui suit le point de coupe — la fin ecrite du morceau — est ecarte : c'est
une fin, et une boucle n'en a pas.
"""
import wave, numpy as np

FEN, SAUT = 2048, 512

def lire(chemin):
    w = wave.open(chemin); nf = w.getnframes(); sr = w.getframerate(); ch = w.getnchannels()
    d = np.frombuffer(w.readframes(nf), dtype='<i2').astype(np.float32) / 32768.0
    return d.reshape(-1, ch), sr

def ecrire(chemin, x, sr):
    x = np.clip(x, -1.0, 1.0)
    w = wave.open(chemin, 'wb'); w.setnchannels(x.shape[1]); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((x * 32767).astype('<i2').tobytes()); w.close()

def analyser(mono, sr):
    n = (len(mono) - FEN) // SAUT
    idx = np.arange(n)[:, None] * SAUT + np.arange(FEN)
    S = np.abs(np.fft.rfft(mono[idx] * np.hanning(FEN), axis=1))
    flux = np.zeros(n)
    flux[1:] = np.maximum(0, np.diff(np.log1p(S * 50), axis=0)).sum(axis=1)
    freqs = np.fft.rfftfreq(FEN, 1 / sr)
    with np.errstate(divide='ignore', invalid='ignore'):
        midi = 69 + 12 * np.log2(np.where(freqs > 20, freqs, np.nan) / 440.0)
    classe = np.where(np.isfinite(midi), np.mod(np.round(midi), 12), -1).astype(int)
    chroma = np.zeros((n, 12), dtype=np.float32)
    for c in range(12):
        chroma[:, c] = S[:, classe == c].sum(axis=1)
    chroma /= (np.linalg.norm(chroma, axis=1, keepdims=True) + 1e-9)
    return flux, chroma, sr / SAUT

def normaliser(v):
    v = v - v.mean()
    return v / (np.linalg.norm(v) + 1e-9)

def fin_audible(mono, sr):
    """Ou commence la fin ecrite : le dernier instant encore au niveau du morceau."""
    pas = int(sr * 0.25)
    k = len(mono) // pas
    niv = np.array([20 * np.log10(np.sqrt(np.mean(mono[i * pas:(i + 1) * pas] ** 2)) + 1e-12) for i in range(k)])
    plateau = np.median(niv[niv > -40])
    for i in range(k - 1, 0, -1):
        if niv[i] > plateau - 4:
            return (i + 1) * pas
    return len(mono)

def construire(chemin, sortie, fondu_s=1.6, fenetre_s=8.0, marge_s=45.0):
    x, sr = lire(chemin)
    mono = x.mean(axis=1)
    fin = fin_audible(mono, sr)
    flux, chroma, fps = analyser(mono, sr)
    W = int(fenetre_s * fps)
    hf, hc = normaliser(flux[:W]), chroma[:W]
    pmax = int(fin / SAUT) - W
    pmin = max(W, pmax - int(marge_s * fps))
    rythme, couleur = [], []
    for p in range(pmin, pmax):
        rythme.append(float(np.dot(normaliser(flux[p:p + W]), hf)))
        couleur.append(float(np.sum(chroma[p:p + W] * hc) / W))
    rythme = np.array(rythme); couleur = np.array(couleur)
    def cote(v):
        return (v - v.mean()) / (v.std() + 1e-9)
    total = cote(rythme) + cote(couleur)
    best = pmin + int(np.argmax(total))
    P = best * SAUT
    F = int(fondu_s * sr)
    # ⛔ ON NE REPLIE PLUS LA QUEUE SUR LA TETE DANS LE FICHIER. C'etait la
    # methode classique, et elle marche — tant que le lecteur boucle sans trou.
    # WKWebView ne le fait pas : mesure dans l'application, tampon plein, ~450 ms
    # de silence a chaque tour. Le fichier garde donc `fondu` secondes de matiere
    # APRES le point de boucle, et c'est le jeu qui croise les deux lecteurs
    # (voir ui/musique.js). Le fondu entendu est le meme ; il est simplement
    # calcule au vol, ce qui permet de masquer le calage du lecteur.
    corps = x[:P + F]
    ecrire(sortie, corps, sr)
    ordre = np.argsort(-total)[:5]
    return dict(fin=fin / sr, P=P / sr, duree=len(corps) / sr,
                rythme=float(rythme[best - pmin]), rythme_med=float(np.median(rythme)),
                couleur=float(couleur[best - pmin]), couleur_med=float(np.median(couleur)),
                ecart=float(total.max() - np.median(total)),
                tetes=[((pmin + i) * SAUT / sr, float(total[i])) for i in ordre])

if __name__ == '__main__':
    for src, dst, f in (("Tavern_Waltz.wav", "menu_boucle.wav", 1.6),
                        ("Windswept_Return.wav", "partie_boucle.wav", 2.0)):
        r = construire(src, dst, fondu_s=f)
        print("\n=== %s" % src)
        print("   fin ecrite a %.2f s | coupe a %.3f s | boucle de %.3f s" % (r['fin'], r['P'], r['duree']))
        print("   rythme  %.3f (mediane %.3f)   couleur %.3f (mediane %.3f)   ecart au lot %.2f sigma"
              % (r['rythme'], r['rythme_med'], r['couleur'], r['couleur_med'], r['ecart']))
        print("   cinq meilleurs points : " + ", ".join("%.2f s" % p for p, _ in r['tetes']))
