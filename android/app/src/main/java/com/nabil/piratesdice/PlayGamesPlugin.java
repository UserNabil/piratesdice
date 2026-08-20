package com.nabil.piratesdice;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.GamesSignInClient;
import com.google.android.gms.games.PlayGames;

/**
 * LE PONT VERS GOOGLE PLAY GAMES.
 *
 * Le telephone ne declare jamais son identite : il demande a Google un
 * « server auth code », un jeton a usage unique qui ne prouve rien tout seul.
 * C'est le serveur qui l'echange chez Google et decide qui est le joueur
 * (dice_server/src/google.js). Un APK se decompile ; une identite declaree par
 * le client serait une identite volable.
 *
 * `signIn({interactive:false})` est appele a l'ouverture : si le joueur est deja
 * connecte a Play Games, il ne voit rien passer. `interactive:true` n'arrive que
 * s'il clique lui-meme dans les reglages — on n'impose jamais un ecran de
 * connexion a quelqu'un qui veut juste jouer.
 */
@CapacitorPlugin(name = "PlayGames")
public class PlayGamesPlugin extends Plugin {

    /** Le client OAuth WEB : c'est pour lui que le code est emis, et le serveur en a le secret. */
    private static final String WEB_CLIENT_ID =
            "975326394375-5rrfp97jmjtmqggser8jvc3ec8mvplii.apps.googleusercontent.com";

    @PluginMethod
    public void signIn(final PluginCall call) {
        final boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", false));
        final GamesSignInClient client = PlayGames.getGamesSignInClient(getActivity());

        client.isAuthenticated().addOnCompleteListener(task -> {
            boolean signedIn = task.isSuccessful()
                    && task.getResult() != null
                    && task.getResult().isAuthenticated();

            if (signedIn) {
                requestServerCode(call, client);
                return;
            }
            if (!interactive) {
                call.reject("not signed in to Play Games");
                return;
            }
            client.signIn().addOnCompleteListener(second -> {
                boolean ok = second.isSuccessful()
                        && second.getResult() != null
                        && second.getResult().isAuthenticated();
                if (ok) {
                    requestServerCode(call, client);
                } else {
                    call.reject("Play Games sign-in was refused");
                }
            });
        });
    }

    /**
     * Le code de serveur. Il vaut une seule fois et quelques minutes : on ne le
     * garde donc nulle part cote telephone, on le passe et on l'oublie.
     */
    private void requestServerCode(final PluginCall call, final GamesSignInClient client) {
        client.requestServerSideAccess(WEB_CLIENT_ID, false).addOnCompleteListener(task -> {
            if (!task.isSuccessful() || task.getResult() == null) {
                Exception error = task.getException();
                call.reject("Play Games refused the server code"
                        + (error != null ? " : " + error.getMessage() : ""));
                return;
            }
            JSObject out = new JSObject();
            out.put("serverAuthCode", task.getResult());
            call.resolve(out);
        });
    }

    /**
     * Play Games n'offre pas de deconnexion programmatique — c'est le compte
     * Google du telephone qui decide. On rend la main sans mentir : l'appelant
     * repasse en compte invite de son cote.
     */
    @PluginMethod
    public void signOut(PluginCall call) {
        JSObject out = new JSObject();
        out.put("signedOut", false);
        out.put("reason", "Play Games sign-out is handled by the Google account, not by the app");
        call.resolve(out);
    }
}
