import ItemAttribute from "./item_attribute";
import ItemTag from "./item_tag";

interface Item {
  id: string;
  collectionId: string;
  description: string;
  quantity: number;
  image: string;
  acquiredAt: string;
  itemAttributes: ItemAttribute[];
  itemTags: ItemTag[];
}

export default Item;
