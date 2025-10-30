import { ItemProvided } from "./item";

interface TradeItem {
  id: string;
  tradeId: string;
  itemId?: string;
  item?: ItemProvided;
}

export default TradeItem;
