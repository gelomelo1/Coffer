import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { backendAxios } from "../const/backendAccessConfiguration";
import { endpoints } from "../const/endpoints";

/** How many distinct items use a tag, across the whole app (GET api/Feed/TagStats). */
export interface TagStat {
  tag: string;
  itemCount: number;
}

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/** Most used existing tags containing the text being typed (debounced; nothing for an empty token). */
export function useTagSuggestions(token: string | null) {
  const search = useDebounced(token ?? "", 250);
  return useQuery({
    queryKey: ["tagStats", "search", search],
    queryFn: async () => (await backendAxios.get<TagStat[]>(`${endpoints.feed}/TagStats`, { params: { search } })).data,
    enabled: search.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/** Usage counts for the tags already in the field (0 = new tag). */
export function useTagCounts(tags: string[]) {
  const key = useDebounced(tags.join(","), 400);
  return useQuery({
    queryKey: ["tagStats", "exact", key],
    queryFn: async () => (await backendAxios.get<TagStat[]>(`${endpoints.feed}/TagStats`, { params: { tags: key } })).data,
    enabled: key.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
