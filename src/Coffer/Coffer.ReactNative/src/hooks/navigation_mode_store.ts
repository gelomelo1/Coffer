import { NavigationModeInfo } from "react-native-navigation-mode";
import { create } from "zustand";
import { NavigationModeStore } from "../types/helpers/data_store";

export function initNavigationModeStore(navigationMode: NavigationModeInfo) {
  useNavigationModeStore = createNavigationModeStore(navigationMode);
}

export const createNavigationModeStore = (
  initialNavigationMode: NavigationModeInfo
) =>
  create<NavigationModeStore>(() => ({
    navigationMode: initialNavigationMode,
  }));

export let useNavigationModeStore: ReturnType<typeof createNavigationModeStore>;
