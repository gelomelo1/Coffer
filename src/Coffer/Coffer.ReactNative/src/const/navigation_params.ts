import { NavigationData } from "../types/helpers/navigation";
import { buildNavigationData } from "../utils/navigation_utils";

export const ROUTES = {
  HOME: "/" as any,
  LOGIN: "/login" as any,
  COLLECTIONS: "/collections" as any,
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
};
