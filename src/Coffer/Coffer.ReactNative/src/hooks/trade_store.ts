import { create } from "zustand";
import { TradeStore } from "../types/helpers/data_store";

export const useTradeStore = create<TradeStore>((set) => ({
  trade: null,
  setTrade: (trade) => set({ trade }),
}));
