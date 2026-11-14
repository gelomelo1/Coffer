import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import { Loading } from "@/src/components/custom_ui/loading";
import rootViewStyle from "@/src/components/custom_ui/root_view";
import { priceLine } from "@/src/components/market/browse/listing_card";
import { openChat } from "@/src/components/market/chats/open_chat";
import ListingFormOverlay from "@/src/components/market/listing_form/listing_form_overlay";
import ReputationSummary from "@/src/components/market/review/reputation_summary";
import ReportOverlay from "@/src/components/market/ui/report_overlay";
import { EmptyState, ListingImageView, SectionCard, Tag, WarningBanner } from "@/src/components/market/ui/retro";
import {
  conditionLabels,
  listingKindColors,
  listingKindLabels,
  listingStatusLabels,
  PRIVATE_SELLER_NOTE,
} from "@/src/const/market";
import { useInbox, useListing, useMarketMutation } from "@/src/hooks/market_api";
import { useMarketStore } from "@/src/hooks/market_store";
import { customTheme } from "@/src/theme/theme";
import { formatTimeAgo, marketApi } from "@/src/utils/market_api";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { ScrollView, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Avatar } from "react-native-elements";

const c = customTheme.colors;

function ListingDetails() {
  const { listingId } = useMarketStore();
  const { width } = useWindowDimensions();
  const { data: listing, isFetching, isError } = useListing(listingId);
  const { data: inbox = [] } = useInbox();
  const [editOpen, setEditOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const open = useMarketMutation((id: string) => marketApi.openConversation(id));
  const archive = useMarketMutation((id: string) => marketApi.archiveListing(id), "Listing archived");
  const reactivate = useMarketMutation((id: string) => marketApi.reactivateListing(id), "Listing is active again");

  if (isError) return <EmptyState icon="search-off" title="Listing not available" text="It may have been archived." />;
  if (!listing) return isFetching ? <Loading /> : null;

  const myChats = inbox.filter((ci) => ci.subject.id === listing.id);
  const contactLabel = listing.kind === "wanted" ? "I have this — message" : "Message seller";

  const startChat = () =>
    open.mutate(listing.id, { onSuccess: (conv) => openChat(conv.id, conv.other.name, listing.title) });

  return (
    <View style={[rootViewStyle(), { flex: 1, padding: 0 }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {listing.images.length > 0 ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {listing.images.map((img) => (
              <ListingImageView key={img.id} fileName={img.fileName} fullScreen style={{ width, height: width * 0.75 }} />
            ))}
          </ScrollView>
        ) : (
          <ListingImageView fileName={null} style={{ width, height: 140 }} />
        )}
        {listing.images.length > 1 ? (
          <CustomText style={{ textAlign: "center", fontSize: 12 }}>Swipe for {listing.images.length} photos</CustomText>
        ) : null}

        <View style={{ padding: 12, gap: 6 }}>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Tag label={listingKindLabels[listing.kind]} color={listingKindColors[listing.kind]} />
            <Tag label={listing.collectionTypeName} color={listing.collectionTypeColor || c.primary} />
            {listing.privateSellerDeclared ? <Tag label="Private seller" color={c.primary} /> : null}
            {listing.status !== "active" ? (
              <Tag label={listingStatusLabels[listing.status]} color={listing.status === "removed" ? "red" : c.accent} />
            ) : null}
          </View>
          <CustomText style={{ fontFamily: "VendSansBold", fontSize: 22 }}>{listing.title}</CustomText>
          <CustomText style={{ fontFamily: "VendSansBold", fontSize: 20, color: c.secondary }}>{priceLine(listing)}</CustomText>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <Info icon={<MaterialIcons name="place" size={16} color={c.primary} />} text={listing.city.name} />
            {listing.condition ? (
              <Info icon={<MaterialIcons name="verified" size={16} color={c.primary} />} text={conditionLabels[listing.condition]} />
            ) : null}
            {listing.allowsLocalPickup ? (
              <Info icon={<MaterialCommunityIcons name="handshake" size={16} color={c.primary} />} text="Personal pickup" />
            ) : null}
            {listing.allowsShipping ? (
              <Info icon={<MaterialCommunityIcons name="truck-delivery" size={16} color={c.primary} />} text="Shipping" />
            ) : null}
            <Info icon={<MaterialIcons name="schedule" size={16} color={c.primary} />} text={formatTimeAgo(listing.createdAt)} />
          </View>

          {listing.status === "removed" ? (
            <SectionCard accent="red" title="Removed by moderation">
              <CustomText style={{ fontSize: 14 }}>
                This listing broke the marketplace rules and is no longer visible to others. See Settings › Reports ›
                Moderation of my content for the reason.
              </CustomText>
            </SectionCard>
          ) : null}
          <WarningBanner />
          {listing.privateSellerDeclared ? <CustomText style={{ fontSize: 13 }}>{PRIVATE_SELLER_NOTE}</CustomText> : null}

          <SectionCard title={listing.kind === "wanted" ? "Looking for" : "What's included"}>
            {listing.lines.map((line, i) => (
              <CustomText key={i}>
                • {line.name} <CustomText style={{ fontFamily: "VendSansBold" }}>×{line.quantity}</CustomText>
              </CustomText>
            ))}
          </SectionCard>

          {listing.kind === "exchange" ? (
            <SectionCard title="Wants in exchange">
              <CustomText>{listing.exchangeFor}</CustomText>
            </SectionCard>
          ) : null}

          {listing.description ? (
            <SectionCard title="Description">
              <CustomText foldable maxLines={6}>
                {listing.description}
              </CustomText>
            </SectionCard>
          ) : null}

          <SectionCard title={listing.kind === "wanted" ? "Posted by" : "Seller"}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Avatar
                size={40}
                rounded
                source={listing.owner.avatar ? { uri: listing.owner.avatar } : undefined}
                icon={!listing.owner.avatar ? { name: "user", type: "feather", color: c.secondary } : undefined}
                containerStyle={{ backgroundColor: c.primary }}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <CustomText style={{ fontFamily: "VendSansBold" }}>{listing.owner.name}</CustomText>
                <ReputationSummary userId={listing.owner.id} userName={listing.owner.name} isMe={listing.isMine} />
              </View>
            </View>
          </SectionCard>

          {!listing.isMine ? (
            listing.myConversationId ? (
              <CustomButton
                title="Open chat"
                onPress={() => openChat(listing.myConversationId!, listing.owner.name, listing.title)}
              />
            ) : listing.status === "active" || listing.status.startsWith("pending") ? (
              <CustomButton title={contactLabel} loading={open.isPending} disabled={open.isPending} onPress={startChat} />
            ) : null
          ) : null}
          {!listing.isMine ? (
            <TouchableOpacity onPress={() => setReportOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
              <MaterialIcons name="flag" size={18} color="red" />
              <CustomText style={{ color: "red", textDecorationLine: "underline", fontSize: 14 }}>Report this listing</CustomText>
            </TouchableOpacity>
          ) : (
            <View style={{ gap: 10 }}>
              {listing.status === "active" && !listing.openDealId ? (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <CustomButton title="Edit" onPress={() => setEditOpen(true)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <CustomButton title="Archive" disabled={archive.isPending} onPress={() => archive.mutate(listing.id)} />
                  </View>
                </View>
              ) : null}
              {listing.status === "archived" ? (
                <CustomButton title="Reactivate" disabled={reactivate.isPending} onPress={() => reactivate.mutate(listing.id)} />
              ) : null}
              <SectionCard title={`Chats about this listing (${myChats.length})`}>
                {myChats.length === 0 ? <CustomText style={{ fontSize: 14 }}>No messages yet.</CustomText> : null}
                {myChats.map((chat) => (
                  <TouchableOpacity
                    key={chat.id}
                    onPress={() => openChat(chat.id, chat.other.name, listing.title)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderTopWidth: 1, borderColor: c.primary }}
                  >
                    <MaterialIcons name="chat" size={20} color={c.primary} />
                    <CustomText style={{ flex: 1 }} numberOfLines={1}>
                      {chat.other.name}: {chat.lastMessagePreview ?? "—"}
                    </CustomText>
                    {chat.unreadCount > 0 ? <Tag label={String(chat.unreadCount)} color="red" /> : null}
                  </TouchableOpacity>
                ))}
              </SectionCard>
            </View>
          )}
        </View>
      </ScrollView>

      <ListingFormOverlay isVisible={editOpen} onClose={() => setEditOpen(false)} editing={listing} />
      {!listing.isMine ? (
        <ReportOverlay isVisible={reportOpen} onClose={() => setReportOpen(false)} targetType="listing" targetId={listing.id} />
      ) : null}
    </View>
  );
}

function Info({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {icon}
      <CustomText style={{ fontSize: 14 }}>{text}</CustomText>
    </View>
  );
}

export default ListingDetails;
