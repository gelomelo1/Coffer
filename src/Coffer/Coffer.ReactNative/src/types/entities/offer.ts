import { OfferStatus } from "../helpers/barter_status";
import OfferItem from "./offer_item";
import User from "./user";

export interface OfferRequired {
  tradeId: string;
  userId: string;
  moneyOffer?: string;
  status: OfferStatus;
  offerItems: OfferItem[];
}

export interface Offer extends OfferRequired {
  id: string;
  user: User;
  createdAt: string;
  updatedAt: string;
}
