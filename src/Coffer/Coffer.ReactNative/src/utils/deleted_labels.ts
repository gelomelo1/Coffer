import type { TFunction } from "i18next";

/**
 * Deleted accounts and their listings come back from the API as placeholders (isDeleted / listingDeleted, empty
 * name or title). These turn them into the translated "Deleted user" / "Deleted user's listing" labels.
 */
type Named = { name: string; isDeleted?: boolean } | null | undefined;

/** The user's name, or "Deleted user" for a deleted (or missing) account. */
export function userLabel(user: Named, t: TFunction): string {
  return !user || user.isDeleted ? t("common:deleted.user") : user.name;
}

/** The listing title, or "Deleted user's listing" when it went with its owner's account. */
export function listingLabel(title: string, deleted: boolean | undefined, t: TFunction): string {
  return deleted ? t("common:deleted.listing") : title;
}
