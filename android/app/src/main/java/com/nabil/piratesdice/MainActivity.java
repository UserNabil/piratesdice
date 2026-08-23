package com.nabil.piratesdice;

import android.content.SharedPreferences;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;

/**
 * ⚠️ CETTE INTERFACE VIDE N'EST PAS DECORATIVE. Le greffon de connexion refuse
 * le mode « offline » — le seul qui rende un code d'autorisation pour le serveur
 * — tant que l'activite ne la porte pas : il verifie `instanceof` et repond
 * « You CANNOT use offline mode without modifying the main activity ».
 */
public class MainActivity extends BridgeActivity
        implements ModifiedMainActivityForSocialLoginPlugin {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        viderLeCacheSiNouvelleVersion();
    }

    /**
     * ⚠️ LA WEBVIEW GARDE SES IMAGES D'UNE MISE A JOUR A L'AUTRE, ET C'EST
     * INVISIBLE. Le jeu sert ses fichiers depuis le paquet, sous une adresse
     * fixe (`https://localhost/dice/img/...`) : la WebView les met en cache et
     * ne les redemande pas, meme quand l'application a change. Le joueur
     * installe la nouvelle version et retrouve les ANCIENNES images — sans
     * aucune erreur, sans aucun moyen de le deviner.
     *
     * On vide donc le cache une seule fois, quand le numero de version change.
     * Pas a chaque demarrage : ce serait payer un rechargement complet pour rien
     * a chaque ouverture.
     */
    private void viderLeCacheSiNouvelleVersion() {
        try {
            SharedPreferences prefs = getSharedPreferences("pd", MODE_PRIVATE);
            long vue = prefs.getLong("versionVue", -1);
            long actuelle = getPackageManager()
                    .getPackageInfo(getPackageName(), 0).getLongVersionCode();
            if (vue != actuelle) {
                if (this.bridge != null && this.bridge.getWebView() != null) {
                    this.bridge.getWebView().clearCache(true);
                }
                prefs.edit().putLong("versionVue", actuelle).apply();
            }
        } catch (Exception e) {
            /* Un cache qu'on n'a pas pu vider n'est pas une raison de ne pas
               ouvrir le jeu : au pire il reste une image d'hier. */
        }
    }

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
