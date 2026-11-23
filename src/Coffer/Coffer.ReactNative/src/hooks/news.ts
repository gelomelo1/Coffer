import { useQuery } from "@tanstack/react-query";
import { NewsCard } from "../types/entities/news";
import { newsApi } from "../utils/news_api";
import { usePagedQuery } from "./paged_query";
import { useUserStore } from "./user_store";

const byId = (n: NewsCard) => n.id;

/** Published news, newest first, 20 at a time. Keyed by the signed-in user like the other community data. */
export function useNews() {
  const userId = useUserStore((s) => s.user?.id);
  return usePagedQuery<NewsCard>(["news", userId ?? ""], (page) => newsApi.list(page), byId, { enabled: !!userId });
}

export function useNewsPost(id?: string | null) {
  const userId = useUserStore((s) => s.user?.id);
  return useQuery({ queryKey: ["newsPost", userId ?? "", id], queryFn: () => newsApi.post(id!), enabled: !!userId && !!id, retry: false });
}
