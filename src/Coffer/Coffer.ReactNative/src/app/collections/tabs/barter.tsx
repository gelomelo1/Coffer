import History from "@/src/components/collections/tabs/barter/history";
import MyOffers from "@/src/components/collections/tabs/barter/myoffers";
import MySales from "@/src/components/collections/tabs/barter/mysales";
import Sales from "@/src/components/collections/tabs/barter/sales";
import CustomText from "@/src/components/custom_ui/custom_text";
import rootViewStyle from "@/src/components/custom_ui/root_view";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { customTheme } from "@/src/theme/theme";
import { useState } from "react";
import { SafeAreaView, ScrollView, TouchableOpacity, View } from "react-native";
import { Divider } from "react-native-elements";

function Barter() {
  const { collectionType } = useCollectionStore();

  const [selectedTabIndex, setSelectedTabIndex] = useState(0);

  return (
    <View
      style={[
        rootViewStyle({ color: collectionType.color }),
        { flex: 1, padding: 0 },
      ]}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ height: 40 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 10,
            }}
          >
            <View style={{ flexDirection: "row" }}>
              {["SALES", "MY SALES", "MY OFFERS", "HISTORY"].map((title, i) => (
                <TouchableOpacity
                  key={title}
                  onPress={() => setSelectedTabIndex(i)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderBottomWidth: selectedTabIndex === i ? 3 : 0,
                    borderBottomColor: customTheme.colors.secondary,
                    marginRight: 16, // space evenly between tabs
                  }}
                >
                  <CustomText
                    style={{
                      fontFamily: "VendSansBold",
                      color:
                        selectedTabIndex === i
                          ? customTheme.colors.secondary
                          : customTheme.colors.primary,
                      fontSize: 14,
                      textAlign: "center",
                    }}
                  >
                    {title}
                  </CustomText>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
        <Divider width={2} color={customTheme.colors.primary} />
        <View style={{ padding: 10 }}>
          {selectedTabIndex === 0 ? (
            <Sales />
          ) : selectedTabIndex === 1 ? (
            <MySales />
          ) : selectedTabIndex === 2 ? (
            <MyOffers />
          ) : (
            <History />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

export default Barter;
