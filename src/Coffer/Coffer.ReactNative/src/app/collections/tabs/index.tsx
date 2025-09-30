import RootView from "@/src/components/custom_ui/root_view";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { Text } from "react-native";

function Home() {
  const { collectionType } = useCollectionStore();

  return (
    <RootView color={collectionType.color}>
      <Text>Home</Text>
    </RootView>
  );
}

export default Home;
