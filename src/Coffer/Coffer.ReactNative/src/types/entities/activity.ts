/** The sub-pages of My activity, in menu order (same list as the backend's ActivityKinds.Categories). */
export const ACTIVITY_CATEGORIES = ["likes", "comments", "collection", "follows", "marketplace", "trades", "reports", "contribution"] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

/** What an entry points at, resolved by the backend when the log is read (names are never stored in the log). */
export interface ActivityTarget {
  type: "item" | "collection" | "comment" | "listing" | "conversation" | "deal" | "review" | "report" | "contribution" | "none";
  id: string | null;
  itemId: string | null;
  collectionId: string | null;
  commentId: string | null;
  listingId: string | null;
  conversationId: string | null;
  dealId: string | null;
  title: string;
  /** File name of the item / collection / listing image; null when there is none or the target is gone. */
  image: string | null;
  /** The comment's text (own comments only). */
  excerpt: string | null;
  /** False when the target was deleted or the other person deleted their account: shown muted, not tappable. */
  available: boolean;
  /** The other person in a chat or deal; "" when they deleted their account. */
  otherName: string | null;
}

/** One thing the user did, e.g. kind "reaction.rerated" with details { from: 3, to: 5 }. */
export interface ActivityEntry {
  id: string;
  kind: string;
  category: ActivityCategory;
  occurredAt: string;
  details: Record<string, unknown>;
  target: ActivityTarget;
}

/** One menu row of My activity. */
export interface ActivityCategorySummary {
  category: ActivityCategory;
  count: number;
  latestAt: string | null;
}
