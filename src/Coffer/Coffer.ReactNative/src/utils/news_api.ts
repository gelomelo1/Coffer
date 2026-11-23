import { backendAxios } from "../const/backendAccessConfiguration";
import { endpoints } from "../const/endpoints";
import { NewsCard, NewsPost } from "../types/entities/news";
import { newsImageUrl } from "./news_format";
import { PAGE_SIZE, Paged } from "./paging";

export const newsApi = {
  list: async (page: number) => (await backendAxios.get<Paged<NewsCard>>(`${endpoints.news}?page=${page}&pageSize=${PAGE_SIZE}`)).data,
  post: async (id: string) => (await backendAxios.get<NewsPost>(`${endpoints.news}/${id}`)).data,
};

/** Full URL of a news image (banner or content), served without sign-in. */
export const newsImage = (name: string) => newsImageUrl(backendAxios.defaults.baseURL ?? "", name);
