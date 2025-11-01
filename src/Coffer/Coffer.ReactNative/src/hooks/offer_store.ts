import { create } from "zustand";
import { OfferStore } from "../types/helpers/data_store";

export const useOfferStore = create<OfferStore>((set) => ({
  offer: null,
  setOffer: (offer) => set({ offer }),
}));
