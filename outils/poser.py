#!/usr/bin/env python3
"""
outils/poser.py — POSER LE JEU SUR LE SIMULATEUR, SANS MONTRER DU VIEUX.

    python3 outils/poser.py

⛔ RSYNCER `www/` DANS L'APP NE SUFFIT PAS, ET C'EST UN PIEGE QUI A COUTE UNE
SOIREE. Le fichier corrige arrive bien dans le paquet — verifie a l'octet — mais
la WebView continue de servir sa COPIE EN CACHE : l'adresse n'a pas change, donc
pour elle rien n'a change. On corrige, on pose, on relance, et l'admin voit
toujours l'ancienne image. « Tu as deploye ? car c'est encore casse. »

Un vrai joueur ne rencontre jamais cela : il installe un paquet neuf, avec un
cache vide. Le probleme n'appartient qu'a cette facon de poser — remplacer des
fichiers sous des noms inchangés dans une application deja installee — et c'est
donc ici qu'il se regle, pas dans le jeu.

⚠️ ON NE DESINSTALLE PAS POUR AUTANT. Cela viderait aussi le stockage local :
session, langue, jetons hors ligne, derniere position au classement. On ne
supprime que les deux dossiers de cache.
"""
import os
import subprocess
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
APPID = 'com.nabil.piratesdice'


def simctl(*args, silencieux=False):
    r = subprocess.run(['xcrun', 'simctl'] + list(args),
                       capture_output=True, text=True)
    if r.returncode and not silencieux:
        sys.exit('simctl %s a echoue : %s' % (args[0], (r.stderr or '').strip()))
    return r.stdout.strip()


def main():
    paquet = simctl('get_app_container', 'booted', APPID, 'app')
    donnees = simctl('get_app_container', 'booted', APPID, 'data')
    if not paquet:
        sys.exit("l'application n'est pas installee sur le simulateur")

    subprocess.run(['rsync', '-a', '--delete',
                    os.path.join(RACINE, 'www') + '/',
                    os.path.join(paquet, 'public') + '/'], check=True)

    simctl('terminate', 'booted', APPID, silencieux=True)

    vides = 0
    for dossier in ('Library/Caches', 'Library/WebKit'):
        chemin = os.path.join(donnees, dossier)
        if not os.path.isdir(chemin):
            continue
        for nom in os.listdir(chemin):
            subprocess.run(['rm', '-rf', os.path.join(chemin, nom)])
            vides += 1

    simctl('launch', 'booted', APPID)
    print('pose : www/ recopie, %d entrees de cache videes, application relancee' % vides)


main()
