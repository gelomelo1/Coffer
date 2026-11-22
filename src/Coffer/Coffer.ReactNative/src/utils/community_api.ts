import { backendAxios } from "../const/backendAccessConfiguration";
import { endpoints } from "../const/endpoints";
import { CommunityStats } from "../types/entities/community";

export const communityApi = {
  stats: async () => (await backendAxios.get<CommunityStats>(endpoints.communityStats)).data,
};
