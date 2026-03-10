import ItemRegisterActionButton from "@/src/components/itemregister/item_register_action_button";
import IndexCollectionCustomLayout from "@/src/components/layout/index_collection_custom_layout";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { Stack } from "expo-router";
import { PaperProvider } from "react-native-paper";

function MyCollectionLayout() {
  const { collectionType, collection } = useCollectionStore();

  return (
    <PaperProvider>
      <Stack
        screenOptions={({ route }) => IndexCollectionCustomLayout(route)}
      />
      <ItemRegisterActionButton
        collectionType={collectionType!}
        collection={collection!}
      />
    </PaperProvider>
  );
}

export default MyCollectionLayout;
