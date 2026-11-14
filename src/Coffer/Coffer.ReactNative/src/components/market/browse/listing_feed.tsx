import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import { Loading } from "@/src/components/custom_ui/loading";
import { sortLabels } from "@/src/const/market";
import { useListings } from "@/src/hooks/market_api";
import { useMarketStore } from "@/src/hooks/market_store";
import { customTheme } from "@/src/theme/theme";
import { ListingKind, ListingSort } from "@/src/types/entities/market";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import ListingFormOverlay from "../listing_form/listing_form_overlay";
import { Chip, ChipRow, EmptyState, WarningBanner } from "../ui/retro";
import ListingCard from "./listing_card";
import ListingFilterOverlay, { activeFilterCount } from "./listing_filter_overlay";

const c = customTheme.colors;

/** BROWSE tab: warning, create buttons, sort + filters, infinite list of other users' active listings. */
function ListingFeed() {
  const { filters, setFilters } = useMarketStore();
  const [filterOpen, setFilterOpen] = useState(false);
  const [formKind, setFormKind] = useState<ListingKind | null>(null);
  const { data, isFetching, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useListings(filters);

  const listings = data?.pages.flat() ?? [];
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
        data={listings}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ padding: 10, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={isFetching && !isFetchingNextPage} onRefresh={refetch} />}
        onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={{ gap: 8, marginBottom: 8 }}>
            <WarningBanner collapsible />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <CustomButton title="+ Sell / Swap" onPress={() => setFormKind("sell")} />
              </View>
              <View style={{ flex: 1 }}>
                <CustomButton title="+ I'm searching" onPress={() => setFormKind("wanted")} />
              </View>
            </View>
            <ChipRow>
              <Chip
                label={filterCount ? `Filters (${filterCount})` : "Filters"}
                selected={filterCount > 0}
                icon={<MaterialIcons name="tune" size={16} color={c.primary} />}
                onPress={() => setFilterOpen(true)}
              />
              {(Object.keys(sortLabels) as ListingSort[]).map((s) => (
                <Chip key={s} label={sortLabels[s]} selected={filters.sort === s} onPress={() => setSort(s)} />
              ))}
            </ChipRow>
            {filters.city ? (
              <CustomText style={{ fontSize: 13 }}>
                Around {filters.city.name}
                {filters.radiusKm ? ` · within ${filters.radiusKm} km` : ""}
              </CustomText>
            ) : (
              <CustomText style={{ fontSize: 13 }}>Tip: pick a city in Filters to sort by closeness.</CustomText>
            )}
          </View>
        }
        ListEmptyComponent={
          isFetching ? (
            <Loading />
          ) : isError ? (
            <EmptyState icon="cloud-off" title="Couldn't load listings" text="Pull down to try again." />
          ) : (
            <EmptyState icon="storefront" title="Nothing here yet" text="Try other filters, or post the first listing!" />
          )
        }
        ListFooterComponent={isFetchingNextPage ? <Loading /> : null}
        renderItem={({ item }) => <ListingCard listing={item} />}
      />

      <ListingFilterOverlay
        isVisible={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={filters}
        onApply={setFilters}
      />
      <ListingFormOverlay isVisible={formKind !== null} onClose={() => setFormKind(null)} initialKind={formKind ?? "sell"} />
    </View>
  );
}

export default ListingFeed;
