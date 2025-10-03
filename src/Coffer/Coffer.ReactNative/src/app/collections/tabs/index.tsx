import rootViewStyle from "@/src/components/custom_ui/root_view";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { Text, View } from "react-native";

function Home() {
  const { collectionType } = useCollectionStore();

  return (
    <View style={rootViewStyle({ color: collectionType.color })}>
      <Text>Home</Text>
    </View>
  );
}

export default Home;
