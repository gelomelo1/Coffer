import { endpoints } from "../const/endpoints";
import { ItemProvided } from "../types/entities/item";
import { QueryOptions } from "../types/helpers/query_data";
import { fetchPage, usePagedQuery } from "./paged_query";

/** What an item list needs to show its counts and load the next 20 at its end. */
export interface ItemPaging {
  /** Items (kinds) matching the filters, across all pages. */
  total: number;
  /** Pieces (sum of quantities) matching the filters, across all pages. */
  totalQuantity: number;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
}

const itemId = (item: ItemProvided) => item.id;

/** A collection's items with the user's filters and sort, 20 at a time. */
export function useCollectionItems(queryKey: string, collectionId: string, options: QueryOptions) {
  const query = usePagedQuery<ItemProvided>(
    [queryKey, options],
    (page) =>
      fetchPage<ItemProvided>(
        `${endpoints.items}/Page`,
        {
          filters: [{ filter: "Match", field: "collectionId", value: collectionId }, ...(options.filters ?? [])],
          sort: options.sort,
          filterConjunction: options.filterConjunction,
          filterTree: options.filterTree,
        },
        page,
      ),
    itemId,
  );
  const last = query.data?.pages[query.data.pages.length - 1] as { totalQuantity?: number } | undefined;
  const paging: ItemPaging = {
    total: query.total,
    totalQuantity: last?.totalQuantity ?? 0,
    hasMore: !!query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: query.loadMore,
  };
  return { ...query, paging };
}
