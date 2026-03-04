import { create } from "zustand";
import { CollectionStore } from "../types/helpers/data_store";

export const useCollectionStore = create<CollectionStore>((set) => ({
  collectionType: null,
  collection: null,
  setCollectionType: (collectionType) => set({ collectionType }),
  setCollection: (collection) => set({ collection }),
}));
