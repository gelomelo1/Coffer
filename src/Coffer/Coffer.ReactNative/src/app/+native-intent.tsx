import { systemPathFor } from "../utils/native_intent_path";

/** Keeps the Facebook/Reddit sign-in redirects on the sign-in screen (see systemPathFor). Must never throw. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return systemPathFor(path);
  } catch {
    return path;
  }
}
