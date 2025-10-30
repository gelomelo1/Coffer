import { Offer } from "./offer";
import TradeItem from "./trade_item";
import User from "./user";

export interface TradeRequired {
  userId: string;
  title: string;
  description: string;
  wantDescription?: string;
  moneyRequested?: string;
  tradeItems: TradeItem[];
}

export interface Trade extends TradeRequired {
  id: string;
  user: User;
  offers: Offer[];
  createdAt: string;
  updatedAt: string;
}
