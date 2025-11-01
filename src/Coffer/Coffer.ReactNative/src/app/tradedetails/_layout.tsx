import IndexCollectionCustomLayout from "@/src/components/layout/index_collection_custom_layout";
import { Stack } from "expo-router";

function TradeDetailsLayout() {
  return (
    <Stack screenOptions={({ route }) => IndexCollectionCustomLayout(route)} />
  );
}

export default TradeDetailsLayout;
