import BarterItemSelectedCard from "@/src/components/collections/tabs/barter/barter_item_selected_card";
import DeleteTradeOverlay from "@/src/components/collections/tabs/barter/delete_trade_overlay";
import NewTradeOverlay from "@/src/components/collections/tabs/barter/new_trade_overlay";
import TradeUserContacts from "@/src/components/collections/tabs/barter/trade_user_contacts";
import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import rootViewStyle from "@/src/components/custom_ui/root_view";
import { endpoints } from "@/src/const/endpoints";
import { ROUTES, pageParams } from "@/src/const/navigation_params";
import { querykeys } from "@/src/const/querykeys";
import { tradeStatusRecord } from "@/src/const/trade_status";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useGetData } from "@/src/hooks/data_hooks";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { useTradeStore } from "@/src/hooks/trade_store";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import { Offer } from "@/src/types/entities/offer";
import { Trade } from "@/src/types/entities/trade";
import { getTradeStatus } from "@/src/utils/data_access_utils";
import AntDesign from "@expo/vector-icons/AntDesign";
import Entypo from "@expo/vector-icons/Entypo";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { navigate } from "expo-router/build/global-state/routing";
import { useState } from "react";
import { FlatList, TouchableOpacity, View } from "react-native";
import { Button, Overlay } from "react-native-elements";

