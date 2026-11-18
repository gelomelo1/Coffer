import { Loading } from "@/src/components/custom_ui/loading";
import ListingFeed from "@/src/components/market/browse/listing_feed";
import ChatList from "@/src/components/market/chats/chat_list";
import DealList from "@/src/components/market/deals/deal_list";
import MyListings from "@/src/components/market/mine/my_listings";
import TermsGate from "@/src/components/market/terms/terms_gate";
import { useMarketBadges, useTerms } from "@/src/hooks/market_api";
import { borders, colors, fonts, spacing } from "@/src/theme/theme";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

/** Marketplace: browse · my listings · chats · deals, as an equal-width segmented control (labels wrap). */
function Market() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  const { data: terms, isLoading: termsLoading } = useTerms();
  const { data: badges } = useMarketBadges();

  const unread = badges?.unreadMessages ?? 0;
  const actionable = badges?.actionableDeals ?? 0;
  const tabs = [
    { title: t("market:tabs.browse"), badge: 0 },
    { title: t("market:tabs.mine"), badge: 0 },
    { title: t("market:tabs.chats"), badge: unread },
    { title: t("market:tabs.deals"), badge: actionable },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", borderBottomWidth: borders.width, borderBottomColor: colors.border }}>
        {tabs.map((item, i) => {
          const active = tab === i;
          return (
            <Pressable
              key={item.title}
              onPress={() => setTab(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.badge > 0 ? `${item.title}, ${t("market:tabs.badge", { count: item.badge })}` : item.title}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 52,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: spacing.xxs,
                paddingVertical: spacing.xs,
                backgroundColor: active ? colors.secondary : pressed ? colors.surfaceAlt : colors.bg,
                borderLeftWidth: i === 0 ? 0 : borders.hairline,
                borderLeftColor: colors.borderMuted,
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
                <Text numberOfLines={2} style={{ color: colors.text, fontFamily: active ? fonts.bold : fonts.regular, fontSize: 14, lineHeight: 18, textAlign: "center" }}>
                  {item.title}
                </Text>
                {item.badge > 0 ? (
                  <View style={{ backgroundColor: colors.danger, minWidth: 20, paddingHorizontal: 4, alignItems: "center" }}>
                    <Text style={{ color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 12, lineHeight: 16 }}>{item.badge}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flex: 1 }}>
        {termsLoading ? (
          <Loading />
        ) : terms && !terms.accepted ? (
          <TermsGate />
        ) : tab === 0 ? (
          <ListingFeed />
        ) : tab === 1 ? (
          <MyListings />
        ) : tab === 2 ? (
          <ChatList />
        ) : (
          <DealList />
        )}
      </View>
    </View>
  );
}

export default Market;
