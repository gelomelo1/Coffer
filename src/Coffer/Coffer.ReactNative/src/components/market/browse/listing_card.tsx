import CustomText from "@/src/components/custom_ui/custom_text";
import { listingKindColors, listingKindLabels, listingStatusLabels } from "@/src/const/market";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useMarketStore } from "@/src/hooks/market_store";
import { customTheme } from "@/src/theme/theme";
import { ListingSummary } from "@/src/types/entities/market";
import { countryFlag, formatDistance, formatPrice, formatTimeAgo } from "@/src/utils/market_api";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { navigate } from "expo-router/build/global-state/routing";
import { TouchableOpacity, View } from "react-native";
import { ListingImageView, Tag } from "../ui/retro";

const c = customTheme.colors;

export function priceLine(l: { kind: ListingSummary["kind"]; priceCents?: number | null; exchangeFor?: string | null }) {
  if (l.kind === "sell") return formatPrice(l.priceCents);
  if (l.kind === "exchange") return `Swap for: ${l.exchangeFor ?? "?"}`;
  return l.priceCents ? `Budget ${formatPrice(l.priceCents)}` : "Searching";
}

export function openListing(id: string, title: string) {
  useMarketStore.getState().setListingId(id);
  navigate({ pathname: ROUTES.LISTINGDETAILS, params: pageParams.listingDetails(title) });
}

/** Feed row: photo, kind tag, title, price, item-type color stripe, city · distance, delivery icons. */
function ListingCard({ listing, showStatus = false }: { listing: ListingSummary; showStatus?: boolean }) {
  return (
    <TouchableOpacity
      onPress={() => openListing(listing.id, listing.title)}
      style={{
        flexDirection: "row",
        borderWidth: 2,
        borderColor: c.primary,
        borderLeftWidth: 8,
        borderLeftColor: listing.collectionTypeColor || c.secondary,
        backgroundColor: c.background,
        boxShadow: `3px 3px ${c.primary}`,
        marginBottom: 12,
      }}
    >
      <ListingImageView fileName={listing.firstImage} style={{ width: 96, height: 96 }} />
      <View style={{ flex: 1, padding: 8, gap: 2 }}>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <Tag label={listingKindLabels[listing.kind]} color={listingKindColors[listing.kind]} />
          {showStatus && listing.status !== "active" ? (
            <Tag label={listingStatusLabels[listing.status]} color={listing.status === "sold" ? "green" : c.accent} />
          ) : null}
        </View>
        <CustomText style={{ fontFamily: "VendSansBold", fontSize: 16 }} numberOfLines={2}>
          {listing.title}
        </CustomText>
        <CustomText style={{ fontFamily: "VendSansBold", color: c.secondary }} numberOfLines={1}>
          {priceLine(listing)}
        </CustomText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <MaterialIcons name="place" size={14} color={c.primary} />
          <CustomText style={{ fontSize: 13, flex: 1 }} numberOfLines={1}>
            {listing.cityName}
            {listing.distanceKm != null ? ` · ${formatDistance(listing.distanceKm)}` : ""} · {listing.collectionTypeName}
          </CustomText>
          {listing.allowsLocalPickup ? <MaterialCommunityIcons name="handshake" size={16} color={c.primary} /> : null}
          {listing.allowsShipping ? <MaterialCommunityIcons name="truck-delivery" size={16} color={c.primary} /> : null}
        </View>
        <CustomText style={{ fontSize: 11 }}>
          {formatTimeAgo(listing.createdAt)} · {listing.owner.name}
          {listing.sellerCountry ? ` ${countryFlag(listing.sellerCountry)}` : ""}
        </CustomText>
      </View>
    </TouchableOpacity>
  );
}

export default ListingCard;