function TradeDetails() {
  const { trade } = useTradeStore();
  const { user } = useUserStore();
  const { setUser } = useOtherUserStore();
  const { collection, collectionType } = useCollectionStore();

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

  const isMyTrade = false; //trade!.userId === user!.id;

  const [isNewTradeOverlayVisible, setIsNewTradeOverlayVisible] =
    useState(false);

  const [
    noActionInfoWarningOverlayVisible,
    setNoActionInfoWarningOverlayVisible,
  ] = useState(false);

  const [isDeleteTradeOverlayVisible, setIsDeleteTradeOveralyVisible] =
    useState(false);

  const handleUserPressed = () => {
    setUser(trade!.user);
    navigate({
      pathname: ROUTES.OTHERUSER,
      params: pageParams.otheruser(trade!.user.name),
    });
  };

  const tradeStatus = getTradeStatus(trade!.offers);
  const tradeStatusDisplay = tradeStatusRecord[tradeStatus];

  const handleEditPress = () => {
    if (tradeStatus !== "open") {
      setNoActionInfoWarningOverlayVisible(true);
    } else {
      setIsNewTradeOverlayVisible(true);
    }
  };

  const handleDeletePress = () => {
    if (tradeStatus !== "open") {
      setNoActionInfoWarningOverlayVisible(true);
    } else {
      setIsDeleteTradeOveralyVisible(true);
    }
  };

  return (
    <>
      <View
        style={[
          rootViewStyle({ color: collectionType.color }),
          { paddingVertical: 10, paddingHorizontal: 0 },
        ]}
      >
        <FlatList
          data={trade!.offers}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{
            width: "100%",
            paddingBottom: 50,
          }}
          renderItem={({ item }) => (
            <View style={{ marginHorizontal: 10 }}>
              <CustomText>{item.id}</CustomText>
            </View>
          )}
          ListHeaderComponent={
            <View style={{ marginHorizontal: 10 }}>
              <CustomText
                style={{
                  fontFamily: "VendSansBold",
                  fontSize: 20,
                  textDecorationLine: "underline",
                  marginBottom: 10,
                }}
                numberOfLines={3}
                ellipsizeMode="tail"
              >
                {trade!.title}
              </CustomText>
              <CustomText
                style={{
                  fontFamily: "VendSansBold",
                  fontSize: 18,
                  marginBottom: 10,
                }}
              >
                {"Status "}{" "}
                <CustomText
                  style={{
                    fontFamily: "VendSansBold",
                    color: tradeStatusDisplay.color,
                    fontSize: 18,
                    marginTop: 20,
                  }}
                >
                  {tradeStatusDisplay.label}
                </CustomText>
              </CustomText>
              {isMyTrade ? (
                tradeStatus !== "traded" ? (
                  <>
                    <CustomButton
                      title={"Edit trade"}
                      containerStyle={{ marginBottom: 10 }}
                      icon={
                        <Entypo
                          name="edit"
                          size={20}
                          color={customTheme.colors.secondary}
                          style={{ marginRight: 5 }}
                        />
                      }
                      onPress={handleEditPress}
                    />
                    <TouchableOpacity
                      style={{ width: "100%", height: 45 }}
                      onPress={handleDeletePress}
                    >
                      <Button
                        title={"Delete trade"}
                        containerStyle={{
                          flex: 1,
                          borderRadius: 0,
                        }}
                        disabled={true}
                        disabledStyle={{
                          flex: 1,
                          backgroundColor: "red",
                          borderRadius: 0,
                        }}
                        disabledTitleStyle={{ color: "white" }}
                        icon={
                          <AntDesign
                            name="delete"
                            size={20}
                            color={"white"}
                            style={{ marginRight: 5 }}
                          />
                        }
                      />
                    </TouchableOpacity>
                  </>
                ) : null
              ) : (
                <TradeUserContacts
                  user={trade!.user}
                  onUserPressed={handleUserPressed}
                />
              )}
              <CustomText
                style={{
                  fontFamily: "VendSansBold",
                  fontSize: 18,
                  marginTop: 20,
                }}
              >
                {"Trade Description"}
              </CustomText>
              <CustomText>{trade!.description}</CustomText>
              <CustomText
                style={{
                  fontFamily: "VendSansBold",
                  fontSize: 18,
                  marginTop: 20,
                }}
              >
                {"Request Description"}
              </CustomText>
              {trade!.wantDescription ? (
                <CustomText>{trade!.wantDescription}</CustomText>
              ) : (
                <CustomText style={{ fontFamily: "VendSansItalic" }}>
                  {isMyTrade
                    ? "You haven't written your request description yet. You can do so now by clicking the 'Edit Trade' button."
                    : "-"}
                </CustomText>
              )}
              <CustomText
                style={{
                  fontFamily: "VendSansBold",
                  fontSize: 18,
                  marginTop: 20,
                }}
              >
                {"Money Request"}
              </CustomText>
              {trade!.wantDescription ? (
                <View
                  style={{
                    justifyContent: "flex-start",
                    alignItems: "center",
                    flexDirection: "row",
                    gap: 5,
                  }}
                >
                  <CustomText>{trade!.moneyRequested}</CustomText>
                  <FontAwesome
                    name="euro"
                    size={20}
                    color={customTheme.colors.primary}
                  />
                </View>
              ) : (
                <CustomText style={{ fontFamily: "VendSansItalic" }}>
                  {isMyTrade
                    ? "You haven't add your money request yet. You can do so now by clicking the 'Edit Trade' button."
                    : "-"}
                </CustomText>
              )}
              <CustomText
                style={{
                  fontFamily: "VendSansBold",
                  fontSize: 18,
                  marginTop: 20,
                }}
              >
                {"Trade items"}
              </CustomText>
              <FlatList
                horizontal
                data={trade!.tradeItems}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <BarterItemSelectedCard
                    collectionType={collectionType}
                    item={item}
                    user={trade!.user}
                  />
                )}
                contentContainerStyle={{ gap: 10 }}
                style={{ marginBottom: 10 }}
              />

              <CustomText
                style={{
                  fontFamily: "VendSansBold",
                  fontSize: 18,
                  marginTop: 20,
                }}
              >
                {isMyTrade
                  ? tradeStatus === "traded"
                    ? "Traded offer"
                    : "Trade offers"
                  : "Your offer"}
              </CustomText>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            <>
              <CustomText
                style={{
                  textAlign: "center",
                  fontFamily: "VendSansItalic",
                  marginTop: 20,
                }}
              >
                {isMyTrade
                  ? "No received offers"
                  : "You haven't made an offer yet"}
              </CustomText>
              {isMyTrade ? null : (
                <CustomButton
                  title={"Make an offer"}
                  containerStyle={{ marginHorizontal: 10 }}
                />
              )}
            </>
          }
        />
      </View>
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
        trade={trade!}
      />

      <Overlay
        overlayStyle={{
          width: "90%",
          backgroundColor: customTheme.colors.background,
        }}
        isVisible={noActionInfoWarningOverlayVisible}
        onBackdropPress={() => setNoActionInfoWarningOverlayVisible(false)}
      >
        <CustomText style={{ textAlign: "center" }}>
          {
            " You can't edit or delete a trade when it's locked because you've accepted an offer that hasn't been completed yet, or one of the parties wants to revert the accepted offer. "
          }
        </CustomText>
      </Overlay>
      <DeleteTradeOverlay
        trade={trade!}
        isDeleteTradeOverlayVisible={{
          value: isDeleteTradeOverlayVisible,
          set: setIsDeleteTradeOveralyVisible,
        }}
      />
    </>
  );
}

export default TradeDetails;
