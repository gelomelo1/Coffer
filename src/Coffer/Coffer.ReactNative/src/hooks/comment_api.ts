import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import showToast from "../components/custom_ui/toast";
import { backendAxios } from "../const/backendAccessConfiguration";
import { endpoints } from "../const/endpoints";
import { querykeys } from "../const/querykeys";
import { CommentInput, CommentPage, ItemComment, Mention } from "../types/entities/comment";
import { apiErrorMessage } from "../utils/market_api";

const PAGE_SIZE = 10;

export const commentApi = {
  list: async (itemId: string, page: number) =>
    (await backendAxios.get<CommentPage>(`${endpoints.itemComments(itemId)}?page=${page}&pageSize=${PAGE_SIZE}`)).data,
  create: async (itemId: string, input: CommentInput) =>
    (await backendAxios.post<ItemComment>(endpoints.itemComments(itemId), input)).data,
  update: async (itemId: string, commentId: string, input: CommentInput) =>
    (await backendAxios.put<ItemComment>(`${endpoints.itemComments(itemId)}/${commentId}`, input)).data,
  remove: async (itemId: string, commentId: string) => {
    await backendAxios.delete(`${endpoints.itemComments(itemId)}/${commentId}`);
  },
  counts: async (itemIds: string[]) =>
    (await backendAxios.get<Record<string, number>>(`${endpoints.commentCounts}?${itemIds.map((id) => `itemIds=${id}`).join("&")}`)).data,
  mentionable: async (query: string) =>
    (await backendAxios.get<Mention[]>(`${endpoints.mentionable}?query=${encodeURIComponent(query)}&limit=6`)).data,
};

/** Threads of an item, newest first, 10 per page. */
export function useItemComments(itemId?: string | null) {
  return useInfiniteQuery({
    queryKey: [querykeys.itemComments, itemId],
    queryFn: ({ pageParam }) => commentApi.list(itemId!, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.totalThreads ? last.page + 1 : undefined),
    enabled: !!itemId,
  });
}

/** Visible comment count of one item (feed card button). */
export const useCommentCount = (itemId?: string | null) =>
  useQuery({
    queryKey: [querykeys.commentCounts, itemId],
    queryFn: async () => (await commentApi.counts([itemId!]))[itemId!] ?? 0,
    enabled: !!itemId,
    staleTime: 30000,
  });

/** Users to suggest after "@" (2+ letters). */
export const useMentionable = (query: string | null) =>
  useQuery({
    queryKey: [querykeys.mentionable, query?.toLowerCase()],
    queryFn: () => commentApi.mentionable(query!),
    enabled: query != null && query.length >= 1,
    staleTime: 60000,
  });

/** Comment mutations refresh the item's threads and its count. */
export function useCommentMutation<TArgs>(itemId: string, fn: (args: TArgs) => Promise<unknown>, successText?: string) {
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, TArgs>({
    mutationFn: fn,
    onSuccess: () => {
      if (successText) showToast("success", successText);
      queryClient.invalidateQueries({ queryKey: [querykeys.itemComments, itemId] });
      queryClient.invalidateQueries({ queryKey: [querykeys.commentCounts, itemId] });
    },
    onError: (error) => showToast("error", apiErrorMessage(error)),
  });
}
