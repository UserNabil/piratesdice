package com.nabil.piratesdice;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.google.android.gms.games.PlayGamesSdk;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        /* Le pont vers Play Games doit etre declare AVANT que la page ne se
           charge : le front l'interroge des l'ouverture. */
        registerPlugin(PlayGamesPlugin.class);
        super.onCreate(savedInstanceState);
        PlayGamesSdk.initialize(this);
    }
}
