import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import { Loading } from "@/src/components/custom_ui/loading";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import { Offer } from "@/src/types/entities/offer";
import { Trade } from "@/src/types/entities/trade";
import { useState } from "react";
import { FlatList, View } from "react-native";
import { Icon, Overlay } from "react-native-elements";
import NewTradeOverlay from "./new_trade_overlay";
import TradeCard from "./trade_card";

interface MyTradesProps {
  myTradesData: Trade[];
  isMyTradesFetching: boolean;
  myOffersData: Offer[];
  isMyOffersFetching: boolean;
}

function MyTrades({
  myTradesData,
  isMyTradesFetching,
  myOffersData,
  isMyOffersFetching,
}: MyTradesProps) {
  const { user } = useUserStore();
  const { collection, collectionType } = useCollectionStore();

  const [isNewTradeOverlayVisible, setIsNewTradeOverlayVisible] =
    useState(false);

  const [
    noContactInfoWarningOverlayVisible,
    setNoContactInfoWarningOverlayVisible,
  ] = useState(false);

  const handleCreateNewTradePress = () => {
    if (user!.contacts.length === 0)
      setNoContactInfoWarningOverlayVisible(true);
    else setIsNewTradeOverlayVisible(true);
  };

  return (
    <View style={{ width: "100%" }}>
      <CustomButton
        title={"Create new trade"}
        containerStyle={{ marginBottom: 20 }}
        icon={
          <Icon name="add" color={customTheme.colors.secondary} size={32} />
        }
        onPress={handleCreateNewTradePress}
      />
      <FlatList
        data={myTradesData}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => <TradeCard trade={item} />}
        ListHeaderComponent={
          <>
            <View
              style={{
                width: "100%",
                backgroundColor: customTheme.colors.background,
              }}
            >
              <CustomText
                style={{ fontSize: 18, marginBottom: 5 }}
              >{`${myTradesData.length} active trades`}</CustomText>
            </View>
            {isMyTradesFetching ? <Loading /> : null}
          </>
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
      <NewTradeOverlay
        isNewTradeOverlayVisible={{
          value: isNewTradeOverlayVisible,
          set: setIsNewTradeOverlayVisible,
        }}
        user={user!}
        collection={collection}
        collectionType={collectionType}
        trades={myTradesData}
        offers={myOffersData}
        isTradesFetching={isMyTradesFetching}
        isOffersFetching={isMyOffersFetching}
      />
      <Overlay
        overlayStyle={{
          width: "90%",
          backgroundColor: customTheme.colors.background,
        }}
        isVisible={noContactInfoWarningOverlayVisible}
        onBackdropPress={() => setNoContactInfoWarningOverlayVisible(false)}
      >
        <CustomText style={{ textAlign: "center" }}>
          {" "}
          You can’t open a trade because you haven’t added any contact info. Go
          to Settings and create at least one contact so others can reach you.
        </CustomText>
      </Overlay>
    </View>
  );
}

export default MyTrades;
