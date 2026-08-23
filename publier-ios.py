#!/usr/bin/env python3
"""publier-ios.py — assembler, verifier, signer et envoyer la version iOS.

Meme esprit que build.py : chaque etape peut REFUSER, et refuse bruyamment. Un
envoi rate coute une heure ; un envoi qui part avec le mauvais contenu coute une
revue Apple, c'est-a-dire des jours.

⚠️ LE NUMERO DE BUILD SE PASSE, IL NE SE DEVINE PAS. Apple refuse un numero deja
utilise et il ne redescend jamais. Aucune valeur par defaut ici : c'est voulu.

Usage :
    python3 publier-ios.py --build 2 --verifier          # ne construit rien
    python3 publier-ios.py --build 2                     # construit + verifie
    python3 publier-ios.py --build 2 --envoyer           # ... et envoie a Apple

Pour --envoyer, la cle d'API App Store Connect :
    PD_ASC_KEY_ID     l'identifiant de la cle (le XXXX de AuthKey_XXXX.p8)
    PD_ASC_ISSUER     l'emetteur de cette cle (Users and Access > Integrations)
La cle elle-meme est cherchee dans ~/.appstoreconnect/private/
"""
import argparse
import hashlib
import os
import plistlib
import re
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

HERE = os.path.dirname(os.path.abspath(__file__))
IOS = os.path.join(HERE, "ios", "App")
DIST = os.path.join(HERE, "dist", "ios")
ARCHIVE = os.path.join(DIST, "PiratesDice.xcarchive")
BUNDLE = "com.nabil.piratesdice"
TEAM = "SH5SUTCKZT"
SERVEUR = "https://dice.my-officeapps.com"


def dire(texte):
    print(texte, flush=True)


def refuser(texte):
    sys.exit("REFUS : " + texte)


