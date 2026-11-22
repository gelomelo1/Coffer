import { useQuery } from "@tanstack/react-query";
import { communityApi } from "../utils/community_api";
import { useUserStore } from "./user_store";

/** Stats & facts. Keyed by the signed-in user: the "your contribution" part is personal. */
export function useCommunityStats() {
  const userId = useUserStore((s) => s.user?.id);
  return useQuery({ queryKey: ["communityStats", userId ?? ""], queryFn: communityApi.stats, enabled: !!userId });
}
