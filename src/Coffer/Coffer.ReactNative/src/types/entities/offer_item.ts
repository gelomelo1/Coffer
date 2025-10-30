import { ItemProvided } from "./item";

interface OfferItem {
  id: string;
  offerId: string;
  itemId?: string;
  item?: ItemProvided;
}

export default OfferItem;
