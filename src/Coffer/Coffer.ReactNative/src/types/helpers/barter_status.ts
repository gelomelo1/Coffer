export type OfferStatus =
  | "pending"
  | "rejected"
  | "accepted"
  | "revertByCreator"
  | "revertByOfferer"
  | "traded";

export type TradeStatus = "open" | "locked" | "traded";
