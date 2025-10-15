import FeedList from "@/src/components/collections/tabs/home/feed_list";
import rootViewStyle from "@/src/components/custom_ui/root_view";
import { useCollectionStore } from "@/src/hooks/collection_store";
import React from "react";
import { View } from "react-native";

function Home() {
  const { collectionType } = useCollectionStore();

  return (
    <View
      style={[
        rootViewStyle({ color: collectionType.color }),
        { flex: 1, padding: 0 },
      ]}
    >
      <FeedList />
    </View>
  );
}

export default Home;
