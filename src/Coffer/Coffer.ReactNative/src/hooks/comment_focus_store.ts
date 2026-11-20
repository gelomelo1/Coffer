import { create } from "zustand";

/**
 * A comment to bring into view when an item page opens (from My activity). The item's comment section scrolls to
 * it, highlights it for a moment and clears this, so it happens once.
 */
interface CommentFocusStore {
  itemId: string | null;
  commentId: string | null;
  focus: (itemId: string, commentId: string) => void;
  clear: () => void;
}

export const useCommentFocusStore = create<CommentFocusStore>((set) => ({
  itemId: null,
  commentId: null,
  focus: (itemId, commentId) => set({ itemId, commentId }),
  clear: () => set({ itemId: null, commentId: null }),
}));
