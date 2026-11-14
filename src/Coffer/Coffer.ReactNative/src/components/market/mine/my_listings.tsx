import { Loading } from "@/src/components/custom_ui/loading";
import { useMyListingCounts, useMyListings } from "@/src/hooks/market_api";
import { MyListingsFilter } from "@/src/types/entities/market";
import { useState } from "react";
import { FlatList, RefreshControl } from "react-native";
import ListingCard from "../browse/listing_card";
import { Chip, ChipRow, EmptyState } from "../ui/retro";

const FILTERS: { key: MyListingsFilter; label: string; empty: string }[] = [
  { key: "active", label: "Active", empty: "Nothing on sale right now. Use “+ Sell / Swap” on the Browse tab to post a listing." },
  { key: "sold", label: "Sold", empty: "No sold listings yet. Completed deals show up here." },
  { key: "archived", label: "Archived", empty: "Nothing archived. Archived and moderation-removed listings show up here." },
];

/**
 * MY LISTINGS tab, filtered by status: Active (live or reserved by a deal), Sold, Archived (incl. removed by
 * moderation). Filtering happens on the server, so the chips always match the real listing statuses.
 */
function MyListings() {
  const [filter, setFilter] = useState<MyListingsFilter>("active");
  const { data = [], isFetching, refetch } = useMyListings(filter);
  const { data: counts, refetch: refetchCounts } = useMyListingCounts();
  const current = FILTERS.find((f) => f.key === filter)!;

  return (
    <FlatList
      data={data}
      keyExtractor={(l) => l.id}
      contentContainerStyle={{ padding: 10, paddingBottom: 120 }}
      refreshControl={
        <RefreshControl
          refreshing={isFetching}
          onRefresh={() => {
            refetch();
            refetchCounts();
          }}
        />
      }
      ListHeaderComponent={
        <ChipRow style={{ marginBottom: 10 }}>
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={counts ? `${f.label} (${counts[f.key] ?? 0})` : f.label}
              selected={filter === f.key}
              onPress={() => setFilter(f.key)}
            />
          ))}
        </ChipRow>
      }
      ListEmptyComponent={isFetching ? <Loading /> : <EmptyState icon="sell" title={`No ${current.label.toLowerCase()} listings`} text={current.empty} />}
      renderItem={({ item }) => <ListingCard listing={item} showStatus />}
    />
  );
}

export default MyListings;
