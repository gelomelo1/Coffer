import { OfferRequired } from "../types/entities/offer";

export const emptyOfferRequired = (userId: string): OfferRequired => {
  return {
    tradeId: "",
    userId: userId,
    status: "traded",
    offerItems: [],
  };
};
