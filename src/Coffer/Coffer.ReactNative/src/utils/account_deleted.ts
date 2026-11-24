import { endDeletedAccountSession } from "./session_end";

/** The backend answers 401 { code: "accountDeleted" } to every request made with a deleted account's token. */
export const ACCOUNT_DELETED_CODE = "accountDeleted";

/**
 * Signs out after the account was deleted (here or on another device): forgets the tokens, empties the cached data,
 * ends the Google session and goes back to the start screen. Many requests can fail at once; signOut runs only once.
 * Like the normal log out, the user store's user is left alone: mounted screens read user! until navigation unmounts
 * them, and the next sign-in replaces it.
 */
export async function signOutDeletedAccount(): Promise<void> {
  await endDeletedAccountSession();
}
