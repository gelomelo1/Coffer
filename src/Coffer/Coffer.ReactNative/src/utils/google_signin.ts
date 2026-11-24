import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { env } from "../const/env";

// Configured once, when this module is first imported. The ID token is requested for the web client id, which the
// backend checks as the token's audience. Only profile and e-mail; no server auth code (offline access) is needed.
GoogleSignin.configure({
  webClientId: env.googleWebClientId,
  scopes: ["profile", "email"],
});

export { GoogleSignin };
