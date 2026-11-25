import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { env } from "../const/env";

/** False in a debug build without EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: the Google button then says it isn't set up. */
export const googleSignInEnabled = env.googleWebClientId !== null;

// Configured once, when this module is first imported. The ID token is requested for the web client id, which the
// backend checks as the token's audience. Only profile and e-mail; no server auth code (offline access) is needed.
if (env.googleWebClientId) {
  GoogleSignin.configure({
    webClientId: env.googleWebClientId,
    scopes: ["profile", "email"],
  });
}

export { GoogleSignin };
