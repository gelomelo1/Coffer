import { create } from "zustand";
import { ConnectionProblem } from "../utils/connectivity";

interface ConnectionStore {
  /** Set when a backend request failed for lack of connection; the ConnectionScreen covers the app while it is set. */
  problem: ConnectionProblem | null;
  setProblem: (problem: ConnectionProblem | null) => void;
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  problem: null,
  setProblem: (problem) => set({ problem }),
}));
