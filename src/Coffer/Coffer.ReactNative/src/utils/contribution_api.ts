import { ImagePickerAsset } from "expo-image-picker";
import { backendAxios } from "../const/backendAccessConfiguration";
import { endpoints } from "../const/endpoints";
import { ContributionExamples, ContributionForm, ContributionState, Mine, MyVote, VoteInput } from "../types/entities/contribution";
import { resizeForUpload } from "./resize_photo";

/** Photos are resized on the phone (800 px wide, like item photos) for a fast upload; the server caps anything bigger. */
async function photosForm(phaseId: string, assets: ImagePickerAsset[]) {
  const form = new FormData();
  form.append("phaseId", phaseId);
  for (const asset of assets) {
    const resized = await resizeForUpload(asset);
    form.append("images", { uri: resized.uri, name: resized.fileName ?? "photo.jpg", type: resized.mimeType ?? "image/jpeg" } as any);
  }
  return form;
}

const multipart = { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 };

/** Shape What's Next. */
export const contributionApi = {
  state: async () => (await backendAxios.get<ContributionState>(endpoints.contribution)).data,
  vote: async (input: VoteInput) => (await backendAxios.put<MyVote>(`${endpoints.contribution}/Vote`, input)).data,
  uploadDetection: async (phaseId: string, assets: ImagePickerAsset[]) =>
    (await backendAxios.post<Mine>(`${endpoints.contribution}/Detection`, await photosForm(phaseId, assets), multipart)).data,
  uploadClassification: async (phaseId: string, assets: ImagePickerAsset[]) =>
    (await backendAxios.post<Mine>(`${endpoints.contribution}/Classification`, await photosForm(phaseId, assets), multipart)).data,
  examples: async () => (await backendAxios.get<ContributionExamples>(`${endpoints.contribution}/Examples`)).data,
};

/** An example image of a form's gallery (needs the auth header). */
export const contributionExampleUrl = (form: ContributionForm, fileName: string) =>
  `${backendAxios.defaults.baseURL}/${endpoints.contribution}/Examples/${form}/${encodeURIComponent(fileName)}`;
