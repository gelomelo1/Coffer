import { buildNavigationData } from "../utils/navigation_utils";

export const ROUTES = {
  ROOT: "/" as any,
  LOGIN: "login" as any,
  COLLECTIONS: {
    ROOT: "collections" as any,
    HOME: "collections/tabs" as any,
    BARTER: "collections/tabs/barter" as any,
    MYCOLLECTION: "collections/tabs/mycollection" as any,
  },
  SETTINGS: {
    ROOT: "settings" as any,
    DEVELOPER: "settings/developer" as any,
  },
  ITEMDETAILS: "itemdetails" as any,
} as const;

export const pageParams = {
  collections: buildNavigationData({
    screenTitle: "Collections",
  }),
  settings: buildNavigationData({
    isSettingsShown: false,
  }),
  developer: buildNavigationData({
    title: `Developer options`,
    isSettingsShown: false,
  }),
  home: buildNavigationData({
    screenTitle: "Home",
  }),
  barter: buildNavigationData({
    screenTitle: "Barter",
  }),
  mycollection: buildNavigationData({
    screenTitle: "My Collection",
  }),
  itemdetails: buildNavigationData({
    screenTitle: `Item Details`,
  }),
};
