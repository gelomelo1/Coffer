import { NavigationData } from "../types/helpers/navigation";
import { buildNavigationData } from "../utils/navigation_utils";

export const ROUTES = {
  HOME: "/" as any,
  LOGIN: "/login" as any,
  COLLECTIONS: {
    ROOT: "/collections" as any,
    HOME: "/collections/tabs" as any,
    BARTER: "/collections/tabs/barter" as any,
    MYCOLLECTION: "/collections/tabs/mycollection" as any,
  },
  SETTINGS: {
    ROOT: "/settings" as any,
    DEVELOPER: "/settings/developer" as any,
  },
} as const;

export const pageParams = {
  collections: (username: string): NavigationData =>
    buildNavigationData({
      title: `Hello ${username}!`,
      description: {
        icon: undefined,
        title: "Collections",
        additionalHeadings: [],
      },
      isSettingsShown: true,
    }),
  settings: buildNavigationData({
    title: `Settings`,
    description: undefined,
    isSettingsShown: false,
  }),
  developer: buildNavigationData({
    title: `Developer options`,
    description: undefined,
    isSettingsShown: false,
  }),
  home: (
    username: string,
    icon: string,
    title: string,
    color: string
  ): NavigationData =>
    buildNavigationData({
      title: `Hello ${username}!`,
      description: {
        icon: icon,
        title: title,
        color: color,
        additionalHeadings: ["Home"],
      },
      isSettingsShown: true,
    }),
  barter: (
    username: string,
    icon: string,
    title: string,
    color: string
  ): NavigationData =>
    buildNavigationData({
      title: `Hello ${username}!`,
      description: {
        icon: icon,
        title: title,
        color: color,
        additionalHeadings: ["Barter"],
      },
      isSettingsShown: true,
    }),
  mycollection: (
    username: string,
    icon: string,
    title: string,
    color: string
  ): NavigationData =>
    buildNavigationData({
      title: `Hello ${username}!`,
      description: {
        icon: icon,
        title: title,
        color: color,
        additionalHeadings: ["My Collection"],
      },
      isSettingsShown: true,
    }),
};
