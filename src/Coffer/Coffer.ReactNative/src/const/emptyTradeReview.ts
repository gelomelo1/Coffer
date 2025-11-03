import { TradeReviewRequired } from "../types/entities/trade_review";

export const emptyTradeReviewRequired = (
  tradeId: string,
  reviewerId: string,
  revieweeId: string
): TradeReviewRequired => {
  return {
    tradeId: tradeId,
    reviewerId: reviewerId,
    revieweeId: revieweeId,
    rating: true,
    comment: "",
  };
};
