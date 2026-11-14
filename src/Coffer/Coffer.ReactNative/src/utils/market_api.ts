import { isAxiosError } from "axios";
import { backendAxios } from "../const/backendAccessConfiguration";
import { endpoints } from "../const/endpoints";
import {
  Carrier,
  City,
  Conversation,
  ConversationSummary,
  Deal,
  DealReviews,
  DeliveryMethod,
  ListingDetail,
  ListingFilters,
  ListingInput,
  ListingSummary,
  Message,
  CreateReportInput,
  ModerationActionItem,
  MyReport,
  ReportRuleInfo,
  TermsStatus,
  PostMessageInput,
  Reputation,
  Review,
  ReviewInput,
} from "../types/entities/market";

/** A photo picked on the device, ready to upload. */
export interface LocalImage {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

/** Machine-readable error code from the backend (e.g. "terms_required"). */
export function apiErrorCode(error: unknown): string | undefined {
  return isAxiosError(error) ? (error.response?.data as { code?: string } | undefined)?.code : undefined;
}

/** The backend answers business-rule errors as { message }; fall back to a generic text. */
export function apiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: string; title?: string } | undefined;
    if (data?.message) return data.message;
    if (error.response?.status === 403) return "You are not allowed to do this.";
    if (error.response?.status === 404) return "Not found.";
    if (!error.response) return "Can't reach the server.";
  }
  return fallback;
}

const multipart = { headers: { "Content-Type": "multipart/form-data" } };

