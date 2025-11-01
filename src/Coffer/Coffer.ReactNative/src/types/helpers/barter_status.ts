export type OfferStatus =
  | "pending"
  | "rejected"
  | "accepted"
  | "revertByCreator"
  | "revertByOfferer"
  | "traded";

export type TradeStatus =
  | "offerRevertByOfferer"
  | "offerRevertByCreator"
  | "offerAccepted"
  | "open"
  | "traded";
