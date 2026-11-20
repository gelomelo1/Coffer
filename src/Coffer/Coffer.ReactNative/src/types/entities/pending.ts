import { ItemProvided } from "./item";

/** A cap the AI found on an uploaded photo, waiting on its collection's review list until it is added or deleted. */
export interface PendingItem {
  id: string;
  collectionId: string;
  /** How many of this cap were on the photo. */
  quantity: number;
  createdAt: string;
  /** "found": very likely one you already have (matches[0]). */
  state: "found" | "not found";
  /** Closest items of the collection (up to 3), computed when the list is read. */
  similars: ItemProvided[];
}

/** One collection's share of the waiting list. */
export interface PendingSummary {
  collectionId: string;
  collectionName: string;
  collectionTypeId: number;
  count: number;
  latestId: string;
}

/** What one checked photo produced. */
export interface ImageCheckResult {
  created: PendingItem[];
  /** Detections lost because their temp files had already vanished. */
  lost: number;
}

export interface AddPendingInput {
  /** More of an existing item… */
  matchItemId?: string | null;
  /** …or a new one (attributes, tags, notes; the image comes from the waiting cap). */
  item?: {
    collectionId: string;
    quantity: number;
    image: string;
    description?: string | null;
    privateNote?: string | null;
    itemAttributes: {
      attributeId: number;
      valueString?: string | null;
      valueNumber?: number | null;
      valueDate?: string | null;
      valueBoolean?: boolean | null;
    }[];
    itemTags: { tag: string }[];
  } | null;
  quantity: number;
}
