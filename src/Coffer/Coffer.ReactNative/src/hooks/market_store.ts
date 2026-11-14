import { create } from "zustand";
import { ListingFilters } from "../types/entities/market";

interface MarketStore {
  /** Listing shown on the listing details screen. */
  listingId: string | null;
  /** Conversation shown on the chat screen. */
  conversationId: string | null;
  filters: ListingFilters;
  /** Set when the backend answered terms_required. */
  termsNeeded: boolean;
  setTermsNeeded: (needed: boolean) => void;
  setListingId: (id: string | null) => void;
  setConversationId: (id: string | null) => void;
  setFilters: (filters: ListingFilters) => void;
}

export const defaultListingFilters: ListingFilters = { sort: "newest" };

export const useMarketStore = create<MarketStore>((set) => ({
  listingId: null,
  conversationId: null,
  filters: defaultListingFilters,
  termsNeeded: false,
  setTermsNeeded: (termsNeeded) => set({ termsNeeded }),
  setListingId: (listingId) => set({ listingId }),
  setConversationId: (conversationId) => set({ conversationId }),
  setFilters: (filters) => set({ filters }),
}));
