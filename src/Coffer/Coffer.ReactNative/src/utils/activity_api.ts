import { backendAxios } from "../const/backendAccessConfiguration";
import { endpoints } from "../const/endpoints";
import { ActivityCategory, ActivityCategorySummary, ActivityEntry } from "../types/entities/activity";
import { PAGE_SIZE, Paged } from "./paging";

/** My activity: the signed-in user's own log (there is no way to read anyone else's). */
export const activityApi = {
  list: async (category: ActivityCategory | null, page: number) =>
    (
      await backendAxios.get<Paged<ActivityEntry>>(endpoints.activity, {
        params: { ...(category ? { category } : {}), page, pageSize: PAGE_SIZE },
      })
    ).data,
  summary: async () => (await backendAxios.get<ActivityCategorySummary[]>(`${endpoints.activity}/Summary`)).data,
};
