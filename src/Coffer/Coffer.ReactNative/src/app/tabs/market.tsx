import CustomText from "@/src/components/custom_ui/custom_text";
import rootViewStyle from "@/src/components/custom_ui/root_view";
import ListingFeed from "@/src/components/market/browse/listing_feed";
import ChatList from "@/src/components/market/chats/chat_list";
import DealList from "@/src/components/market/deals/deal_list";
import MyListings from "@/src/components/market/mine/my_listings";
import TermsGate from "@/src/components/market/terms/terms_gate";
import { Loading } from "@/src/components/custom_ui/loading";
import { useInbox, useMyDeals, useTerms } from "@/src/hooks/market_api";
import { customTheme } from "@/src/theme/theme";
import { useState } from "react";
import { SafeAreaView, ScrollView, TouchableOpacity, View } from "react-native";
import { Divider } from "react-native-elements";

const c = customTheme.colors;

/** Marketplace: browse · my listings · chats · deals. */
function Market() {
  const [tab, setTab] = useState(0);
  const { data: terms, isLoading: termsLoading } = useTerms();
  const { data: inbox = [] } = useInbox();
  const { data: deals = [] } = useMyDeals();

  const unread = inbox.reduce((sum, x) => sum + x.unreadCount, 0);
  const actionable = deals.filter((d) => d.nextActions.some((a) => a !== "cancel")).length;
  const tabs = [
    { title: "BROWSE", badge: 0 },
    { title: "MY LISTINGS", badge: 0 },
    { title: "CHATS", badge: unread },
    { title: "DEALS", badge: actionable },
  ];

  return (
    <View style={[rootViewStyle(), { flex: 1, padding: 0 }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ height: 40 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: "row", alignItems: "center", justifyContent: "center", minWidth: "100%" }}
          >
            {tabs.map((t, i) => (
              <TouchableOpacity
                key={t.title}
                onPress={() => setTab(i)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderBottomWidth: tab === i ? 3 : 0,
                  borderBottomColor: c.secondary,
                  flexDirection: "row",
                  gap: 4,
                  alignItems: "center",
                }}
              >
                <CustomText style={{ fontFamily: "VendSansBold", color: tab === i ? c.secondary : c.primary, fontSize: 14 }}>
                  {t.title}
                </CustomText>
                {t.badge > 0 ? (
                  <View style={{ backgroundColor: "red", paddingHorizontal: 5, minWidth: 18, alignItems: "center" }}>
                    <CustomText style={{ color: c.background, fontSize: 11, fontFamily: "VendSansBold" }}>{t.badge}</CustomText>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <Divider width={2} color={c.primary} />
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
      </SafeAreaView>
    </View>
  );
}

export default Market;
