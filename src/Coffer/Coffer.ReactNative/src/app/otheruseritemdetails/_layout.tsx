import IndexCollectionCustomLayout from "@/src/components/layout/index_collection_custom_layout";
import { Stack } from "expo-router";

function OtherUserItemDetailsLayout() {
  return (
    <Stack screenOptions={({ route }) => IndexCollectionCustomLayout(route)} />
  );
}

export default OtherUserItemDetailsLayout;
