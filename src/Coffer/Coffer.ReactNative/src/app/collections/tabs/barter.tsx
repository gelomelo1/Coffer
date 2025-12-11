import MyOffers from "@/src/components/collections/tabs/barter/myoffers";
import MyTrades from "@/src/components/collections/tabs/barter/mytrades";
import Trades from "@/src/components/collections/tabs/barter/trades";
import CustomText from "@/src/components/custom_ui/custom_text";
import rootViewStyle from "@/src/components/custom_ui/root_view";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useGetData } from "@/src/hooks/data_hooks";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import { Offer } from "@/src/types/entities/offer";
import { Trade } from "@/src/types/entities/trade";
import { useState } from "react";
import { SafeAreaView, ScrollView, TouchableOpacity, View } from "react-native";
import { Divider } from "react-native-elements";

function Barter() {
  const { user } = useUserStore();
  const { collectionType } = useCollectionStore();

  const [selectedTabIndex, setSelectedTabIndex] = useState(0);

  const { data: myTradesData = [], isFetching: isMyTradesFetching } =
    useGetData<Trade>(endpoints.trades, querykeys.myTradesData, {
      filters: [
        {
          filter: "Match",
          field: "userId",
          value: user!.id,
        },
      ],
    });

  const { data: myOffersData = [], isFetching: isMyOffersFetching } =
    useGetData<Offer>(endpoints.offers, querykeys.myOffersData, {
      filters: [
        {
          filter: "Match",
          field: "userId",
          value: user!.id,
        },
      ],
    });

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
              justifyContent: "center",
              minWidth: "100%",
            }}
          >
            {["TRADES", "MY TRADES", "MY OFFERS"].map((title, i) => (
              <TouchableOpacity
                key={title}
                onPress={() => setSelectedTabIndex(i)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderBottomWidth: selectedTabIndex === i ? 3 : 0,
                  borderBottomColor: customTheme.colors.secondary,
                  marginRight: 16,
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
          </ScrollView>
        </View>
        <Divider width={2} color={customTheme.colors.primary} />
        <View style={{ paddingVertical: 10 }}>
          {selectedTabIndex === 0 ? (
            <Trades />
          ) : selectedTabIndex === 1 ? (
            <MyTrades
              myTradesData={myTradesData}
              isMyTradesFetching={isMyTradesFetching}
              myOffersData={myOffersData}
              isMyOffersFetching={isMyOffersFetching}
            />
          ) : (
            <MyOffers
              myOffersData={myOffersData}
              isMyOffersFetching={isMyOffersFetching}
            />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

export default Barter;
