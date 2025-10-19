import CollectionSearch from "./collection_search";
import ItemSearch from "./item_search";
import User from "./user";

interface MixedSearch {
  foundUsers: User[];
  foundCollections: CollectionSearch[];
  foundItems: ItemSearch[];
}

export default MixedSearch;
