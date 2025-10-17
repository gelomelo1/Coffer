import { Collection } from "./collection";
import { ItemProvided } from "./item";
import User from "./user";

interface Feed {
  item: ItemProvided;
  collection: Collection;
  user: User;
}

export default Feed;
