import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import showToast from "../components/custom_ui/toast";
import { querykeys } from "../const/querykeys";
import { ListingFilters, MyListingsFilter } from "../types/entities/market";
import { apiErrorCode, apiErrorMessage, marketApi } from "../utils/market_api";
import { mergeMessagePages } from "../utils/paging";
import { useMarketStore } from "./market_store";
import { usePagedQuery } from "./paged_query";

const byId = (x: { id: string }) => x.id;

export const useListings = (filters: ListingFilters) =>
  usePagedQuery([querykeys.marketListings, filters], (page) => marketApi.searchListings(filters, page), byId);

export const useMyListings = (filter?: MyListingsFilter) =>
  usePagedQuery([querykeys.marketMyListings, filter ?? "all"], (page) => marketApi.myListings(filter, page), byId);

/** { active, sold, archived } counts for the My Listings chips. */
export const useMyListingCounts = () =>
  useQuery({ queryKey: [querykeys.marketMyListingCounts], queryFn: marketApi.myListingCounts });

export const useListing = (id?: string | null) =>
  useQuery({
    queryKey: [querykeys.marketListing, id],
    queryFn: () => marketApi.getListing(id!),
    enabled: !!id,
  });

export const useCitySearch = (q: string) =>
  useQuery({
    queryKey: [querykeys.marketCities, q.trim().toLowerCase()],
    queryFn: () => marketApi.searchCities(q.trim()),
    enabled: q.trim().length >= 2,
    staleTime: 60 * 60 * 1000,
  });

/** Inbox a page at a time, refreshed every 20 s while mounted; subjectId = only the chats about one listing. */
export const useInbox = (subjectId?: string | null, enabled = true) =>
  usePagedQuery([querykeys.marketInbox, subjectId ?? "all"], (page) => marketApi.inbox(page, subjectId ?? undefined), byId, {
    refetchInterval: 20000,
    enabled,
  });

/** Unread messages and deals waiting for me (marketplace tab badges). */
export const useMarketBadges = () =>
  useQuery({ queryKey: [querykeys.marketInbox, "badges"], queryFn: marketApi.badges, refetchInterval: 20000 });

export const useConversation = (id?: string | null) =>
  useQuery({
    queryKey: [querykeys.marketConversation, id],
    queryFn: () => marketApi.conversation(id!),
    enabled: !!id,
    refetchInterval: 8000,
  });

/**
 * Open chat: the newest 20 messages, polled every 4 s; loadOlder fetches the 20 before the oldest loaded one (when
 * the user scrolls up). messages are oldest first.
 */
export function useMessages(id?: string | null) {
  const query = useInfiniteQuery({
    queryKey: [querykeys.marketMessages, id],
    queryFn: ({ pageParam }) => marketApi.messages(id!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore && last.items.length > 0 ? last.items[0].createdAt : undefined),
    enabled: !!id,
    refetchInterval: 4000,
  });
  const pages = query.data?.pages;
  const messages = useMemo(() => mergeMessagePages(pages ?? []), [pages]);
  const loadOlder = () => {
    if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
  };
  return { ...query, messages, loadOlder };
}

export const useMyDeals = () =>
  usePagedQuery([querykeys.marketDeals], (page) => marketApi.myDeals(page), byId, { refetchInterval: 20000 });

export const useDeal = (id?: string | null) =>
  useQuery({
    queryKey: [querykeys.marketDeal, id],
    queryFn: () => marketApi.deal(id!),
    enabled: !!id,
    refetchInterval: 5000,
  });

export const useCarriers = () =>
  useQuery({ queryKey: [querykeys.marketCarriers], queryFn: marketApi.carriers, staleTime: Infinity });

export const useDealReviews = (dealId?: string | null) =>
  useQuery({
    queryKey: [querykeys.marketDealReviews, dealId],
    queryFn: () => marketApi.dealReviews(dealId!),
    enabled: !!dealId,
  });

export const useReputation = (userId?: string | null) =>
  useQuery({
    queryKey: [querykeys.marketReputation, userId],
    queryFn: () => marketApi.reputation(userId!),
    enabled: !!userId,
  });

export const useUserReviews = (userId?: string | null, enabled = true) =>
  usePagedQuery([querykeys.marketUserReviews, userId], (page) => marketApi.userReviews(userId!, page), byId, { enabled: !!userId && enabled });

export const useReportRules = () =>
  useQuery({ queryKey: [querykeys.reportRules], queryFn: marketApi.reportRules, staleTime: Infinity });

export const useMyReports = () => usePagedQuery([querykeys.myReports], (page) => marketApi.myReports(page), byId);

export const useAgainstMe = () => usePagedQuery([querykeys.againstMe], (page) => marketApi.againstMe(page), byId);

/** Unseen moderation notices about my content (badge in Settings). */
export const useAgainstMeUnseen = () =>
  useQuery({ queryKey: [querykeys.againstMeUnseen], queryFn: marketApi.againstMeUnseen, refetchInterval: 60000 });

export const useTerms = () => useQuery({ queryKey: [querykeys.marketTerms], queryFn: marketApi.terms });

/** Marketplace mutations refresh every marketplace query and show the backend's own error text. */
const MARKET_KEYS = [
  querykeys.marketListings,
  querykeys.marketMyListings,
  querykeys.marketMyListingCounts,
  querykeys.marketListing,
  querykeys.marketInbox,
  querykeys.marketConversation,
  querykeys.marketMessages,
  querykeys.marketDeals,
  querykeys.marketDeal,
  querykeys.marketDealReviews,
  querykeys.marketReputation,
  querykeys.marketUserReviews,
  querykeys.myReports,
  querykeys.againstMe,
  querykeys.againstMeUnseen,
  querykeys.marketTerms,
];

export function useMarketMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, successText?: string) {
  const queryClient = useQueryClient();
  return useMutation<TResult, unknown, TArgs>({
    mutationFn: fn,
    onSuccess: () => {
      if (successText) showToast("success", successText);
      MARKET_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    },
    onError: (error) => {
      if (apiErrorCode(error) === "terms_required") {
        // The terms gate on the Market tab takes over.
        useMarketStore.getState().setTermsNeeded(true);
        queryClient.invalidateQueries({ queryKey: [querykeys.marketTerms] });
      }
      showToast("error", apiErrorMessage(error));
    },
  });
}
