import FeedList from "@/src/components/collections/tabs/home/feed_list";
import rootViewStyle from "@/src/components/custom_ui/root_view";
import React from "react";
import { View } from "react-native";

function Home() {
  return (
    <View style={[rootViewStyle(), { flex: 1, padding: 0 }]}>
      <FeedList />
    </View>
  );
}

export default Home;
