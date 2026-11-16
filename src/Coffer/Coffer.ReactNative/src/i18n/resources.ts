import accessibility from "./locales/en/accessibility.json";
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

/** English is the default and fallback language. A new language = a new folder + one entry here. */
export const en = {
  accessibility,
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

export const resources = { en } as const;

export type AppLanguage = keyof typeof resources;

export const namespaces = Object.keys(en) as (keyof typeof en)[];
