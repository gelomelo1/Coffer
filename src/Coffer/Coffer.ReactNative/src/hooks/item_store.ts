import { create } from "zustand";
import { ItemProvided } from "../types/entities/item";
import { ItemStore } from "../types/helpers/data_store";

export function initItemStore(item: ItemProvided) {
  useItemStore = createItemStore(item);
}

export const createItemStore = (item: ItemProvided) =>
  create<ItemStore>((set) => ({
    item: item,
    setItem: (newItem: ItemProvided) => set({ item: newItem }),
  }));

export let useItemStore: ReturnType<typeof createItemStore>;
