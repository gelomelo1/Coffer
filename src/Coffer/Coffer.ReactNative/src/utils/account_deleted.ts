import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { router } from "expo-router";
import { removeToken } from "./token_store";

/** The backend answers 401 { code: "accountDeleted" } to every request made with a deleted account's token. */
export const ACCOUNT_DELETED_CODE = "accountDeleted";

let signingOut = false;

/**
 * Signs out after the account was deleted (here or on another device): forgets the token, ends the
 * Google session, and goes back to the start screen, which shows sign-in. Many requests can fail at once, so only
 * the first call does anything.
 */
export async function signOutDeletedAccount(): Promise<void> {
  if (signingOut) return;
  signingOut = true;
  try {
    try {
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
    } catch {
      // Not signed in with Google, or already signed out.
    }
    await removeToken();
    // Like the normal log out, the user store is left alone: mounted screens read user! until navigation unmounts
    // them, and the next sign-in replaces it.
    if (router.canDismiss()) router.dismissAll();
    router.replace("/");
  } finally {
    signingOut = false;
  }
}
