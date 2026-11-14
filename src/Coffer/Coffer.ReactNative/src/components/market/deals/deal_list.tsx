import CustomText from "@/src/components/custom_ui/custom_text";
import { Loading } from "@/src/components/custom_ui/loading";
import { dealStatusColors, dealStatusLabels, deliveryLabels } from "@/src/const/market";
import { useMyDeals } from "@/src/hooks/market_api";
import { customTheme } from "@/src/theme/theme";
import { Deal } from "@/src/types/entities/market";
import { formatPrice, formatTimeAgo } from "@/src/utils/market_api";
import { RefreshControl, SectionList, TouchableOpacity, View } from "react-native";
import { openChat } from "../chats/open_chat";
import { EmptyState, ListingImageView, Tag } from "../ui/retro";

const c = customTheme.colors;

const needsMe = (d: Deal) => d.nextActions.some((a) => a !== "cancel");

/** DEALS tab: grouped by what needs my attention. Tapping opens the chat with the deal panel. */
function DealList() {
  const { data = [], isFetching, refetch } = useMyDeals();

  const sections = [
    { title: "Needs your action", data: data.filter(needsMe) },
    { title: "In progress", data: data.filter((d) => !needsMe(d) && !["completed", "cancelled", "disputed"].includes(d.status)) },
    { title: "Finished", data: data.filter((d) => !needsMe(d) && ["completed", "cancelled", "disputed"].includes(d.status)) },
  ].filter((s) => s.data.length > 0);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(d) => d.id}
      contentContainerStyle={{ padding: 10, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
      ListEmptyComponent={
        isFetching ? <Loading /> : <EmptyState icon="handshake" title="No deals yet" text="Deals start from a chat when the seller proposes one." />
      }
      renderSectionHeader={({ section }) => (
        <CustomText style={{ fontFamily: "VendSansBold", fontSize: 16, marginVertical: 6 }}>{section.title.toUpperCase()}</CustomText>
      )}
      renderItem={({ item }) => {
        const other = item.myRole === "buyer" ? item.seller : item.buyer;
        return (
          <TouchableOpacity
            onPress={() => openChat(item.conversationId, other.name, item.listingTitle)}
            style={{
              flexDirection: "row",
              gap: 10,
              alignItems: "center",
              borderWidth: 2,
              borderColor: c.primary,
              borderLeftWidth: 8,
              borderLeftColor: dealStatusColors[item.status],
              backgroundColor: c.background,
              boxShadow: `2px 2px ${c.primary}`,
              padding: 8,
              marginBottom: 10,
            }}
          >
            <ListingImageView fileName={item.listingImage} style={{ width: 54, height: 54 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <CustomText style={{ fontFamily: "VendSansBold" }} numberOfLines={1}>
                {item.listingTitle}
              </CustomText>
              <CustomText style={{ fontSize: 14, color: dealStatusColors[item.status] }}>{dealStatusLabels[item.status]}</CustomText>
              <CustomText style={{ fontSize: 12 }}>
                {item.myRole === "buyer" ? "Buying from" : "Selling to"} {other.name} · {deliveryLabels[item.method]}
                {item.agreedPriceCents ? ` · ${formatPrice(item.agreedPriceCents)}` : ""} · {formatTimeAgo(item.updatedAt)}
              </CustomText>
            </View>
            {item.nextActions.includes("review") ? <Tag label="★ Review" color={c.secondary} textColor={c.primary} /> : null}
          </TouchableOpacity>
        );
      }}
    />
  );
}

export default DealList;
