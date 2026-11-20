import { useQuery } from "@tanstack/react-query";
import { navigate } from "expo-router/build/global-state/routing";
import { create } from "zustand";
import { pageParams, ROUTES } from "../const/navigation_params";
import { ActivityCategory, ActivityEntry } from "../types/entities/activity";
import { activityApi } from "../utils/activity_api";
import { activityListKey, activitySummaryKey } from "../utils/activity_format";
import { useUserStore } from "./user_store";
import { usePagedQuery } from "./paged_query";

const byId = (e: ActivityEntry) => e.id;

/** Count and latest time per category, for the My activity menu. */
export function useActivitySummary() {
  const userId = useUserStore((s) => s.user?.id);
  return useQuery({ queryKey: activitySummaryKey(userId), queryFn: activityApi.summary, enabled: !!userId });
}

/** The log, newest first, 20 at a time; null = every category. */
export function useActivity(category: ActivityCategory | null) {
  const userId = useUserStore((s) => s.user?.id);
  return usePagedQuery<ActivityEntry>(activityListKey(userId, category), (page) => activityApi.list(category, page), byId, { enabled: !!userId });
}

interface ActivityListStore {
  category: ActivityCategory | null;
  setCategory: (category: ActivityCategory | null) => void;
}

/** Which category the list screen shows. */
export const useActivityListStore = create<ActivityListStore>((set) => ({
  category: null,
  setCategory: (category) => set({ category }),
}));

/** Opens the list screen on one category (null = all activity). */
export function openActivityList(category: ActivityCategory | null) {
  useActivityListStore.getState().setCategory(category);
  navigate({ pathname: ROUTES.SETTINGS.ACTIVITY_LIST, params: pageParams.activityList(category) });
}
