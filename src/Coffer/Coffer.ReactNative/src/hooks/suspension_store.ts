import { create } from "zustand";
import { AccountSuspension } from "../types/entities/market";

interface SuspensionStore {
  /** Set when the backend answered "account_suspended"; the SuspendedScreen covers the app while it is set. */
  suspension: AccountSuspension | null;
  setSuspension: (suspension: AccountSuspension | null) => void;
}

export const useSuspensionStore = create<SuspensionStore>((set) => ({
  suspension: null,
  setSuspension: (suspension) => set({ suspension }),
}));
