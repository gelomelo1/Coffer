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
    LANGUAGE: "settings/language" as any,
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
    screenTitleKey: "navigation:tabs.collections",
  }),
  settings: buildNavigationData({
    isSettingsShown: false,
  }),
  developer: buildNavigationData({
    titleKey: "settings:developer.title",
    isSettingsShown: false,
  }),
  home: buildNavigationData({
    screenTitleKey: "navigation:tabs.home",
  }),
  market: buildNavigationData({
    screenTitleKey: "navigation:tabs.market",
  }),
  mycollection: buildNavigationData({
    screenTitleKey: "navigation:screens.myCollection",
  }),
  itemdetails: buildNavigationData({
    screenTitleKey: "navigation:screens.itemDetails",
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
      screenTitleKey: "navigation:screens.itemDetails",
    }),
  user: buildNavigationData({
    titleKey: "settings:user.title",
    isSettingsShown: false,
  }),
  listingDetails: (title: string) =>
    buildNavigationData({
      titleKey: "navigation:tabs.market",
      screenTitle: title,
    }),
  chat: (otherUserName: string, listingTitle: string) =>
    buildNavigationData({
      title: otherUserName,
      screenTitle: listingTitle,
    }),
  language: buildNavigationData({
    titleKey: "settings:language.title",
    isSettingsShown: false,
  }),
  reports: buildNavigationData({
    titleKey: "settings:reports.title",
    isSettingsShown: false,
  }),
  myfollows: buildNavigationData({
    screenTitleKey: "navigation:tabs.myFollows",
  }),
};
