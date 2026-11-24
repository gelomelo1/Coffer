import { router } from "expo-router";
import { signOut } from "./session";

/** Leaves every screen and goes back to the start screen, which shows sign-in when there is no token. */
function backToStart(): void {
  if (router.canDismiss()) router.dismissAll();
  router.replace("/");
}

/** The session could not be refreshed (ended, revoked, or the refresh token was used elsewhere): sign in again. */
export async function endExpiredSession(): Promise<void> {
  await signOut({ callServer: false });
  backToStart();
}

/** The account was deleted (here or on another device). The server already ended every session of it. */
export async function endDeletedAccountSession(): Promise<void> {
  await signOut({ callServer: false });
  backToStart();
}
