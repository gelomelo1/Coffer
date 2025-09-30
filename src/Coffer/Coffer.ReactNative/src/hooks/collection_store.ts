import { create } from "zustand";
import { Collection } from "../types/entities/collection";
import CollectionType from "../types/entities/collectiontype";
import { CollectionStore } from "../types/helpers/data_store";

export function initCollectionStore(
  collectionType: CollectionType,
  collection: Collection
) {
  useCollectionStore = createCollectionStore(collectionType, collection);
}

export const createCollectionStore = (
  collectionType: CollectionType,
  collection: Collection
) =>
  create<CollectionStore>((set) => ({
    collectionType: collectionType,
    collection: collection,
    setCollection: (newCollection: Collection) =>
      set({ collection: newCollection }),
  }));

export let useCollectionStore: ReturnType<typeof createCollectionStore>;
