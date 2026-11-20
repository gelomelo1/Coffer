import { useQuery, useQueryClient } from "@tanstack/react-query";
import { querykeys } from "../const/querykeys";
import { PendingItem } from "../types/entities/pending";
import { pendingApi } from "../utils/pending_api";
import { usePagedQuery } from "./paged_query";

const byId = (x: PendingItem) => x.id;

/** A collection's waiting caps, newest first, 20 at a time. */
export const usePendingList = (collectionId: string | null) =>
  usePagedQuery<PendingItem>([querykeys.pending, collectionId], (page) => pendingApi.list(collectionId!, page), byId, { enabled: !!collectionId });

/** Waiting counts per collection (banners, badges, the Settings list). */
export const usePendingSummary = () => useQuery({ queryKey: [querykeys.pendingSummary], queryFn: pendingApi.summary });

/** After the list changed: reload the counts and the collection's items. */
export function useInvalidatePending() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: [querykeys.pendingSummary] });
    queryClient.invalidateQueries({ queryKey: [querykeys.pending] });
    // Item lists are keyed "itemsData<collectionId>".
    queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith(querykeys.itemsData) });
  };
}
