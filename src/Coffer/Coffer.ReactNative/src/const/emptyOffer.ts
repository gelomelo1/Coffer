import { OfferRequired } from "../types/entities/offer";

export const emptyOfferRequired = (
  userId: string,
  tradeId: string
): OfferRequired => {
  return {
    tradeId: tradeId,
    userId: userId,
    status: "pending",
    offerItems: [],
  };
};
