import { create } from "zustand";
import Item from "../types/entities/item";
import { ItemStore } from "../types/helpers/data_store";

export function initItemStore(item: Item) {
  useItemStore = createItemStore(item);
}

export const createItemStore = (item: Item) =>
  create<ItemStore>(() => ({
    item: item,
  }));

export let useItemStore: ReturnType<typeof createItemStore>;
