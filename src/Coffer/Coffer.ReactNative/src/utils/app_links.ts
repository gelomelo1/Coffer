/**
 * In-app links used in news posts: `coffer://{kind}/{id}` for a thing, `coffer://{page}` for a fixed page.
 * They are never real web URLs and are never handed to the OS; only the news renderer opens them.
 */
export type AppLinkKind = "item" | "collection" | "listing" | "user" | "news";
export type AppPage = "home" | "collections" | "follows" | "community" | "communityStats" | "communityNews" | "market" | "settings";

export type AppLink = { kind: AppLinkKind; id: string } | { kind: "page"; page: AppPage };

const KINDS: readonly AppLinkKind[] = ["item", "collection", "listing", "user", "news"];
const PAGES: Record<string, AppPage> = {
  home: "home",
  collections: "collections",
  follows: "follows",
  community: "community",
  "community/stats": "communityStats",
  "community/news": "communityNews",
  market: "market",
  settings: "settings",
};
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WEB = /^(https?:\/\/[^\s/?#]+|mailto:\S+@\S+)/i;
const IMAGE = /^coffer-image:([0-9a-f]{32}\.(?:jpg|png))$/;

/** What a tapped link is: an app target, `"web"` (http(s)/mailto, for the system to open) or `null` (can't be opened). */
export function parseAppLink(href: string): AppLink | "web" | null {
  const link = (href ?? "").trim();
  if (WEB.test(link)) return "web";
  if (!link.toLowerCase().startsWith("coffer://")) return null;

  const path = link.slice("coffer://".length);
  if (Object.prototype.hasOwnProperty.call(PAGES, path)) return { kind: "page", page: PAGES[path] };
  const parts = path.split("/");
  if (parts.length !== 2) return null;
  const [kind, id] = parts;
  if (!(KINDS as readonly string[]).includes(kind) || !GUID.test(id)) return null;
  return { kind: kind as AppLinkKind, id: id.toLowerCase() };
}

export function appLinkFor(kind: AppLinkKind, id: string): string {
  return `coffer://${kind}/${id}`;
}

/** The news image a markdown image source names (`coffer-image:{name}`), or null for anything else. */
export function imageNameOf(src: string): string | null {
  return IMAGE.exec((src ?? "").trim())?.[1] ?? null;
}
