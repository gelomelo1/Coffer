import { Item } from "../types/entities/item";

export const tempItemId = "53b5298f-8afa-4751-af05-1a4f408f1dbb";

export const emptyItem = (collectionId: string, quantity: number): Item => {
  return {
    id: tempItemId,
    collectionId: collectionId,
    description: "",
    quantity: quantity,
    image: "",
    acquiredAt: "",
    itemAttributes: [],
    itemTags: [],
  };
};
