import accessibility from "./locales/en/accessibility.json";
import activity from "./locales/en/activity.json";
import auth from "./locales/en/auth.json";
import collections from "./locales/en/collections.json";
import comments from "./locales/en/comments.json";
import common from "./locales/en/common.json";
import errors from "./locales/en/errors.json";
import feed from "./locales/en/feed.json";
import items from "./locales/en/items.json";
import market from "./locales/en/market.json";
import navigation from "./locales/en/navigation.json";
import notifications from "./locales/en/notifications.json";
import settings from "./locales/en/settings.json";
import validation from "./locales/en/validation.json";
import hu_accessibility from "./locales/hu/accessibility.json";
import hu_activity from "./locales/hu/activity.json";
import hu_auth from "./locales/hu/auth.json";
import hu_collections from "./locales/hu/collections.json";
import hu_comments from "./locales/hu/comments.json";
import hu_common from "./locales/hu/common.json";
import hu_errors from "./locales/hu/errors.json";
import hu_feed from "./locales/hu/feed.json";
import hu_items from "./locales/hu/items.json";
import hu_market from "./locales/hu/market.json";
import hu_navigation from "./locales/hu/navigation.json";
import hu_notifications from "./locales/hu/notifications.json";
import hu_settings from "./locales/hu/settings.json";
import hu_validation from "./locales/hu/validation.json";

/** English is the default and fallback language. A new language = a new folder + one entry here. */
export const en = {
  accessibility,
  activity,
  auth,
  collections,
  comments,
  common,
  errors,
  feed,
  items,
  market,
  navigation,
  notifications,
  settings,
  validation,
};

/** Hungarian (same keys as English; tests/locale_parity.test.ts keeps them in sync). */
export const hu = {
  accessibility: hu_accessibility,
  activity: hu_activity,
  auth: hu_auth,
  collections: hu_collections,
  comments: hu_comments,
  common: hu_common,
  errors: hu_errors,
  feed: hu_feed,
  items: hu_items,
  market: hu_market,
  navigation: hu_navigation,
  notifications: hu_notifications,
  settings: hu_settings,
  validation: hu_validation,
};

export const resources = { en, hu } as const;

export type AppLanguage = keyof typeof resources;

export const namespaces = Object.keys(en) as (keyof typeof en)[];
