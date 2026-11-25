import { env } from "./env";

// Public identifiers only (no secrets): they appear in sign-in URLs anyway. Client secrets live on the backend.
// null = that sign-in is off (a debug build without the id in .env).

/** The Google web client id the native sign-in requests ID tokens for (the backend checks it as the token's audience). */
export const webGoogleClientId = env.googleWebClientId;

/** Facebook app id; Facebook redirects back to fb{id}://authorize (registered in app.config.ts). */
export const facebookAppId = env.facebookAppId;

/** Discord application id; Discord redirects back to discord-{id}:/authorize/callback (registered in app.config.ts). */
export const discordAppId = env.discordAppId;

/** The app's URL scheme (deep links and the GitHub redirect). */
export const authScheme = env.authScheme;
