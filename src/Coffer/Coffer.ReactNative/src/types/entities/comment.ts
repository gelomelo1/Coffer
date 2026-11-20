import { UserSummary } from "./market";

export interface Mention {
  userId: string;
  name: string;
  /** The mentioned account was deleted: the name is empty and nothing is highlighted. */
  isDeleted?: boolean;
}

/**
 * A comment on a collection item. Deleted (by its author) and removed (by moderation) comments stay in the thread
 * with an empty body while they still have replies.
 */
export interface ItemComment {
  id: string;
  itemId: string;
  parentId?: string | null;
  /** Null for a deleted comment. */
  author?: UserSummary | null;
  /** The author owns the item (computed by the backend from the real ownership). */
  isOwner: boolean;
  body: string;
  mentions: Mention[];
  createdAt: string;
  editedAt?: string | null;
  isDeleted: boolean;
  isRemoved: boolean;
  canEdit: boolean;
  replies: ItemComment[];
}

export interface CommentPage {
  threads: ItemComment[];
  page: number;
  pageSize: number;
  totalThreads: number;
  totalComments: number;
}

export interface CommentInput {
  body: string;
  parentId?: string | null;
  mentionUserIds?: string[];
}