def courir(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        dire(r.stdout[-3000:])
        dire(r.stderr[-3000:])
        refuser("la commande a echoue : " + " ".join(cmd[:3]) + " …")
    return r.stdout


# ── 0. le numero de build : c'est APPLE qui le sait ─────────────────────────

APP_ID = "6804324160"


def prochain_build():
    """⚠️ NE DEDUIS JAMAIS LE NUMERO D'UN COMPTEUR LOCAL. La chaine Android l'a
    fait et a echoue douze fois de suite sans que personne le voie : des envois
    partaient aussi a la main, avec leur propre compte. Deux compteurs pour une
    seule suite, et la collision ne tombe qu'a la DERNIERE etape — apres un build
    complet et signe. App Store Connect est la seule autorite sur ce qui est
    pris : on lui demande."""
    import asc
    d = asc.appel("GET", "/v1/apps/%s/builds?limit=200" % APP_ID)
    pris = []
    for b in d.get("data", []):
        try:
            pris.append(int(b["attributes"]["version"]))
        except (KeyError, TypeError, ValueError):
            pass
    apple = max(pris) if pris else 0

    # ⚠️ APPLE MET UNE MINUTE A RECONNAITRE UN ENVOI, ET PENDANT CETTE MINUTE IL
    # REDONNE LE NUMERO DEJA PRIS. Vecu : le build 3 venait de partir, la liste
    # ne le montrait pas encore, la construction suivante a refait un 3 — refuse
    # a la validation, apres un build complet et signe. On garde donc une trace
    # locale de ce qu'on a envoye, et on prend le plus grand des deux.
    trace = os.path.join(DIST, "dernier-build.txt")
    local = 0
    if os.path.isfile(trace):
        try:
            local = int(open(trace).read().strip())
        except ValueError:
            pass
    suivant = max(apple, local) + 1
    os.makedirs(DIST, exist_ok=True)
    open(trace, "w").write(str(suivant))
    return suivant


# ── 1. le contenu ────────────────────────────────────────────────────────────

def verifier_www():
    """Le meme controle que build.py, mais on le REFAIT ici : le www/ present
    n'est pas forcement celui qu'on vient d'assembler."""
    courir([sys.executable, os.path.join(HERE, "build.py"), "--check"], cwd=HERE)
    page = open(os.path.join(HERE, "www", "index.html"), encoding="utf-8").read()
    adresses = set(re.findall(r"server:\s*'([^']+)'", page))
    if not adresses:
        refuser("index.html ne grave aucune adresse de serveur.")
    for a in adresses:
        if not a.startswith("https://"):
            refuser("adresse non HTTPS dans la page : %s — Apple refuse le clair." % a)
    dire("  contenu   : www/ resout, serveur %s" % ", ".join(adresses))


# ── 2. la construction ───────────────────────────────────────────────────────

def poser_version(build):
    """Le numero de build dans le projet Xcode, en une seule ecriture."""
    p = os.path.join(IOS, "App.xcodeproj", "project.pbxproj")
    s = open(p, encoding="utf-8").read()
    s2 = re.sub(r"CURRENT_PROJECT_VERSION = \d+;",
                "CURRENT_PROJECT_VERSION = %d;" % build, s)
    if s2 == s and ("CURRENT_PROJECT_VERSION = %d;" % build) not in s:
        refuser("CURRENT_PROJECT_VERSION introuvable dans le projet Xcode.")
    open(p, "w", encoding="utf-8").write(s2)


def construire(build):
    courir([sys.executable, os.path.join(HERE, "build.py"), "--server", SERVEUR,
            "--build", str(build)], cwd=HERE)
    verifier_www()
    poser_version(build)
    courir(["npx", "cap", "sync", "ios"], cwd=HERE)

    shutil.rmtree(ARCHIVE, ignore_errors=True)
    dire("  archive   : xcodebuild (quelques minutes)…")
    courir(["xcodebuild", "-workspace", "App.xcworkspace", "-scheme", "App",
            "-configuration", "Release", "-destination", "generic/platform=iOS",
            "-archivePath", ARCHIVE, "archive", "-allowProvisioningUpdates"], cwd=IOS)

    options = os.path.join(DIST, "export.plist")
    plistlib.dump({"method": "app-store-connect", "teamID": TEAM,
                   "signingStyle": "automatic", "uploadSymbols": True,
                   "destination": "export"}, open(options, "wb"))
    sortie = os.path.join(DIST, "export")
    shutil.rmtree(sortie, ignore_errors=True)
    courir(["xcodebuild", "-exportArchive", "-archivePath", ARCHIVE,
            "-exportOptionsPlist", options, "-exportPath", sortie,
            "-allowProvisioningUpdates"])
    return os.path.join(sortie, "App.ipa")


# ── 3. l'IPA, controle piece par piece ───────────────────────────────────────

def verifier_ipa(ipa, build):
    if not os.path.isfile(ipa):
        refuser("aucun IPA a %s" % ipa)
    with zipfile.ZipFile(ipa) as z:
        noms = z.namelist()
        jeu = [n for n in noms if n.startswith("Payload/App.app/public/")]
        # ⚠️ « Le fichier essaye n'est pas toujours celui construit. » Le jeu doit
        # etre DANS le bundle, pas seulement sur le disque a cote.
        if len(jeu) < 100:
            refuser("le jeu n'est pas dans le bundle : %d fichiers sous public/" % len(jeu))
        info = plistlib.loads(z.read("Payload/App.app/Info.plist"))

    if info["CFBundleIdentifier"] != BUNDLE:
        refuser("bundle %s au lieu de %s" % (info["CFBundleIdentifier"], BUNDLE))
    if str(info["CFBundleVersion"]) != str(build):
        refuser("build %s dans l'IPA, %s demande" % (info["CFBundleVersion"], build))
    if info.get("ITSAppUsesNonExemptEncryption") is not False:
        refuser("ITSAppUsesNonExemptEncryption absent : la soumission restera bloquee.")

    # La signature : distribution, pas developpement.
    dossier = os.path.join(DIST, "_ouvert")
    shutil.rmtree(dossier, ignore_errors=True)
    with zipfile.ZipFile(ipa) as z:
        z.extractall(dossier)
    app = os.path.join(dossier, "Payload", "App.app")
    signature = subprocess.run(["codesign", "-dvvv", app], capture_output=True, text=True).stderr
    if "Apple Distribution" not in signature:
        refuser("l'IPA est signe en developpement, pas en distribution.")
    if TEAM not in signature:
        refuser("equipe de signature inattendue.")
    shutil.rmtree(dossier, ignore_errors=True)

    dire("  ipa       : %d fichiers de jeu, version %s build %s, Apple Distribution %s"
         % (len(jeu), info["CFBundleShortVersionString"], info["CFBundleVersion"], TEAM))
    return info


def manifeste(ipa, info):
    """⚠️ MEME NOM, MEME TAILLE, PAS LE MEME FICHIER : ca s'est deja produit. Le
    SHA-256 est le seul moyen de dire QUEL fichier a ete essaye."""
    sha = hashlib.sha256(open(ipa, "rb").read()).hexdigest()
    git = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=HERE,
                         capture_output=True, text=True).stdout.strip()
    sale = subprocess.run(["git", "status", "--porcelain"], cwd=HERE,
                          capture_output=True, text=True).stdout.count("\n")
    texte = "\n".join([
        "MANIFESTE — The Pirate's Dice, iOS",
        "genere le : " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "",
        "fichier      : " + os.path.basename(ipa),
        "taille       : %d octets" % os.path.getsize(ipa),
        "sha-256      : " + sha,
        "bundle       : " + info["CFBundleIdentifier"],
        "version      : %s   build : %s" % (info["CFBundleShortVersionString"],
                                            info["CFBundleVersion"]),
        "iOS minimum  : " + str(info.get("MinimumOSVersion", "?")),
        "serveur      : " + SERVEUR,
        "git          : %s (%d fichier(s) modifie(s))" % (git, sale),
        ""])
    open(os.path.join(DIST, "MANIFESTE.txt"), "w", encoding="utf-8").write(texte)
    dire(texte)


