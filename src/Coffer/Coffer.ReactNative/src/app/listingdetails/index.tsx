import { Avatar } from "@/src/components/custom_ui/avatar";
import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import { ListRow } from "@/src/components/custom_ui/list_row";
import { Loading } from "@/src/components/custom_ui/loading";
import { ErrorState } from "@/src/components/custom_ui/states";
import { priceLine } from "@/src/components/market/browse/listing_card";
import { openChat } from "@/src/components/market/chats/open_chat";
import ListingFormOverlay from "@/src/components/market/listing_form/listing_form_overlay";
import ReputationSummary from "@/src/components/market/review/reputation_summary";
import ReportOverlay from "@/src/components/market/ui/report_overlay";
import { EmptyState, ListingImageView, SectionCard, Tag, WarningBanner } from "@/src/components/market/ui/retro";
import { conditionLabels, listingKindColors, listingKindLabels, listingStatusLabels, privateSellerNote } from "@/src/const/market";
import { useInbox, useListing, useMarketMutation } from "@/src/hooks/market_api";
import { useMarketStore } from "@/src/hooks/market_store";
import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import { apiErrorText } from "@/src/utils/api_error_text";
import { chatPreview, formatTimeAgo, marketApi } from "@/src/utils/market_api";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { isAxiosError } from "axios";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";

/** Content column is capped so tablets/landscape keep a readable line length; photos stay full-bleed up to it. */
const MAX_CONTENT = 720;

