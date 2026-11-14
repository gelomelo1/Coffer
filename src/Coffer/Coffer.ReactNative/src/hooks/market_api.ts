import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import showToast from "../components/custom_ui/toast";
import { querykeys } from "../const/querykeys";
import { ListingFilters } from "../types/entities/market";
import { apiErrorCode, apiErrorMessage, marketApi } from "../utils/market_api";
import { useMarketStore } from "./market_store";

const PAGE_SIZE = 20;

export function useListings(filters: ListingFilters) {
  return useInfiniteQuery({
    queryKey: [querykeys.marketListings, filters],
    queryFn: ({ pageParam }) => marketApi.searchListings(filters, pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.length === PAGE_SIZE ? all.length + 1 : undefined),
    refetchOnWindowFocus: false,
  });
}

export const useMyListings = () =>
  useQuery({ queryKey: [querykeys.marketMyListings], queryFn: marketApi.myListings });

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

/** Inbox refreshes every 20 s while mounted. */
export const useInbox = () =>
  useQuery({ queryKey: [querykeys.marketInbox], queryFn: marketApi.inbox, refetchInterval: 20000 });

export const useConversation = (id?: string | null) =>
  useQuery({
    queryKey: [querykeys.marketConversation, id],
    queryFn: () => marketApi.conversation(id!),
    enabled: !!id,
    refetchInterval: 8000,
  });

/** Open chat polls every 4 s. */
export const useMessages = (id?: string | null) =>
  useQuery({
    queryKey: [querykeys.marketMessages, id],
    queryFn: () => marketApi.messages(id!),
    enabled: !!id,
    refetchInterval: 4000,
  });

export const useMyDeals = () =>
  useQuery({ queryKey: [querykeys.marketDeals], queryFn: marketApi.myDeals, refetchInterval: 20000 });

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
  useQuery({
    queryKey: [querykeys.marketUserReviews, userId],
    queryFn: () => marketApi.userReviews(userId!),
    enabled: !!userId && enabled,
  });

export const useReportRules = () =>
  useQuery({ queryKey: [querykeys.reportRules], queryFn: marketApi.reportRules, staleTime: Infinity });

export const useMyReports = () => useQuery({ queryKey: [querykeys.myReports], queryFn: marketApi.myReports });

export const useAgainstMe = () => useQuery({ queryKey: [querykeys.againstMe], queryFn: marketApi.againstMe });

/** Unseen moderation notices about my content (badge in Settings). */
export const useAgainstMeUnseen = () =>
  useQuery({ queryKey: [querykeys.againstMeUnseen], queryFn: marketApi.againstMeUnseen, refetchInterval: 60000 });

export const useTerms = () => useQuery({ queryKey: [querykeys.marketTerms], queryFn: marketApi.terms });

/** Marketplace mutations refresh every marketplace query and show the backend's own error text. */
const MARKET_KEYS = [
  querykeys.marketListings,
  querykeys.marketMyListings,
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
