import { listingKindColors, listingKindLabels, listingStatusLabels } from "@/src/const/market";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import i18n from "@/src/i18n";
import { useMarketStore } from "@/src/hooks/market_store";
import { pressableShadowStyle } from "@/src/theme/pressable";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { ListingSummary } from "@/src/types/entities/market";
import { countryFlag, formatDistance, formatPrice, formatTimeAgo } from "@/src/utils/market_api";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { navigate } from "expo-router/build/global-state/routing";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { ListingImageView, Tag } from "../ui/retro";

export function priceLine(l: { kind: ListingSummary["kind"]; priceCents?: number | null; exchangeFor?: string | null }) {
  if (l.kind === "sell") return formatPrice(l.priceCents);
  if (l.kind === "exchange") return i18n.t("market:price.swapFor", { what: l.exchangeFor ?? "?" });
  return l.priceCents ? i18n.t("market:price.budget", { price: formatPrice(l.priceCents) }) : i18n.t("market:price.searching");
}

export function openListing(id: string, title: string) {
  useMarketStore.getState().setListingId(id);
  navigate({ pathname: ROUTES.LISTINGDETAILS, params: pageParams.listingDetails(title) });
}

function statusColor(status: ListingSummary["status"]) {
  if (status === "sold") return colors.success;
  if (status === "removed") return colors.danger;
  return colors.textMuted;
}

/**
 * Listing tile. `grid`: image-first tile for the 2-column feed; `row`: compact horizontal row (my listings,
 * narrow screens).
 */
function ListingCard({ listing, showStatus = false, layout = "row" }: { listing: ListingSummary; showStatus?: boolean; layout?: "grid" | "row" }) {
  const { t } = useTranslation();
  const grid = layout === "grid";
  const meta = [listing.cityName, listing.distanceKm != null ? formatDistance(listing.distanceKm) : null].filter(Boolean).join(" · "); // i18n-ignore
  const delivery = (
    <View style={{ flexDirection: "row", gap: spacing.xxs }}>
      {listing.allowsLocalPickup ? <MaterialCommunityIcons name="handshake" size={16} color={colors.text} accessibilityLabel={t("market:delivery.local_pickup")} /> : null}
      {listing.allowsShipping ? <MaterialCommunityIcons name="truck-delivery" size={16} color={colors.text} accessibilityLabel={t("market:delivery.shipping")} /> : null}
    </View>
  );

  const body = (
    <View style={{ flex: 1, padding: spacing.sm, gap: 2 }}>
      <View style={{ flexDirection: "row", gap: spacing.xxs, flexWrap: "wrap" }}>
        <Tag
          label={listingKindLabels[listing.kind]}
          color={listingKindColors[listing.kind]}
          textColor={listing.kind === "sell" ? colors.onSecondary : colors.onPrimary}
        />
        {showStatus && listing.status !== "active" ? <Tag label={listingStatusLabels[listing.status]} color={statusColor(listing.status)} /> : null}
      </View>
      <Text style={[typography.label, { color: colors.text }]} numberOfLines={2}>
        {listing.title}
      </Text>
      <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={1}>
        {priceLine(listing)}
      </Text>
      <Text style={[typography.caption, { color: colors.text }]} numberOfLines={2}>
        {meta}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 2 }}>
        <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]} numberOfLines={1}>
          {formatTimeAgo(listing.createdAt)} · {listing.owner.name}
          {listing.sellerCountry ? ` ${countryFlag(listing.sellerCountry)}` : ""}
        </Text>
        {delivery}
      </View>
    </View>
  );

  return (
    <Pressable
      onPress={() => openListing(listing.id, listing.title)}
      accessibilityRole="button"
      accessibilityLabel={[listingKindLabels[listing.kind], listing.title, priceLine(listing), meta].filter(Boolean).join(", ")}
      style={({ pressed }) => [
        {
          flex: grid ? 1 : undefined,
          flexDirection: grid ? "column" : "row",
          borderWidth: borders.width,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        pressableShadowStyle(pressed),
      ]}
    >
      <View style={{ borderBottomWidth: grid ? borders.width : 0, borderRightWidth: grid ? 0 : borders.width, borderColor: colors.border }}>
        <ListingImageView fileName={listing.firstImage} style={grid ? { width: "100%", aspectRatio: 1 } : { width: 104, height: 104 }} />
        {/* collection-type color strip */}
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6, backgroundColor: listing.collectionTypeColor || colors.secondary }} />
      </View>
      {body}
    </Pressable>
  );
}

export default memo(ListingCard);
