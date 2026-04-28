import { buildNavigationData } from "../utils/navigation_utils";

export const ROUTES = {
  ROOT: "/" as any,
  LOGIN: "login" as any,
  TABS: {
    HOME: "tabs" as any,
    BARTER: "tabs/barter" as any,
    COLLECTIONS: "tabs/collections" as any,
    MYFOLLOWS: "tabs/myfollows" as any,
  },
  SETTINGS: {
    ROOT: "settings" as any,
    DEVELOPER: "settings/developer" as any,
    USER: "settings/user" as any,
  },
  MYCOLLECTION: "mycollection" as any,
  ITEMDETAILS: "itemdetails" as any,
  OTHERUSER: "otheruser" as any,
  OTHERUSERCOLLECTION: "otherusercollection" as any,
  OTHERUSERITEMDETAILS: "otheruseritemdetails" as any,
  TRADEDETAILS: "tradedetails" as any,
  OFFERDETAILS: "offerdetails" as any,
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
  otheruser: (username: string) =>
    buildNavigationData({
      screenTitle: username,
    }),
  otherusercollection: (username: string, collectionName: string) =>
    buildNavigationData({
      title: username,
      screenTitle: collectionName,
    }),
  otheruseritemdetails: (collectionName: string) =>
    buildNavigationData({
      title: collectionName,
      screenTitle: "Item Details",
    }),
  user: buildNavigationData({
    title: `User settings`,
    isSettingsShown: false,
  }),
  tradeDetails: (username: string) =>
    buildNavigationData({
      title: username,
    }),
  offerDetails: (username: string) =>
    buildNavigationData({
      title: username,
    }),
  myfollows: buildNavigationData({
    screenTitle: "My Follows",
  }),
};
