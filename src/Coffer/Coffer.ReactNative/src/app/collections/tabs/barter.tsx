import rootViewStyle from "@/src/components/custom_ui/root_view";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { Text, View } from "react-native";

function Barter() {
  const { collectionType } = useCollectionStore();

  return (
    <View style={rootViewStyle({ color: collectionType.color })}>
      <Text>Barter</Text>
    </View>
  );
}

export default Barter;
