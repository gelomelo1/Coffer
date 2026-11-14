import { buildNavigationData } from "../utils/navigation_utils";

export const ROUTES = {
  ROOT: "/" as any,
  LOGIN: "login" as any,
  TABS: {
    HOME: "tabs" as any,
    MARKET: "tabs/market" as any,
    COLLECTIONS: "tabs/collections" as any,
    MYFOLLOWS: "tabs/myfollows" as any,
  },
  SETTINGS: {
    ROOT: "settings" as any,
    DEVELOPER: "settings/developer" as any,
    USER: "settings/user" as any,
    REPORTS: "settings/reports" as any,
  },
  MYCOLLECTION: "mycollection" as any,
  ITEMDETAILS: "itemdetails" as any,
  OTHERUSER: "otheruser" as any,
  OTHERUSERCOLLECTION: "otherusercollection" as any,
  OTHERUSERITEMDETAILS: "otheruseritemdetails" as any,
  LISTINGDETAILS: "listingdetails" as any,
  CHAT: "chat" as any,
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
  market: buildNavigationData({
    screenTitle: "Market",
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
  listingDetails: (title: string) =>
    buildNavigationData({
      title: "Market",
      screenTitle: title,
    }),
  chat: (otherUserName: string, listingTitle: string) =>
    buildNavigationData({
      title: otherUserName,
      screenTitle: listingTitle,
    }),
  reports: buildNavigationData({
    title: `Reports`,
    isSettingsShown: false,
  }),
  myfollows: buildNavigationData({
    screenTitle: "My Follows",
  }),
};
