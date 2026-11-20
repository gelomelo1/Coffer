import { ImagePickerAsset } from "expo-image-picker";
import { backendAxios } from "../const/backendAccessConfiguration";
import { endpoints } from "../const/endpoints";
import { ItemProvided } from "../types/entities/item";
import { AddPendingInput, ImageCheckResult, PendingItem, PendingSummary } from "../types/entities/pending";
import { PAGE_SIZE, Paged } from "./paging";

/** Waiting-for-review list API (owner only). */
export const pendingApi = {
  /** Runs the AI check on one photo; every cap found joins the collection's waiting list. */
  checkImage: async (collectionId: string, asset: ImagePickerAsset) => {
    const form = new FormData();
    form.append("file", { uri: asset.uri, name: asset.fileName ?? "upload.jpg", type: asset.mimeType ?? "image/jpeg" } as any);
    return (
      await backendAxios.post<ImageCheckResult>(`${endpoints.itemsImageCheck}/${collectionId}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        // The AI check of a big photo can take a while.
        timeout: 120000,
      })
    ).data;
  },
  list: async (collectionId: string, page: number) =>
    (await backendAxios.get<Paged<PendingItem>>(`api/Collections/${collectionId}/Pending?page=${page}&pageSize=${PAGE_SIZE}`)).data,
  summary: async () => (await backendAxios.get<PendingSummary[]>(`${endpoints.pending}/Summary`)).data,
  add: async (id: string, input: AddPendingInput) => (await backendAxios.post<ItemProvided>(`${endpoints.pending}/${id}/Add`, input)).data,
  remove: async (id: string) => {
    await backendAxios.delete(`${endpoints.pending}/${id}`);
  },
};

/** The waiting cap's crop (needs the auth header). */
export const pendingImageUrl = (id: string) => `${backendAxios.defaults.baseURL}/${endpoints.pending}/Image/${id}`;
