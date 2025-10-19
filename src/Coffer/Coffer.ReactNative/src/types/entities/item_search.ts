import { Collection } from "./collection";
import { ItemProvided } from "./item";
import User from "./user";

interface ItemSearch {
  user: User;
  collection: Collection;
  item: ItemProvided;
}

export default ItemSearch;
