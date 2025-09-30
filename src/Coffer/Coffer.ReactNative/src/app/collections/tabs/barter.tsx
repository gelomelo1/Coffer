import RootView from "@/src/components/custom_ui/root_view";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { Text } from "react-native";

function Barter() {
  const { collectionType } = useCollectionStore();

  return (
    <RootView color={collectionType.color}>
      <Text>Barter</Text>
    </RootView>
  );
}

export default Barter;
