import { resolveTextParams } from "./text_params.ts";

/**
 * The text of a chat message in the app language. System messages come from the backend as a code + params
 * (market:system.<code>); their English body is only the fallback for messages stored before codes existed, or for a
 * code a newer backend sends that this app doesn't know yet. Pure, so it can be unit tested with node.
 */
export interface MessageLike {
  kind: "text" | "price_offer" | "meetup_proposal" | "system";
  body: string;
  isRemoved: boolean;
  amountCents?: number | null;
  systemCode?: string | null;
  systemParams?: Record<string, string> | null;
}

export interface Texts {
  t: (key: string, params?: Record<string, string>) => string;
  exists: (key: string) => boolean;
  money: (cents: number) => string;
}

const PREVIEW_LENGTH = 80;

export function messageText(message: MessageLike, { t, exists, money }: Texts): string {
  if (message.isRemoved) return t("market:chat.removed");
  const key = message.kind === "system" && message.systemCode ? `market:system.${message.systemCode}` : null;
  if (key && exists(key)) return t(key, resolveTextParams(message.systemParams, (k) => t(k), money) ?? {});
  return message.body;
}

/** One-line inbox preview of a conversation's last message. */
export function messagePreview(message: MessageLike, texts: Texts): string {
  if (!message.isRemoved && message.kind === "price_offer")
    return message.amountCents != null ? texts.t("market:chat.offer", { price: texts.money(message.amountCents) }) : texts.t("market:chat.priceOffer");
  if (!message.isRemoved && message.kind === "meetup_proposal") return texts.t("market:chat.previewMeetup");
  const text = messageText(message, texts);
  return text.length > PREVIEW_LENGTH ? text.slice(0, PREVIEW_LENGTH) + "…" : text;
}
