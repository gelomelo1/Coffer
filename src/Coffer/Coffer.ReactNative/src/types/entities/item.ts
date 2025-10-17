import ItemAttribute from "./item_attribute";
import ItemTag from "./item_tag";
import { Reaction } from "./reaction";

export interface Item {
  id: string;
  collectionId: string;
  description: string;
  quantity: number;
  image: string;
  acquiredAt: string;
  itemAttributes: ItemAttribute[];
  itemTags: ItemTag[];
}

export interface ItemProvided extends Item {
  reactions: Reaction[];
}
