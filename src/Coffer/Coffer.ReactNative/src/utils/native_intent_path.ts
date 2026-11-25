/**
 * The provider pages send the in-app browser back to the app with the code: Facebook (fb{id}://authorize), Discord
 * (discord-{id}:/authorize/callback) and GitHub (…://oauth/github). The sign-in code reads that answer from the
 * browser session; the router must not try to open it as a screen (there is no such route), so these links stay on
 * the sign-in screen. Every other link is left alone.
 */
const AUTH_REDIRECT_ROUTES = new Set(["authorize", "authorize/callback", "oauth/github"]);

export function systemPathFor(path: string): string {
  const withoutScheme = path.replace(/^[a-z][a-z0-9+.-]*:\/*/i, "").replace(/^\/+/, "");
  const route = withoutScheme.split(/[?#]/)[0];
  return AUTH_REDIRECT_ROUTES.has(route) ? "/login" : path;
}
