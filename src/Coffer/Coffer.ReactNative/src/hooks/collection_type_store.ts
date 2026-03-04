import { create } from "zustand";
import { CollectionTypeStore } from "../types/helpers/data_store";

export const useCollectionTypeStore = create<CollectionTypeStore>((set) => ({
  collectionTypes: [],
  setCollectionTypes: (collectionTypes) => set({ collectionTypes }),
}));
