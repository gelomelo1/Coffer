import "i18next";

// Key existence is enforced by scripts/check-i18n.mjs (npm run check:i18n), which understands the
// "namespace:key.path" convention used across the app; resources are intentionally not typed here.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    returnNull: false;
  }
}
