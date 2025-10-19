import CustomText from "@/src/components/custom_ui/custom_text";
import { customTheme } from "@/src/theme/theme";
import ItemTagSearch from "@/src/types/entities/item_tags_search";
import { useState } from "react";
import { FlatList, TouchableOpacity, View } from "react-native";
import { Overlay } from "react-native-elements";
import { SafeAreaView } from "react-native-safe-area-context";
import FeedSearchItemCard from "./feed_seach_item_card";

interface FeedSearchItemTagCardProps {
  itemTagsSearch: ItemTagSearch;
}

function FeedSearchItemTagCard({ itemTagsSearch }: FeedSearchItemTagCardProps) {
  const [isItemTagsOverlayOpen, setIsItemTagsOverlayOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={{
          height: 48,
          justifyContent: "flex-start",
          alignItems: "center",
          flexDirection: "row",
          gap: 10,
        }}
        onPress={() => setIsItemTagsOverlayOpen(true)}
      >
        <CustomText style={{ fontFamily: "VendSansBold", fontSize: 32 }}>
          #
        </CustomText>
        <CustomText style={{ fontFamily: "VendSansBold" }}>
          {itemTagsSearch.value}
        </CustomText>
      </TouchableOpacity>
      <Overlay
        fullScreen
        overlayStyle={{
          backgroundColor: customTheme.colors.background,
        }}
        isVisible={isItemTagsOverlayOpen}
        onBackdropPress={() => setIsItemTagsOverlayOpen(false)}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <FlatList
            data={itemTagsSearch.foundItems}
            keyExtractor={(item) => item.item.id.toString()}
            renderItem={({ item }) => <FeedSearchItemCard itemSearch={item} />}
            ListHeaderComponent={
              <View
                style={{
                  width: "100%",
                  backgroundColor: customTheme.colors.background,
                }}
              >
                <CustomText
                  style={{ fontSize: 18, marginBottom: 5 }}
                >{`found ${itemTagsSearch.foundItems.length}`}</CustomText>
              </View>
            }
            stickyHeaderIndices={[0]}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            ListFooterComponent={
              <CustomText
                style={{
                  textAlign: "center",
                  fontFamily: "VendSansItalic",
                  marginTop: 20,
                }}
              >
                End of results
              </CustomText>
            }
          />
        </SafeAreaView>
      </Overlay>
    </>
  );
}

export default FeedSearchItemTagCard;
