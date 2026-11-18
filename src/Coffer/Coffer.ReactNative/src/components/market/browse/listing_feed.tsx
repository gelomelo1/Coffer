import ListFooterLoading from "@/src/components/custom_ui/list_footer";
import CustomButton from "@/src/components/custom_ui/custom_button";
import { Loading } from "@/src/components/custom_ui/loading";
import { ErrorState } from "@/src/components/custom_ui/states";
import { sortLabels } from "@/src/const/market";
import { useListings } from "@/src/hooks/market_api";
import { useMarketStore } from "@/src/hooks/market_store";
import { colors, spacing, typography } from "@/src/theme/theme";
import { ListingKind, ListingSort } from "@/src/types/entities/market";
import { apiErrorText } from "@/src/utils/api_error_text";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl, Text, useWindowDimensions, View } from "react-native";
import ListingFormOverlay from "../listing_form/listing_form_overlay";
import { Chip, ChipRow, EmptyState, WarningBanner } from "../ui/retro";
import ListingCard from "./listing_card";
import ListingFilterOverlay, { activeFilterCount } from "./listing_filter_overlay";

/** BROWSE tab: warning, create buttons, sort + filters, infinite grid of other users' active listings. */
function ListingFeed() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const columns = width >= 360 ? 2 : 1;
  const { filters, setFilters } = useMarketStore();
  const [filterOpen, setFilterOpen] = useState(false);
  const [formKind, setFormKind] = useState<ListingKind | null>(null);
  const { items: listings, total, isLoading, isError, error, loadMore, isFetchingNextPage, refetch, refreshing, onRefresh } = useListings(filters);
  const filterCount = activeFilterCount(filters);

  const setSort = (sort: ListingSort) => {
    if (sort === "nearest" && !filters.city) {
      setFilterOpen(true);
      return;
    }
    setFilters({ ...filters, sort });
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        key={`cols-${columns}`}
        data={listings}
        numColumns={columns}
        keyExtractor={(l) => l.id}
        columnWrapperStyle={columns > 1 ? { gap: spacing.md } : undefined}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl * 2 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm }}>
            <WarningBanner collapsible />
            <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
              <CustomButton
                title={t("market:feed.sell")}
                icon={<MaterialIcons name="add" size={20} color={colors.onPrimary} />}
                onPress={() => setFormKind("sell")}
                containerStyle={{ flex: 1, minWidth: 140 }}
              />
              <CustomButton
                title={t("market:feed.searching")}
                variant="outline"
                icon={<MaterialIcons name="search" size={20} color={colors.text} />}
                onPress={() => setFormKind("wanted")}
                containerStyle={{ flex: 1, minWidth: 140 }}
              />
            </View>
            <ChipRow>
              <Chip
                label={filterCount ? t("market:feed.filtersCount", { count: filterCount }) : t("market:feed.filters")}
                selected={filterCount > 0}
                icon={<MaterialIcons name="tune" size={16} color={colors.text} />}
                onPress={() => setFilterOpen(true)}
              />
              {(Object.keys(sortLabels) as ListingSort[]).map((s) => (
                <Chip key={s} label={sortLabels[s]} selected={filters.sort === s} onPress={() => setSort(s)} />
              ))}
            </ChipRow>
            <Text style={[typography.meta, { color: colors.textMuted }]}>
              {filters.city
                ? filters.radiusKm
                  ? t("market:feed.aroundWithin", { city: filters.city.name, km: filters.radiusKm })
                  : t("market:feed.around", { city: filters.city.name })
                : t("market:feed.cityTip")}
            </Text>
            {!isLoading && total > 0 ? (
              <Text style={[typography.label, { color: colors.text }]}>{t("market:feed.resultCount", { count: total })}</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <Loading />
          ) : isError ? (
            <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
          ) : (
            <EmptyState icon="storefront" title={t("market:feed.emptyTitle")} text={t("market:feed.emptyText")} />
          )
        }
        ListFooterComponent={<ListFooterLoading loading={isFetchingNextPage} />}
        renderItem={({ item }) => (
          <View style={{ flex: 1, maxWidth: columns > 1 ? "50%" : "100%" }}>
            <ListingCard listing={item} layout={columns > 1 ? "grid" : "row"} />
          </View>
        )}
      />

      <ListingFilterOverlay isVisible={filterOpen} onClose={() => setFilterOpen(false)} value={filters} onApply={setFilters} />
      <ListingFormOverlay isVisible={formKind !== null} onClose={() => setFormKind(null)} initialKind={formKind ?? "sell"} />
    </View>
  );
}

export default ListingFeed;
