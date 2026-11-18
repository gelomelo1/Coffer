import { InfiniteData, QueryKey, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { QueryOptions } from "../types/helpers/query_data";
import { backendAxios } from "../const/backendAccessConfiguration";
import { endpoints } from "../const/endpoints";
import buildQuery from "../utils/query_builder";
import { GroupedPaged, mergePages, nextPageParam, PAGE_SIZE, Paged } from "../utils/paging";

/** One page of a filtered/sorted list endpoint (generic ones: "api/Items/Page"). */
export async function fetchPage<T>(apiPath: string, options: QueryOptions | undefined, page: number): Promise<Paged<T>> {
  const query = buildQuery({ ...(options ?? {}), page, pageSize: PAGE_SIZE });
  return (await backendAxios.get<Paged<T>>(`${apiPath}/${query}`)).data;
}

/** A user's collections grouped by type; types sorted "name" A–Z, the others newest first. */
export async function fetchGroupedCollections<T>(userId: string, sorts: Record<number, "name" | "createdAt">, page: number) {
  const byName = Object.entries(sorts)
    .filter(([, sort]) => sort === "name")
    .map(([id]) => id)
    .join(",");
  const url = `${endpoints.collections}/Grouped?userId=${userId}&byName=${byName}&page=${page}&pageSize=${PAGE_SIZE}`;
  return (await backendAxios.get<GroupedPaged<T>>(url)).data;
}

interface PagedQueryOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

/**
 * A list that loads 20 entries at a time: call loadMore when the user reaches the end. items = all loaded pages
 * (de-duplicated), total = how many match the current filters, groupCounts for lists grouped by collection type.
 */
export function usePagedQuery<T>(
  queryKey: QueryKey,
  fetchPage: (page: number) => Promise<Paged<T> | GroupedPaged<T>>,
  idOf: (item: T) => string,
  options: PagedQueryOptions = {},
) {
  const queryClient = useQueryClient();
  const query = useInfiniteQuery<Paged<T> | GroupedPaged<T>, Error, InfiniteData<Paged<T> | GroupedPaged<T>>, QueryKey, number>({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
    refetchOnWindowFocus: false,
    ...options,
  });
  const pages = query.data?.pages;
  const items = useMemo(() => mergePages(pages ?? [], idOf), [pages, idOf]);
  const last = pages?.[pages.length - 1];
  const groupCounts = (last as GroupedPaged<T> | undefined)?.groupCounts ?? {};

  const loadMore = () => {
    if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
  };

  /** Pull to refresh: start again from the first page (keeps it on screen while it reloads). */
  const refresh = () => {
    queryClient.setQueryData<InfiniteData<Paged<T>, number>>(queryKey, (d) => d && { pages: d.pages.slice(0, 1), pageParams: d.pageParams.slice(0, 1) });
    return query.refetch();
  };

  // The pull-to-refresh spinner follows the pull only (not background polling or "load more").
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  return { ...query, items, total: last?.total ?? 0, groupCounts, loadMore, refresh, refreshing, onRefresh };
}
