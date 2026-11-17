import { test } from "node:test";
import assert from "node:assert/strict";
import { messagePreview, messageText } from "../src/utils/message_text.ts";

const texts: Record<string, string> = {
  "market:system.dealProposedPrice": "Üzletajánlat: {{method}}, {{price}}.",
  "market:system.method.shipping": "szállítás",
  "market:system.dealCancelledReason": "Az üzlet lemondva: {{reason}}",
  "market:system.cancelReason.declined": "a vevő elutasította.",
  "market:chat.removed": "Ezt az üzenetet egy moderátor eltávolította.",
  "market:chat.offer": "Ajánlat: {{price}}",
  "market:chat.previewMeetup": "Találkozó-javaslat",
};
const t = (key: string, params?: Record<string, string>) =>
  (texts[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) => params?.[name] ?? "");
const tr = { t, exists: (key: string) => key in texts, money: (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €` };

const base = { id: "1", isRemoved: false, createdAt: "" };

test("a system message with a known code is shown in the app language, with its params resolved", () => {
  const message = {
    ...base,
    kind: "system" as const,
    body: "🤝 Deal proposed: shipping for €12.50. Waiting for the buyer to accept.",
    systemCode: "dealProposedPrice",
    systemParams: { method: "@t:market:system.method.shipping", price: "@eur:1250" },
  };
  assert.equal(messageText(message, tr), "Üzletajánlat: szállítás, 12,50 €.");
});

test("a generated reason inside a param is translated too", () => {
  const message = {
    ...base,
    kind: "system" as const,
    body: "✖️ Deal cancelled: Declined by the buyer.",
    systemCode: "dealCancelledReason",
    systemParams: { reason: "@t:market:system.cancelReason.declined" },
  };
  assert.equal(messageText(message, tr), "Az üzlet lemondva: a vevő elutasította.");
});

test("old system messages without a code, and codes the app doesn't know yet, fall back to the English body", () => {
  assert.equal(messageText({ ...base, kind: "system", body: "Deal proposed." }, tr), "Deal proposed.");
  assert.equal(messageText({ ...base, kind: "system", body: "New thing.", systemCode: "fromTheFuture" }, tr), "New thing.");
});

test("removed messages use the translated placeholder", () => {
  assert.equal(messageText({ ...base, kind: "text", body: "This message was removed by a moderator.", isRemoved: true }, tr), "Ezt az üzenetet egy moderátor eltávolította.");
});

test("inbox previews: proposals get a translated label, long texts are shortened", () => {
  assert.equal(messagePreview({ ...base, kind: "price_offer", body: "", amountCents: 900 }, tr), "Ajánlat: 9,00 €");
  assert.equal(messagePreview({ ...base, kind: "meetup_proposal", body: "" }, tr), "Találkozó-javaslat");
  assert.equal(messagePreview({ ...base, kind: "text", body: "x".repeat(100) }, tr), "x".repeat(80) + "…");
});
