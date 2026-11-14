import { Loading } from "@/src/components/custom_ui/loading";
import { useMyListings } from "@/src/hooks/market_api";
import { FlatList, RefreshControl } from "react-native";
import ListingCard from "../browse/listing_card";
import { EmptyState } from "../ui/retro";

/** MY LISTINGS tab: everything I posted, including reserved, sold and archived ones. */
function MyListings() {
  const { data = [], isFetching, refetch } = useMyListings();
  return (
    <FlatList
      data={data}
      keyExtractor={(l) => l.id}
      contentContainerStyle={{ padding: 10, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
      ListEmptyComponent={
        isFetching ? (
          <Loading />
        ) : (
          <EmptyState icon="sell" title="No listings yet" text="Use “+ Sell / Swap” on the Browse tab to post one." />
        )
      }
      renderItem={({ item }) => <ListingCard listing={item} showStatus />}
    />
  );
}

export default MyListings;
