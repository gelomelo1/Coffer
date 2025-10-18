import { create } from "zustand";
import { OtherUserStore } from "../types/helpers/data_store";

export const useOtherUserStore = create<OtherUserStore>((set) => ({
  user: null,
  collection: null,
  item: null,

  setValues: (user = null, collection = null, item = null) =>
    set({ user, collection, item }),

  setUser: (user) => set({ user }),
  setCollection: (collection) => set({ collection }),
  setItem: (item) => set({ item }),
}));