function ListingDetails() {
  const { t } = useTranslation();
  const { listingId } = useMarketStore();
  const { width } = useWindowDimensions();
  const { data: listing, isFetching, isError, error, refetch } = useListing(listingId);
  // Only my chats about this listing (the first 20 are plenty for this section).
  const { items: myChats } = useInbox(listingId, !!listingId);
  const [editOpen, setEditOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [photo, setPhoto] = useState(0);

  const open = useMarketMutation((id: string) => marketApi.openConversation(id));
  const archive = useMarketMutation((id: string) => marketApi.archiveListing(id), t("market:details.archived"));
  const reactivate = useMarketMutation((id: string) => marketApi.reactivateListing(id), t("market:details.reactivated"));

  if (isError) {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    return status === 404 || status === 403 ? (
      <EmptyState icon="search-off" title={t("market:details.unavailableTitle")} text={t("market:details.unavailableText")} />
    ) : (
      <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
    );
  }
  if (!listing) return isFetching ? <Loading /> : null;

  const imageWidth = Math.min(width, MAX_CONTENT);
  const contactLabel = listing.kind === "wanted" ? t("market:details.haveThis") : t("market:details.messageSeller");
  const startChat = () => open.mutate(listing.id, { onSuccess: (conv) => openChat(conv.id, conv.other.name, listing.title) });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl * 2, alignItems: "center" }}>
        <View style={{ width: imageWidth, borderBottomWidth: borders.width, borderColor: colors.border }}>
          {listing.images.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPhoto(Math.round(e.nativeEvent.contentOffset.x / imageWidth))}
            >
              {listing.images.map((img) => (
                <ListingImageView key={img.id} fileName={img.fileName} fullScreen style={{ width: imageWidth, height: imageWidth * 0.75 }} />
              ))}
            </ScrollView>
          ) : (
            <ListingImageView fileName={null} style={{ width: imageWidth, height: 160 }} />
          )}
          {listing.images.length > 1 ? (
            <View
              accessibilityLabel={t("market:details.photoOf", { current: photo + 1, total: listing.images.length })}
              style={{
                position: "absolute",
                right: spacing.sm,
                bottom: spacing.sm,
                backgroundColor: colors.primary,
                paddingHorizontal: spacing.xs,
                paddingVertical: 2,
              }}
            >
              <Text style={[typography.label, { color: colors.onPrimary }]}>
                {photo + 1}/{listing.images.length}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ width: "100%", maxWidth: MAX_CONTENT, padding: spacing.md, gap: spacing.sm }}>
          <View style={{ flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" }}>
            <Tag
              label={listingKindLabels[listing.kind]}
              color={listingKindColors[listing.kind]}
              textColor={listing.kind === "sell" ? colors.onSecondary : colors.onPrimary}
            />
            <Tag label={listing.collectionTypeName} color={listing.collectionTypeColor || colors.primary} />
            {listing.privateSellerDeclared ? <Tag label={t("market:details.privateSeller")} color={colors.primary} /> : null}
            {listing.status !== "active" ? (
              <Tag label={listingStatusLabels[listing.status]} color={listing.status === "removed" ? colors.danger : colors.accent} />
            ) : null}
          </View>
          <Text accessibilityRole="header" style={[typography.display, { color: colors.text }]}>
            {listing.title}
          </Text>
          <Text style={[typography.headline, { color: colors.text }]}>{priceLine(listing)}</Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: spacing.md, rowGap: spacing.xs }}>
            <Info icon={<MaterialIcons name="place" size={sizes.iconSm} color={colors.text} />} text={listing.city.name} />
            {listing.condition ? (
              <Info icon={<MaterialIcons name="verified" size={sizes.iconSm} color={colors.text} />} text={conditionLabels[listing.condition]} />
            ) : null}
            {listing.allowsLocalPickup ? (
              <Info icon={<MaterialCommunityIcons name="handshake" size={sizes.iconSm} color={colors.text} />} text={t("market:delivery.local_pickup")} />
            ) : null}
            {listing.allowsShipping ? (
              <Info icon={<MaterialCommunityIcons name="truck-delivery" size={sizes.iconSm} color={colors.text} />} text={t("market:delivery.shipping")} />
            ) : null}
            <Info icon={<MaterialIcons name="schedule" size={sizes.iconSm} color={colors.text} />} text={formatTimeAgo(listing.createdAt)} />
          </View>

          {listing.status === "removed" ? (
            <SectionCard accent={colors.danger} title={t("market:details.removedTitle")}>
              <Text style={[typography.meta, { color: colors.text }]}>{t("market:details.removedText")}</Text>
            </SectionCard>
          ) : null}
          <WarningBanner />
          {listing.privateSellerDeclared ? (
            <Text style={[typography.meta, { color: colors.textMuted, marginTop: -spacing.xs, marginBottom: spacing.sm }]}>{privateSellerNote()}</Text>
          ) : null}

          <SectionCard title={listing.kind === "wanted" ? t("market:details.lookingFor") : t("market:details.included")}>
            {listing.lines.map((line, i) => (
              <View key={i} style={{ flexDirection: "row", gap: spacing.xs }}>
                <Text style={[typography.body, { color: colors.text }]}>•</Text>
                <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{line.name}</Text>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>{t("market:details.quantity", { count: line.quantity })}</Text>
              </View>
            ))}
          </SectionCard>

          {listing.kind === "exchange" ? (
            <SectionCard title={t("market:details.wantsInExchange")}>
              <Text style={[typography.body, { color: colors.text }]}>{listing.exchangeFor}</Text>
            </SectionCard>
          ) : null}

          {listing.description ? (
            <SectionCard title={t("market:details.description")}>
              <CustomText foldable maxLines={6}>
                {listing.description}
              </CustomText>
            </SectionCard>
          ) : null}

          <SectionCard title={listing.kind === "wanted" ? t("market:details.postedBy") : t("market:details.seller")}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Avatar uri={listing.owner.avatar} size={48} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>{listing.owner.name}</Text>
                <ReputationSummary userId={listing.owner.id} userName={listing.owner.name} isMe={listing.isMine} />
              </View>
            </View>
          </SectionCard>

          {!listing.isMine ? (
            <View style={{ gap: spacing.sm }}>
              {listing.myConversationId ? (
                <CustomButton
                  title={t("market:details.openChat")}
                  icon={<MaterialIcons name="chat" size={sizes.iconSm} color={colors.onPrimary} />}
                  onPress={() => openChat(listing.myConversationId!, listing.owner.name, listing.title)}
                />
              ) : listing.status === "active" || listing.status.startsWith("pending") ? (
                <CustomButton
                  title={contactLabel}
                  icon={<MaterialIcons name="chat" size={sizes.iconSm} color={colors.onPrimary} />}
                  loading={open.isPending}
                  disabled={open.isPending}
                  onPress={startChat}
                />
              ) : null}
              <Pressable
                onPress={() => setReportOpen(true)}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  alignSelf: "flex-start",
                  gap: spacing.xxs,
                  minHeight: sizes.touch,
                  paddingHorizontal: spacing.xxs,
                  backgroundColor: pressed ? colors.surfaceAlt : "transparent",
                })}
              >
                <MaterialIcons name="flag" size={sizes.iconSm} color={colors.danger} />
                <Text style={[typography.label, { color: colors.danger, textDecorationLine: "underline" }]}>{t("market:details.report")}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {listing.status === "active" && !listing.openDealId ? (
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <CustomButton
                    title={t("common:actions.edit")}
                    icon={<MaterialIcons name="edit" size={sizes.iconSm} color={colors.onPrimary} />}
                    onPress={() => setEditOpen(true)}
                    containerStyle={{ flex: 1 }}
                  />
                  <CustomButton
                    title={t("market:details.archive")}
                    variant="outline"
                    icon={<MaterialIcons name="archive" size={sizes.iconSm} color={colors.text} />}
                    disabled={archive.isPending}
                    loading={archive.isPending}
                    onPress={() => archive.mutate(listing.id)}
                    containerStyle={{ flex: 1 }}
                  />
                </View>
              ) : null}
              {listing.status === "archived" ? (
                <CustomButton
                  title={t("market:details.reactivate")}
                  disabled={reactivate.isPending}
                  loading={reactivate.isPending}
                  onPress={() => reactivate.mutate(listing.id)}
                />
              ) : null}
              <SectionCard title={t("market:details.chatsAbout", { count: myChats.length })} padded={false}>
                {myChats.length === 0 ? (
                  <Text style={[typography.meta, { color: colors.textMuted, padding: spacing.md, paddingTop: 0 }]}>{t("market:details.noMessages")}</Text>
                ) : null}
                {myChats.map((chat) => {
                  const preview = chat.lastMessage ? chatPreview(chat.lastMessage) : chat.lastMessagePreview;
                  return (
                    <ListRow
                      key={chat.id}
                      title={chat.other.name}
                      subtitle={preview ?? t("market:details.noPreview")}
                      titleLines={1}
                      leading={<MaterialIcons name="chat" size={sizes.iconMd} color={colors.text} />}
                      trailing={chat.unreadCount > 0 ? <Tag label={String(chat.unreadCount)} color={colors.danger} /> : undefined}
                      accessibilityLabel={[
                        chat.other.name,
                        preview,
                        chat.unreadCount > 0 ? t("market:tabs.badge", { count: chat.unreadCount }) : null,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                      onPress={() => openChat(chat.id, chat.other.name, listing.title)}
                      style={{ borderTopWidth: borders.hairline, borderColor: colors.borderMuted }}
                    />
                  );
                })}
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
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xxs }}>
      {icon}
      <Text style={[typography.meta, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

export default ListingDetails;
