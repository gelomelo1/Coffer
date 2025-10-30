import User from "./user";

export interface TradeReviewRequired {
  tradeId: string;
  reviewerId?: string;
  revieweeId?: string;
  rating: boolean;
  comment: string;
}

export interface Trade extends TradeReviewRequired {
  id: string;
  reviewerUser?: User;
  revieweeUser: User;
  createdAt: string;
}
