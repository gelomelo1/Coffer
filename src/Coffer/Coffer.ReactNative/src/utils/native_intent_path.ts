/**
 * Facebook (fb{id}://authorize) and Reddit (…://oauth/reddit) send the in-app browser back to the app with the code.
 * The sign-in code reads that answer from the browser session; the router must not try to open it as a screen (there
 * is no such route), so these links stay on the sign-in screen. Every other link is left alone.
 */
export function systemPathFor(path: string): string {
  const withoutScheme = path.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/^\/+/, "");
  const route = withoutScheme.split(/[?#]/)[0];
  if (route === "oauth/reddit" || route === "authorize") return "/login";
  return path;
}
