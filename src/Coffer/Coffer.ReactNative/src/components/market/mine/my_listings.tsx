import { Loading } from "@/src/components/custom_ui/loading";
import { ErrorState } from "@/src/components/custom_ui/states";
import { useMyListingCounts, useMyListings } from "@/src/hooks/market_api";
import { colors, spacing } from "@/src/theme/theme";
import { MyListingsFilter } from "@/src/types/entities/market";
import { apiErrorText } from "@/src/utils/api_error_text";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl } from "react-native";
import ListingCard from "../browse/listing_card";
import { Chip, ChipRow, EmptyState } from "../ui/retro";

const FILTERS: MyListingsFilter[] = ["active", "sold", "archived"];

/**
 * MY LISTINGS tab, filtered by status: Active (live or reserved by a deal), Sold, Archived (incl. removed by
 * moderation). Filtering happens on the server, so the chips always match the real listing statuses.
 */
function MyListings() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<MyListingsFilter>("active");
  const { data = [], isFetching, isError, error, refetch } = useMyListings(filter);
  const { data: counts, refetch: refetchCounts } = useMyListingCounts();

  return (
    <FlatList
      data={data}
      keyExtractor={(l) => l.id}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl * 2 }}
      refreshControl={
        <RefreshControl
          refreshing={isFetching}
          colors={[colors.primary]}
          tintColor={colors.primary}
          onRefresh={() => {
            refetch();
            refetchCounts();
          }}
        />
      }
      ListHeaderComponent={
        <ChipRow>
          {FILTERS.map((f) => (
            <Chip
              key={f}
              label={counts ? t(`market:mine.filterCount.${f}`, { count: counts[f] ?? 0 }) : t(`market:mine.filter.${f}`)}
              selected={filter === f}
              onPress={() => setFilter(f)}
            />
          ))}
        </ChipRow>
      }
      ListEmptyComponent={
        isFetching ? (
          <Loading />
        ) : isError ? (
          <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
        ) : (
          <EmptyState icon="sell" title={t(`market:mine.emptyTitle.${filter}`)} text={t(`market:mine.emptyText.${filter}`)} />
        )
      }
      renderItem={({ item }) => <ListingCard listing={item} showStatus />}
    />
  );
}

export default MyListings;
