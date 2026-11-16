import i18n from "../i18n";
import { customTheme } from "../theme/theme";
import {
  DealStatus,
  DeliveryMethod,
  ListingCondition,
  ListingKind,
  ListingSort,
  ListingStatus,
  ReportRule,
  ReviewReasonTag,
} from "../types/entities/market";

/**
 * A label map whose values are translated when read (`labels[key]` → i18n.t(`${prefix}.${key}`)), so call sites
 * keep the simple record syntax and always render in the current language.
 */
function translatedLabels<K extends string>(prefix: string, keys: readonly K[]): Record<K, string> {
  const map = {} as Record<K, string>;
  for (const key of keys) {
    Object.defineProperty(map, key, { enumerable: true, get: () => i18n.t(String(`${prefix}.${key}`)) });
  }
  return map;
}

/** Shown on the feed, on every listing and before any deal starts. */
export const marketWarning = {
  get title() {
    return i18n.t("market:warning.title");
  },
  get text() {
    return i18n.t("market:warning.text");
  },
};

export const MIN_LOW_RATING_COMMENT = 20;
export const MAX_REVIEW_COMMENT = 1000;
export const MAX_REPLY = 500;
export const MAX_LISTING_IMAGES = 6;
export const MAX_LISTING_LINES = 30;

export const listingKindLabels = translatedLabels<ListingKind>("market:kind", ["sell", "exchange", "wanted"]);

export const listingKindColors: Record<ListingKind, string> = {
  sell: customTheme.colors.secondary,
  exchange: customTheme.colors.primary,
  wanted: customTheme.colors.accent,
};

export const conditionLabels = translatedLabels<ListingCondition>("market:condition", ["new", "like_new", "good", "fair", "poor"]);

export const listingStatusLabels = translatedLabels<ListingStatus>("market:listingStatus", [
  "active",
  "pending_pickup",
  "pending_shipment",
  "sold",
  "archived",
  "removed",
]);

export const deliveryLabels = translatedLabels<DeliveryMethod>("market:delivery", ["local_pickup", "shipping"]);

export const sortLabels = translatedLabels<ListingSort>("market:sort", ["nearest", "price_asc", "price_desc", "newest"]);

export const radiusOptions = [5, 10, 25, 50, 100];

export const dealStatusLabels = translatedLabels<DealStatus>("market:dealStatus", [
  "proposed",
  "awaiting_handoff",
  "awaiting_shipment",
  "shipped",
  "completed",
  "disputed",
  "cancelled",
]);

export const dealStatusColors: Record<DealStatus, string> = {
  proposed: customTheme.colors.secondary,
  awaiting_handoff: customTheme.colors.secondary,
  awaiting_shipment: customTheme.colors.secondary,
  shipped: customTheme.colors.secondary,
  completed: "#2e7d32",
  disputed: "#b3261e",
  cancelled: customTheme.colors.accent,
};

export const reasonTagLabels = translatedLabels<ReviewReasonTag>("market:reasonTag", [
  "item_not_as_described",
  "late_to_meetup",
  "no_show",
  "poor_communication",
  "damaged_in_shipping",
  "slow_shipping",
  "payment_problem",
  "rude_behavior",
  "other",
]);

/** Star rating word for 1–5 ("" for 0). */
export function starLabel(stars: number): string {
  return stars >= 1 && stars <= 5 ? i18n.t(`market:stars.${stars}`) : "";
}

/**
 * Report rules come from a fixed backend list (ReportRules.List); the frontend translates them by key and falls
 * back to the backend's English text for a rule it does not know yet.
 */
export function reportRuleText(rule: ReportRule, field: "label" | "description", fallback: string): string {
  return i18n.t(`market:reportRule.${rule}.${field}`, { defaultValue: fallback });
}

export function privateSellerNote() {
  return i18n.t("market:privateSellerNote");
}

/** Must match MarketTerms.CurrentVersion on the backend. Bump both when the text changes. */
export const MARKET_TERMS_VERSION = "2026-11-14";

const TERM_SECTIONS = ["venue", "responsibility", "disputes", "adults", "contentRules", "reviews"] as const;

/** The marketplace terms, translated. */
export function marketTerms(): { title: string; text: string }[] {
  return TERM_SECTIONS.map((section) => ({
    title: i18n.t(`market:terms.sections.${section}.title`),
    text: i18n.t(`market:terms.sections.${section}.text`),
  }));
}
