import { useQuery } from "@tanstack/react-query";
import { navigate } from "expo-router/build/global-state/routing";
import { create } from "zustand";
import { querykeys } from "../const/querykeys";
import { pageParams, ROUTES } from "../const/navigation_params";
import { ActivityCategory, ActivityEntry } from "../types/entities/activity";
import { activityApi } from "../utils/activity_api";
import { usePagedQuery } from "./paged_query";

const byId = (e: ActivityEntry) => e.id;

/** Count and latest time per category, for the My activity menu. */
export const useActivitySummary = () => useQuery({ queryKey: [querykeys.activitySummary], queryFn: activityApi.summary });

/** The log, newest first, 20 at a time; null = every category. */
export const useActivity = (category: ActivityCategory | null) =>
  usePagedQuery<ActivityEntry>([querykeys.activity, category ?? "all"], (page) => activityApi.list(category, page), byId);

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