# ── 4. l'envoi ───────────────────────────────────────────────────────────────

def envoyer(ipa):
    cle = os.environ.get("PD_ASC_KEY_ID")
    emetteur = os.environ.get("PD_ASC_ISSUER")
    if not cle or not emetteur:
        refuser("PD_ASC_KEY_ID ou PD_ASC_ISSUER absent.\n"
                "  L'emetteur se lit dans App Store Connect > Users and Access >\n"
                "  Integrations > App Store Connect API, colonne « Issuer ID ».")
    dire("  validation: altool…")
    courir(["xcrun", "altool", "--validate-app", "-f", ipa, "-t", "ios",
            "--apiKey", cle, "--apiIssuer", emetteur])
    dire("  envoi     : altool…")
    dire(courir(["xcrun", "altool", "--upload-app", "-f", ipa, "-t", "ios",
                 "--apiKey", cle, "--apiIssuer", emetteur])[-1500:])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--build", type=int,
                    help="le numero de build ; sans lui, il est DEMANDE a Apple")
    ap.add_argument("--prochain", action="store_true",
                    help="affiche le prochain numero libre et s'arrete")
    ap.add_argument("--verifier", action="store_true", help="ne construit rien")
    ap.add_argument("--envoyer", action="store_true", help="envoie a App Store Connect")
    args = ap.parse_args()

    os.makedirs(DIST, exist_ok=True)
    if args.prochain:
        dire(str(prochain_build()))
        return
    if args.build is None:
        args.build = prochain_build()
        dire("build %d (le suivant du plus haut recu par Apple)" % args.build)
    if args.verifier:
        verifier_www()
        return

    dire("construction de la version iOS, build %d" % args.build)
    ipa = construire(args.build)
    final = os.path.join(DIST, "PiratesDice-%s-build%d.ipa"
                         % (plistlib.loads(zipfile.ZipFile(ipa).read(
                             "Payload/App.app/Info.plist"))["CFBundleShortVersionString"],
                            args.build))
    shutil.copy2(ipa, final)
    info = verifier_ipa(final, args.build)
    manifeste(final, info)
    if args.envoyer:
        envoyer(final)
    else:
        dire("Pas envoye (ajoute --envoyer).")


if __name__ == "__main__":
    main()
