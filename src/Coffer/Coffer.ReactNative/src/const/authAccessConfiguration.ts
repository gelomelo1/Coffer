import { env } from "./env";

// Public identifiers only (no secrets): they appear in sign-in URLs anyway. Client secrets live on the backend.

/** The Google web client id the native sign-in requests ID tokens for (the backend checks it as the token's audience). */
export const webGoogleClientId = env.googleWebClientId;

/** Facebook app id; Facebook redirects back to fb{id}://authorize (registered in app.config.ts). */
export const facebookAppId = env.facebookAppId;

/** The app's URL scheme (deep links and the Reddit redirect). */
export const authScheme = env.authScheme;
