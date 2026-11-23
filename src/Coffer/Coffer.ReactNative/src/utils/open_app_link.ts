import { openItem } from "@/src/components/comments/open_item";
import { openProfile } from "@/src/components/community/highlight_card";
import showToast from "@/src/components/custom_ui/toast";
import { openListing } from "@/src/components/market/browse/listing_card";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import i18n from "@/src/i18n";
import { AppPage, parseAppLink } from "@/src/utils/app_links";
import { marketApi } from "@/src/utils/market_api";
import { openCollection } from "@/src/utils/open_activity";
import { navigate } from "expo-router/build/global-state/routing";
import { Linking } from "react-native";

export function openNewsPost(id: string) {
  navigate({ pathname: ROUTES.COMMUNITY.NEWS_POST, params: pageParams.newsPost(id) });
}

/** Loads the title for the header; a gone listing still opens, and its page says it is unavailable. */
async function openListingById(id: string) {
  let title = "";
  try {
    title = (await marketApi.getListing(id)).title;
  } catch {}
  openListing(id, title);
}

const PAGE_ROUTES: Record<AppPage, { pathname: any; params: any }> = {
  home: { pathname: ROUTES.TABS.HOME, params: pageParams.home },
  collections: { pathname: ROUTES.TABS.COLLECTIONS, params: pageParams.collections },
  follows: { pathname: ROUTES.TABS.MYFOLLOWS, params: pageParams.myfollows },
  community: { pathname: ROUTES.TABS.COMMUNITY, params: pageParams.community },
  communityStats: { pathname: ROUTES.COMMUNITY.STATS, params: pageParams.communityPage("community:tiles.stats.title") },
  communityNews: { pathname: ROUTES.COMMUNITY.NEWS, params: pageParams.communityPage("community:tiles.news.title") },
  market: { pathname: ROUTES.TABS.MARKET, params: pageParams.market },
  settings: { pathname: ROUTES.SETTINGS.ROOT, params: pageParams.settings },
};

function cantOpen() {
  showToast("error", i18n.t("common:links.cantOpen"));
}

/**
 * Opens a link tapped in a news post: app links open their page (a gone or hidden target shows that page's own
 * "not found" message), http(s) and mailto links go to the system, anything else says it can't be opened.
 */
export async function openAppLink(href: string): Promise<void> {
  const link = parseAppLink(href);
  if (link === null) return cantOpen();
  if (link === "web") {
    try {
      await Linking.openURL(href.trim());
    } catch {
      cantOpen();
    }
    return;
  }
  switch (link.kind) {
    case "page":
      navigate(PAGE_ROUTES[link.page]);
      return;
    case "item":
      return openItem(link.id);
    case "collection":
      return openCollection(link.id);
    case "listing":
      return openListingById(link.id);
    case "user":
      return openProfile(link.id, "activity:openFailed");
    case "news":
      return openNewsPost(link.id);
  }
}
