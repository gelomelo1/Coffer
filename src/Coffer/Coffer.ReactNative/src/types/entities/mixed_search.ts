import CollectionSearch from "./collection_search";
import ItemSearch from "./item_search";
import User from "./user";

interface MixedSearch {
  foundUsers: User[];
  foundCollections: CollectionSearch[];
  foundItems: ItemSearch[];
  /** All matches of each kind (the lists hold the first page). */
  foundUsersTotal: number;
  foundCollectionsTotal: number;
  foundItemsTotal: number;
}

export default MixedSearch;
