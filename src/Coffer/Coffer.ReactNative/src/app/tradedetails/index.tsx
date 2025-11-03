import BarterItemSelectedCard from "@/src/components/collections/tabs/barter/barter_item_selected_card";
import BarterNotification from "@/src/components/collections/tabs/barter/barter_notification";
import DeleteTradeOverlay from "@/src/components/collections/tabs/barter/delete_trade_overlay";
import NewOfferOverlay from "@/src/components/collections/tabs/barter/new_offer_overlay";
import NewReviewOverlay from "@/src/components/collections/tabs/barter/new_review_overlay";
import NewTradeOverlay from "@/src/components/collections/tabs/barter/new_trade_overlay";
import OfferCard from "@/src/components/collections/tabs/barter/offer_card";
import TradeUserContacts from "@/src/components/collections/tabs/barter/trade_user_contacts";
import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import rootViewStyle from "@/src/components/custom_ui/root_view";
import { endpoints } from "@/src/const/endpoints";
import { ROUTES, pageParams } from "@/src/const/navigation_params";
import { querykeys } from "@/src/const/querykeys";
import { tradeStatusRecord } from "@/src/const/trade_status";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useGetData, useGetSingleData } from "@/src/hooks/data_hooks";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { useTradeStore } from "@/src/hooks/trade_store";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import { Offer } from "@/src/types/entities/offer";
import { Trade } from "@/src/types/entities/trade";
import TradeReivewPack from "@/src/types/entities/trade_review_pack";
import { OfferStatus } from "@/src/types/helpers/barter_status";
import { getTradeStatus } from "@/src/utils/data_access_utils";
import AntDesign from "@expo/vector-icons/AntDesign";
import Entypo from "@expo/vector-icons/Entypo";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { navigate } from "expo-router/build/global-state/routing";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  View,
} from "react-native";
import { Avatar, Button, Overlay } from "react-native-elements";

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

  const { data: tradeReviewData, isFetching: isTradeReviewFetching } =
    useGetSingleData<TradeReivewPack>(
      endpoints.tradeReviewsTrade,
      querykeys.tradeReviewData,
      trade!.id
    );

  const isMyTrade = trade!.userId === user!.id;

  const [isNewTradeOverlayVisible, setIsNewTradeOverlayVisible] =
    useState(false);

  const [isNewOfferOverlayVisible, setIsNewOfferOverlayVisible] =
    useState(false);

  const [
    noActionInfoWarningOverlayVisible,
    setNoActionInfoWarningOverlayVisible,
  ] = useState(false);

  const [isDeleteTradeOverlayVisible, setIsDeleteTradeOveralyVisible] =
    useState(false);

  const [
    noContactInfoWarningOverlayVisible,
    setNoContactInfoWarningOverlayVisible,
  ] = useState(false);

  const [isNewReviewOverlayVisible, setIsNewReviewOverlayVisible] =
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

  const getOffers = (): Offer[] => {
    if (isMyTrade) {
      if (tradeStatus === "traded") {
        const tradedOffer = trade!.offers.find(
          (offer) => offer.status === "traded"
        );
        return [tradedOffer!];
      } else {
        const sortedOffers = trade!.offers
          .filter((o) => o.status !== "rejected")
          .sort((a, b) => {
            const order: OfferStatus[] = [
              "revertByOfferer",
              "revertByCreator",
              "accepted",
              "pending",
              "traded",
            ];

            return order.indexOf(a.status) - order.indexOf(b.status);
          });
        return sortedOffers;
      }
    } else {
      const myOffer = trade!.offers.find((offer) => offer.userId === user!.id);

      if (myOffer) return [myOffer];

      return [];
    }
  };

  const handleCreateNewOffer = () => {
    if (user!.contacts.length === 0) {
      setNoContactInfoWarningOverlayVisible(true);
    } else {
      setIsNewOfferOverlayVisible(true);
    }
  };

  const handleReviewUserPressed = () => {
    if (isMyTrade) {
      setUser(getOffers()[0]!.user);
      navigate({
        pathname: ROUTES.OTHERUSER,
        params: pageParams.otheruser(getOffers()[0]!.user.name),
      });
    } else {
      setUser(trade!.user);
      navigate({
        pathname: ROUTES.OTHERUSER,
        params: pageParams.otheruser(trade!.user.name),
      });
    }
  };

  useEffect(() => {
    console.log(tradeReviewData?.trader);
  }, [tradeReviewData]);

  return (
    <>
      <View
        style={[
          rootViewStyle({ color: collectionType.color }),
          { paddingVertical: 10, paddingHorizontal: 0 },
        ]}
      >
        <FlatList
          data={getOffers()}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{
            width: "100%",
            paddingBottom: 50,
          }}
          renderItem={({ item }) => (
            <View style={{ marginHorizontal: 10 }}>
              <OfferCard
                trade={trade!}
                offer={item}
                collectionType={collectionType}
                isMyOffer={!isMyTrade}
              />
            </View>
          )}
          ListHeaderComponent={
            <View style={{ marginHorizontal: 10 }}>
              {isMyTrade && tradeStatus === "offerRevertByOfferer" ? (
                <BarterNotification title="The offerer wants to revert an accepted offer. Please decide if you accept the reversion. Go to your offers." />
              ) : null}
              {!isMyTrade && tradeStatus === "offerRevertByCreator" ? (
                <BarterNotification title="The trader wants to revert an accepted offer. Please decide if you accept the reversion. Go to your offer." />
              ) : null}
              {isMyTrade &&
              tradeStatus === "traded" &&
              !isTradeReviewFetching &&
              tradeReviewData?.trader === null ? (
                <BarterNotification title="Please review your experience with the offerer you traded with." />
              ) : null}
              {!isMyTrade &&
              tradeStatus === "traded" &&
              !isTradeReviewFetching &&
              tradeReviewData?.offerer === null ? (
                <BarterNotification title="Please review your experience with the trader you traded with." />
              ) : null}
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
              {trade!.moneyRequested ? (
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
                  onPress={handleCreateNewOffer}
                />
              )}
            </>
          }
          ListFooterComponent={
            <View style={{ paddingHorizontal: 10, marginTop: 20 }}>
              {isTradeReviewFetching ? (
                <ActivityIndicator color={customTheme.colors.primary} />
              ) : !isMyTrade ? (
                <View>
                  {tradeReviewData!.offerer ? (
                    <View
                      style={{
                        width: "100%",
                        backgroundColor: customTheme.colors.secondary,
                        borderWidth: 2,
                        borderColor: customTheme.colors.primary,
                        padding: 10,
                        marginBottom: 10,
                      }}
                    >
                      <CustomText>Your review</CustomText>
                      <View
                        style={{
                          justifyContent: "center",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <View
                          style={{
                            justifyContent: "center",
                            alignItems: "center",
                            flexDirection: "row",
                          }}
                        >
                          {tradeReviewData!.offerer.rating ? (
                            <>
                              <CustomText
                                style={{
                                  fontFamily: "VendSansBold",
                                  color: "green",
                                  fontSize: 20,
                                }}
                              >
                                Liked
                              </CustomText>
                              <AntDesign
                                name="arrow-up"
                                size={20}
                                color="green"
                              />
                            </>
                          ) : (
                            <>
                              <CustomText
                                style={{
                                  fontFamily: "VendSansBold",
                                  color: "red",
                                  fontSize: 20,
                                }}
                              >
                                Disliked
                              </CustomText>
                              <AntDesign
                                name="arrow-up"
                                size={20}
                                color="red"
                              />
                            </>
                          )}
                        </View>
                        <CustomText>
                          {tradeReviewData!.offerer.comment}
                        </CustomText>
                      </View>
                      <CustomText
                        style={{ fontFamily: "VendSansItalic", fontSize: 12 }}
                      >
                        {new Date(
                          tradeReviewData!.offerer.createdAt
                        ).toLocaleDateString()}
                      </CustomText>
                    </View>
                  ) : tradeStatus === "traded" ? (
                    <CustomButton
                      title={"Create a review"}
                      onPress={() => setIsNewReviewOverlayVisible(true)}
                      containerStyle={{ marginBottom: 10 }}
                    />
                  ) : null}
                  {tradeReviewData!.trader ? (
                    <View
                      style={{
                        width: "100%",
                        backgroundColor: customTheme.colors.secondary,
                        borderWidth: 2,
                        borderColor: customTheme.colors.primary,
                        padding: 10,
                      }}
                    >
                      <TouchableOpacity
                        style={{
                          justifyContent: "flex-start",
                          alignItems: "center",
                          flexDirection: "row",
                          gap: 10,
                        }}
                        onPress={handleReviewUserPressed}
                      >
                        <Avatar
                          size={16}
                          rounded
                          source={
                            tradeReviewData!.trader.reviewerUser?.avatar
                              ? {
                                  uri: tradeReviewData!.trader.reviewerUser
                                    ?.avatar,
                                }
                              : undefined
                          }
                          icon={
                            tradeReviewData!.trader.reviewerUser?.avatar
                              ? {
                                  name: "user",
                                  type: "feather",
                                  color: customTheme.colors.secondary,
                                }
                              : undefined
                          }
                          containerStyle={{
                            backgroundColor: customTheme.colors.primary,
                          }}
                        />
                        <CustomText>
                          {tradeReviewData!.trader.reviewerUser?.name ??
                            "Deleted user"}
                        </CustomText>
                        <CustomText>-</CustomText>
                        <CustomText style={{ fontFamily: "VendSansItalic" }}>
                          trader
                        </CustomText>
                      </TouchableOpacity>
                      <View
                        style={{
                          justifyContent: "center",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <View
                          style={{
                            justifyContent: "center",
                            alignItems: "center",
                            flexDirection: "row",
                          }}
                        >
                          {tradeReviewData!.trader.rating ? (
                            <>
                              <CustomText
                                style={{
                                  fontFamily: "VendSansBold",
                                  color: "green",
                                  fontSize: 20,
                                }}
                              >
                                Liked
                              </CustomText>
                              <AntDesign
                                name="arrow-up"
                                size={20}
                                color="green"
                              />
                            </>
                          ) : (
                            <>
                              <CustomText
                                style={{
                                  fontFamily: "VendSansBold",
                                  color: "red",
                                  fontSize: 20,
                                }}
                              >
                                Disliked
                              </CustomText>
                              <AntDesign
                                name="arrow-up"
                                size={20}
                                color="red"
                              />
                            </>
                          )}
                        </View>
                        <CustomText>
                          {tradeReviewData!.trader.comment}
                        </CustomText>
                      </View>
                      <CustomText
                        style={{ fontFamily: "VendSansItalic", fontSize: 12 }}
                      >
                        {new Date(
                          tradeReviewData!.trader.createdAt
                        ).toLocaleDateString()}
                      </CustomText>
                    </View>
                  ) : null}
                </View>
              ) : (
                <View>
                  {tradeReviewData!.trader ? (
                    <View
                      style={{
                        width: "100%",
                        backgroundColor: customTheme.colors.secondary,
                        borderWidth: 2,
                        borderColor: customTheme.colors.primary,
                        padding: 10,
                        marginBottom: 10,
                      }}
                    >
                      <CustomText>Your review</CustomText>
                      <View
                        style={{
                          justifyContent: "center",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <View
                          style={{
                            justifyContent: "center",
                            alignItems: "center",
                            flexDirection: "row",
                          }}
                        >
                          {tradeReviewData!.trader.rating ? (
                            <>
                              <CustomText
                                style={{
                                  fontFamily: "VendSansBold",
                                  color: "green",
                                  fontSize: 20,
                                }}
                              >
                                Liked
                              </CustomText>
                              <AntDesign
                                name="arrow-up"
                                size={20}
                                color="green"
                              />
                            </>
                          ) : (
                            <>
                              <CustomText
                                style={{
                                  fontFamily: "VendSansBold",
                                  color: "red",
                                  fontSize: 20,
                                }}
                              >
                                Disliked
                              </CustomText>
                              <AntDesign
                                name="arrow-up"
                                size={20}
                                color="red"
                              />
                            </>
                          )}
                        </View>
                        <CustomText>
                          {tradeReviewData!.trader.comment}
                        </CustomText>
                      </View>
                      <CustomText
                        style={{ fontFamily: "VendSansItalic", fontSize: 12 }}
                      >
                        {new Date(
                          tradeReviewData!.trader.createdAt
                        ).toLocaleDateString()}
                      </CustomText>
                    </View>
                  ) : tradeStatus === "traded" ? (
                    <CustomButton
                      title={"Create a review"}
                      onPress={() => setIsNewReviewOverlayVisible(true)}
                      containerStyle={{ marginBottom: 10 }}
                    />
                  ) : null}
                  {tradeReviewData!.offerer ? (
                    <View
                      style={{
                        width: "100%",
                        backgroundColor: customTheme.colors.secondary,
                        borderWidth: 2,
                        borderColor: customTheme.colors.primary,
                        padding: 10,
                      }}
                    >
                      <TouchableOpacity
                        style={{
                          justifyContent: "flex-start",
                          alignItems: "center",
                          flexDirection: "row",
                          gap: 10,
                        }}
                        onPress={handleReviewUserPressed}
                      >
                        <Avatar
                          size={16}
                          rounded
                          source={
                            tradeReviewData!.offerer.reviewerUser?.avatar
                              ? {
                                  uri: tradeReviewData!.offerer.reviewerUser
                                    ?.avatar,
                                }
                              : undefined
                          }
                          icon={
                            tradeReviewData!.offerer.reviewerUser?.avatar
                              ? {
                                  name: "user",
                                  type: "feather",
                                  color: customTheme.colors.secondary,
                                }
                              : undefined
                          }
                          containerStyle={{
                            backgroundColor: customTheme.colors.primary,
                          }}
                        />
                        <CustomText>
                          {tradeReviewData!.offerer.reviewerUser?.name ??
                            "Deleted user"}
                        </CustomText>
                        <CustomText>-</CustomText>
                        <CustomText style={{ fontFamily: "VendSansItalic" }}>
                          offerer
                        </CustomText>
                      </TouchableOpacity>
                      <View
                        style={{
                          justifyContent: "center",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <View
                          style={{
                            justifyContent: "center",
                            alignItems: "center",
                            flexDirection: "row",
                          }}
                        >
                          {tradeReviewData!.offerer.rating ? (
                            <>
                              <CustomText
                                style={{
                                  fontFamily: "VendSansBold",
                                  color: "green",
                                  fontSize: 20,
                                }}
                              >
                                Liked
                              </CustomText>
                              <AntDesign
                                name="arrow-up"
                                size={20}
                                color="green"
                              />
                            </>
                          ) : (
                            <>
                              <CustomText
                                style={{
                                  fontFamily: "VendSansBold",
                                  color: "red",
                                  fontSize: 20,
                                }}
                              >
                                Disliked
                              </CustomText>
                              <AntDesign
                                name="arrow-up"
                                size={20}
                                color="red"
                              />
                            </>
                          )}
                        </View>
                        <CustomText>
                          {tradeReviewData!.offerer.comment}
                        </CustomText>
                      </View>
                      <CustomText
                        style={{ fontFamily: "VendSansItalic", fontSize: 12 }}
                      >
                        {new Date(
                          tradeReviewData!.offerer.createdAt
                        ).toLocaleDateString()}
                      </CustomText>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
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
      <NewOfferOverlay
        isNewOfferOverlayVisible={{
          value: isNewOfferOverlayVisible,
          set: setIsNewOfferOverlayVisible,
        }}
        user={user!}
        collection={collection}
        collectionType={collectionType}
        trades={myTradesData}
        offers={myOffersData}
        isTradesFetching={isMyTradesFetching}
        isOffersFetching={isMyOffersFetching}
        trade={trade!}
        offer={undefined}
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
          You can’t make an offer because you haven’t added any contact info. Go
          to Settings and create at least one contact so others can reach you.
        </CustomText>
      </Overlay>
      {tradeStatus === "traded" && getOffers().length >= 1 ? (
        <NewReviewOverlay
          isNewReviewOverlayVisible={{
            value: isNewReviewOverlayVisible,
            set: setIsNewReviewOverlayVisible,
          }}
          tradeId={trade!.id}
          reviewerId={isMyTrade ? trade!.userId : getOffers()[0]!.userId}
          revieweeId={isMyTrade ? getOffers()[0]!.userId : trade!.userId}
        />
      ) : null}
    </>
  );
}

export default TradeDetails;
