import { TradeReview } from "../entities/trade_review";

interface ReviewSide {
  side: "trader" | "offerer";
  review: TradeReview;
}

export default ReviewSide;
