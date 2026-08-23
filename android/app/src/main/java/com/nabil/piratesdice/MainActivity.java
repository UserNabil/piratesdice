package com.nabil.piratesdice;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;

/**
 * ⚠️ CETTE INTERFACE VIDE N'EST PAS DECORATIVE. Le greffon de connexion refuse
 * le mode « offline » — le seul qui rende un code d'autorisation pour le serveur
 * — tant que l'activite ne la porte pas : il verifie `instanceof` et repond
 * « You CANNOT use offline mode without modifying the main activity ». C'est sa
 * facon de s'assurer que l'hote a bien ete prepare.
 *
 * ⛔ L'ANCIEN PONT VERS PLAY GAMES EST PARTI, ET IL NE MARCHAIT PAS. Il etait
 * enregistre ici et demandait les portees `games_lite` SANS jamais passer de
 * `serverClientId` : Google repondait DEVELOPER_ERROR et aucun code ne pouvait
 * remonter au serveur. C'est la raison pour laquelle la connexion Google n'a
 * jamais fonctionne — pas un reglage manquant, un pont incomplet.
 */
public class MainActivity extends BridgeActivity
        implements ModifiedMainActivityForSocialLoginPlugin {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