function appendImage(form: FormData, field: string, image: LocalImage) {
  const name = image.fileName ?? `photo_${Date.now()}.jpg`;
  const type = image.mimeType ?? (name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
  form.append(field, { uri: image.uri, name, type } as any);
}

/** Built by hand: React Native's URLSearchParams is only partially implemented. */
export function listingQueryString(filters: ListingFilters, page: number, pageSize: number) {
  const params: [string, string | number | undefined | null][] = [
    ["kind", filters.kind],
    ["collectionTypeId", filters.collectionTypeId],
    ["cityId", filters.city?.id],
    ["radiusKm", filters.city ? filters.radiusKm : undefined],
    ["minPriceCents", filters.minPriceCents],
    ["maxPriceCents", filters.maxPriceCents],
    ["condition", filters.condition],
    ["delivery", filters.delivery],
    ["sort", filters.sort === "nearest" && !filters.city ? "newest" : filters.sort],
    ["page", page],
    ["pageSize", pageSize],
  ];
  return params
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join("&");
}

const get = async <T>(url: string) => (await backendAxios.get<T>(url)).data;
const post = async <T>(url: string, body?: unknown, config?: object) => (await backendAxios.post<T>(url, body, config)).data;

export const marketApi = {
  // cities
  searchCities: (q: string) => get<City[]>(`${endpoints.cities}?q=${encodeURIComponent(q)}`),

  // listings
  searchListings: (filters: ListingFilters, page: number, pageSize = 20) =>
    get<ListingSummary[]>(`${endpoints.listings}?${listingQueryString(filters, page, pageSize)}`),
  myListings: () => get<ListingSummary[]>(endpoints.listingsMine),
  getListing: (id: string) => get<ListingDetail>(`${endpoints.listings}/${id}`),
  createListing: (input: ListingInput, images: LocalImage[]) => {
    const form = new FormData();
    form.append("payload", JSON.stringify(input));
    images.forEach((image) => appendImage(form, "images", image));
    return post<ListingDetail>(endpoints.listings, form, multipart);
  },
  updateListing: async (id: string, input: ListingInput, newImages: LocalImage[]) => {
    const form = new FormData();
    form.append("payload", JSON.stringify(input));
    newImages.forEach((image) => appendImage(form, "images", image));
    return (await backendAxios.put<ListingDetail>(`${endpoints.listings}/${id}`, form, multipart)).data;
  },
  archiveListing: (id: string) => post<ListingDetail>(`${endpoints.listings}/${id}/Archive`),
  reactivateListing: (id: string) => post<ListingDetail>(`${endpoints.listings}/${id}/Reactivate`),

  // conversations
  openConversation: (listingId: string) => post<Conversation>(`${endpoints.listings}/${listingId}/Conversations`),
  inbox: () => get<ConversationSummary[]>(endpoints.conversations),
  conversation: (id: string) => get<Conversation>(`${endpoints.conversations}/${id}`),
  messages: (id: string) => get<Message[]>(`${endpoints.conversations}/${id}/Messages`),
  postMessage: (id: string, input: PostMessageInput) => post<Message>(`${endpoints.conversations}/${id}/Messages`, input),
  respond: (id: string, messageId: string, action: "accept" | "decline" | "withdraw") =>
    post<Message>(`${endpoints.conversations}/${id}/Messages/${messageId}/Respond`, { action }),
  markRead: (id: string) => post<void>(`${endpoints.conversations}/${id}/Read`),

  // deals
  carriers: () => get<Carrier[]>(endpoints.dealCarriers),
  myDeals: () => get<Deal[]>(endpoints.dealsMine),
  deal: (id: string) => get<Deal>(`${endpoints.deals}/${id}`),
  proposeDeal: (conversationId: string, method: DeliveryMethod) => post<Deal>(endpoints.deals, { conversationId, method }),
  acceptDeal: (id: string) => post<Deal>(`${endpoints.deals}/${id}/Accept`),
  declineDeal: (id: string) => post<Deal>(`${endpoints.deals}/${id}/Decline`),
  cancelDeal: (id: string, reason?: string) => post<Deal>(`${endpoints.deals}/${id}/Cancel`, { reason: reason ?? null }),
  confirmHandoff: (id: string, pin: string) => post<Deal>(`${endpoints.deals}/${id}/ConfirmHandoff`, { pin }),
  ship: (id: string, carrier: string, trackingNumber: string, photo?: LocalImage | null) => {
    const form = new FormData();
    form.append("carrier", carrier);
    form.append("trackingNumber", trackingNumber);
    if (photo) appendImage(form, "photo", photo);
    return post<Deal>(`${endpoints.deals}/${id}/Ship`, form, multipart);
  },
  confirmReceipt: (id: string, photo?: LocalImage | null) => {
    const form = new FormData();
    form.append("confirmed", "true");
    if (photo) appendImage(form, "photo", photo);
    return post<Deal>(`${endpoints.deals}/${id}/ConfirmReceipt`, form, multipart);
  },
  dispute: (id: string, reason: string) => post<Deal>(`${endpoints.deals}/${id}/Dispute`, { reason }),

  // reviews & reputation
  dealReviews: (dealId: string) => get<DealReviews>(`${endpoints.deals}/${dealId}/Reviews`),
  submitReview: (dealId: string, input: ReviewInput) => post<Review>(`${endpoints.deals}/${dealId}/Reviews`, input),
  replyToReview: (reviewId: string, text: string) => post<Review>(`${endpoints.reviews}/${reviewId}/Reply`, { text }),
  userReviews: (userId: string) => get<Review[]>(`${endpoints.users}/${userId}/MarketReviews`),
  reputation: (userId: string) => get<Reputation>(`${endpoints.users}/${userId}/Reputation`),

  // reports (notice & action) and moderation of my own content
  reportRules: () => get<ReportRuleInfo[]>(`${endpoints.reports}/Rules`),
  createReport: (input: CreateReportInput) => post<MyReport>(endpoints.reports, input),
  myReports: () => get<MyReport[]>(`${endpoints.reports}/Mine`),
  againstMe: () => get<ModerationActionItem[]>(endpoints.againstMe),
  againstMeUnseen: async () => (await get<{ count: number }>(`${endpoints.againstMe}/UnseenCount`)).count,
  markAgainstMeSeen: () => post<void>(`${endpoints.againstMe}/Seen`),

  // marketplace terms
  terms: () => get<TermsStatus>(endpoints.marketTerms),
  acceptTerms: (version: string) =>
    post<TermsStatus>(`${endpoints.marketTerms}/Accept`, { version, isAdult: true, isPrivatePerson: true }),
};

// ---------------------------------------------------------------- formatting

export function formatPrice(cents?: number | null) {
  if (cents == null) return "";
  return `€${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/** "12.5" / "12,50" / "12" → cents; null when not a positive amount. */
export function parsePriceToCents(text: string): number | null {
  const normalized = text.replace(",", ".").replace(/[^0-9.]/g, "");
  if (!normalized) return null;
  const value = Number(normalized);
  if (!isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

export function formatDistance(km?: number | null) {
  if (km == null) return "";
  return km < 1 ? "< 1 km" : `${Math.round(km)} km`;
}

export function formatDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString();
}

export function formatDateTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function formatTimeAgo(iso?: string | null) {
  if (!iso) return "";
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days} d ago` : formatDate(iso);
}

export function formatResponseTime(minutes?: number | null) {
  if (minutes == null) return null;
  if (minutes < 60) return "within an hour";
  if (minutes < 60 * 24) return `within ${Math.round(minutes / 60)} hours`;
  return `within ${Math.round(minutes / 60 / 24)} days`;
}

export function daysLeft(iso?: string | null) {
  if (!iso) return null;
  // Rounded (not ceil): device clocks drift a few seconds from the server, and "14 days + 3 s" must read 14.
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 86400000));
}
