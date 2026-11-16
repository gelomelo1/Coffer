import FeedList from "@/src/components/collections/tabs/home/feed_list";
import { colors } from "@/src/theme/theme";
import React from "react";
import { View } from "react-native";

function Home() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FeedList />
    </View>
  );
}

export default Home;
