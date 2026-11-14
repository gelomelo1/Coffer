import { customTheme } from "../theme/theme";
import {
  DealStatus,
  DeliveryMethod,
  ListingCondition,
  ListingKind,
  ListingSort,
  ListingStatus,
  ReviewReasonTag,
} from "../types/entities/market";

/** Shown on the feed, on every listing and before any deal starts. */
export const MARKET_WARNING_TITLE = "Trade safely";
export const MARKET_WARNING_TEXT =
  "Coffer does not handle payments. Advance payment and shipping are at your own risk — only pay in advance or ship to people you trust. Prefer personal pickup and pay on the spot.";

export const MIN_LOW_RATING_COMMENT = 20;
export const MAX_REVIEW_COMMENT = 1000;
export const MAX_REPLY = 500;
export const MAX_LISTING_IMAGES = 6;
export const MAX_LISTING_LINES = 30;

export const listingKindLabels: Record<ListingKind, string> = {
  sell: "Sell",
  exchange: "Exchange",
  wanted: "Searching for",
};

export const listingKindColors: Record<ListingKind, string> = {
  sell: customTheme.colors.secondary,
  exchange: customTheme.colors.primary,
  wanted: customTheme.colors.accent,
};

export const conditionLabels: Record<ListingCondition, string> = {
  new: "New",
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

export const listingStatusLabels: Record<ListingStatus, string> = {
  active: "Active",
  pending_pickup: "Reserved · pickup",
  pending_shipment: "Reserved · shipping",
  sold: "Sold",
  archived: "Archived",
  removed: "Removed by moderation",
};

export const deliveryLabels: Record<DeliveryMethod, string> = {
  local_pickup: "Personal pickup",
  shipping: "Shipping",
};

export const sortLabels: Record<ListingSort, string> = {
  nearest: "Nearest",
  price_asc: "Price ↑",
  price_desc: "Price ↓",
  newest: "Newest",
};

export const radiusOptions = [5, 10, 25, 50, 100];

export const dealStatusLabels: Record<DealStatus, string> = {
  proposed: "Waiting for buyer to accept",
  awaiting_handoff: "Meet up & verify with PIN",
  awaiting_shipment: "Waiting for shipment",
  shipped: "On its way",
  completed: "Completed",
  disputed: "Disputed — not resolved by Coffer",
  cancelled: "Cancelled",
};

export const dealStatusColors: Record<DealStatus, string> = {
  proposed: customTheme.colors.secondary,
  awaiting_handoff: customTheme.colors.secondary,
  awaiting_shipment: customTheme.colors.secondary,
  shipped: customTheme.colors.secondary,
  completed: "green",
  disputed: "red",
  cancelled: customTheme.colors.accent,
};

export const reasonTagLabels: Record<ReviewReasonTag, string> = {
  item_not_as_described: "Item not as described",
  late_to_meetup: "Late to meetup",
  no_show: "Didn't show up",
  poor_communication: "Poor communication",
  damaged_in_shipping: "Damaged in shipping",
  slow_shipping: "Slow shipping",
  payment_problem: "Payment problem",
  rude_behavior: "Rude behavior",
  other: "Other",
};

export const starLabels = ["", "Terrible", "Bad", "OK", "Good", "Excellent"];

export const PRIVATE_SELLER_NOTE =
  "Private seller — consumer rights that apply to shops and businesses (e.g. 14-day return) don't apply.";

/** Must match MarketTerms.CurrentVersion on the backend. Bump both when the text changes. */
export const MARKET_TERMS_VERSION = "2026-11-14";

export const MARKET_TERMS: { title: string; text: string }[] = [
  {
    title: "Coffer is only the venue",
    text: "Coffer helps you find each other, chat and confirm the handover. Coffer is not a party to any deal, does not handle payments and gives no guarantee about items, payments or deliveries.",
  },
  {
    title: "Deals are your own responsibility",
    text: "Price, payment and shipping are agreed between buyer and seller. Advance payment and shipping are at your own risk — only do it with people you trust. Prefer personal pickup and paying on the spot.",
  },
  {
    title: "Coffer does not settle disputes",
    text: "If something goes wrong, sort it out with the other person. A buyer can mark a shipped deal as disputed; the deal then closes and both of you can leave an honest review. Coffer never decides who is right.",
  },
  {
    title: "Private persons, 18+",
    text: "The marketplace is for private persons aged 18 or over selling their own collectibles. Businesses may not sell here.",
  },
  {
    title: "Content rules",
    text: "No illegal or banned items, counterfeits sold as originals, scams, harassment, other people's personal data, spam, or fake reviews. Anyone can report content; Coffer removes what breaks these rules and tells the author why.",
  },
  {
    title: "Verified reviews",
    text: "Only the buyer and seller of a deal completed with a PIN handover or a tracked shipment (or closed as disputed) can review each other. Reviews stay hidden until both have reviewed or 14 days pass.",
  },
];
