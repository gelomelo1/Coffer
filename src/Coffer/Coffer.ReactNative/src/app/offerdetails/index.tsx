import BarterItemSelectedCard from "@/src/components/collections/tabs/barter/barter_item_selected_card";
import BarterNotification from "@/src/components/collections/tabs/barter/barter_notification";
import DeleteOfferOverlay from "@/src/components/collections/tabs/barter/delete_offer_overlay";
import NewOfferOverlay from "@/src/components/collections/tabs/barter/new_offer_overlay";
import NewReviewOverlay from "@/src/components/collections/tabs/barter/new_review_overlay";
import TradeUserContacts from "@/src/components/collections/tabs/barter/trade_user_contacts";
import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import rootViewStyle from "@/src/components/custom_ui/root_view";
import { endpoints } from "@/src/const/endpoints";
import { ROUTES, pageParams } from "@/src/const/navigation_params";
import { querykeys } from "@/src/const/querykeys";
import { offerStatusRecord } from "@/src/const/trade_status";
import { useCollectionStore } from "@/src/hooks/collection_store";
import {
  useCreateData,
  useGetData,
  useGetSingleData,
} from "@/src/hooks/data_hooks";
import { useOfferStore } from "@/src/hooks/offer_store";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { useTradeStore } from "@/src/hooks/trade_store";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import { Offer } from "@/src/types/entities/offer";
import { Trade } from "@/src/types/entities/trade";
import TradeReivewPack from "@/src/types/entities/trade_review_pack";
import { getTradeStatus } from "@/src/utils/data_access_utils";
import AntDesign from "@expo/vector-icons/AntDesign";
import Entypo from "@expo/vector-icons/Entypo";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { navigate } from "expo-router/build/global-state/routing";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { Avatar, Button, Overlay } from "react-native-elements";

function OfferDetails() {
  const { offer, setOffer } = useOfferStore();
  const { trade, setTrade } = useTradeStore();
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

  const isMyOffer = offer!.userId === user!.id;

  const { mutateAsync: changeStatus, isPending } = useCreateData<
    { status: string },
    Offer
  >(
    `${endpoints.offersChangeStatus}/${offer!.id}`,
    isMyOffer
      ? `${querykeys.myOffersData};${querykeys.tradesData}`
      : querykeys.myTradesData,
    "Status changed successfully",
    "Failed to change status",
  );

  const { refetch } = useGetSingleData<Trade>(
    endpoints.trades,
    querykeys.tradeData,
    trade!.id,
    undefined,
    undefined,
    { enabled: false, queryKey: [querykeys.tradeData] },
  );

  const { data: tradeReviewData, isFetching: isTradeReviewFetching } =
    useGetSingleData<TradeReivewPack>(
      endpoints.tradeReviewsTrade,
      querykeys.tradeReviewData,
      trade!.id,
    );

  const [isNewOfferOverlayVisible, setIsNewOfferOverlayVisible] =
    useState(false);

  const [
    noActionInfoWarningOverlayVisible,
    setNoActionInfoWarningOverlayVisible,
  ] = useState(false);

  const [isDeleteOfferOverlayVisible, setIsDeleteOfferOveralyVisible] =
    useState(false);

  const [
    isConfirmAcceptOfferOverlayVisible,
    setIsConfirmAcceptOfferOverlayVisible,
  ] = useState(false);

  const [
    isConfirmTradeOfferOverlayVisible,
    setIsConfirmTradeOfferOverlayVisible,
  ] = useState(false);

  const [isNewReviewOverlayVisible, setIsNewReviewOverlayVisible] =
    useState(false);

  const handleTradePressed = () => {
    navigate({
      pathname: ROUTES.TRADEDETAILS,
      params: pageParams.tradeDetails(`${trade!.user.name}'s trade`),
    });
  };

  const handleUserPressed = () => {
    setUser(trade!.user);
    navigate({
      pathname: ROUTES.OTHERUSER,
      params: pageParams.otheruser(trade!.user.name),
    });
  };

  const handleReviewUserPressed = () => {
    if (isMyOffer) {
      setUser(trade!.user);
      navigate({
        pathname: ROUTES.OTHERUSER,
        params: pageParams.otheruser(trade!.user.name),
      });
    } else {
      setUser(offer!.user);
      navigate({
        pathname: ROUTES.OTHERUSER,
        params: pageParams.otheruser(offer!.user.name),
      });
    }
  };

  const offerStatus = offerStatusRecord[offer!.status];

  const tradeStatus = getTradeStatus(trade!.offers);

  const handleEditPress = () => {
    if (offer!.status === "pending" || offer!.status === "rejected") {
      setIsNewOfferOverlayVisible(true);
    } else {
      setNoActionInfoWarningOverlayVisible(true);
    }
  };

  const handleDeletePress = () => {
    if (offer!.status === "pending" || offer!.status === "rejected") {
      setIsDeleteOfferOveralyVisible(true);
    } else {
      setNoActionInfoWarningOverlayVisible(true);
    }
  };

  const handleRejectOffer = async () => {
    try {
      const response = await changeStatus({ value: { status: "rejected" } });
      setOffer(response);
      const updatedTrade = (await refetch()).data;
      if (updatedTrade) {
        setTrade(updatedTrade);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAcceptOffer = async () => {
    try {
      const response = await changeStatus({ value: { status: "accepted" } });
      setOffer(response);
      const updatedTrade = (await refetch()).data;
      if (updatedTrade) {
        setTrade(updatedTrade);
      }
    } catch (e) {
      console.error(e);
    }
    setIsConfirmAcceptOfferOverlayVisible(false);
  };

  const handleRevertOffer = async (decision: "accept" | "reject") => {
    try {
      const response = await changeStatus({
        value: { status: decision === "accept" ? "pending" : "accepted" },
      });
      setOffer(response);
      const updatedTrade = (await refetch()).data;
      if (updatedTrade) {
        setTrade(updatedTrade);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMakeReversion = async (reversor: "creator" | "offerer") => {
    try {
      const response = await changeStatus({
        value: {
          status:
            reversor === "creator" ? "revertByCreator" : "revertByOfferer",
        },
      });
      setOffer(response);
      const updatedTrade = (await refetch()).data;
      if (updatedTrade) {
        setTrade(updatedTrade);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTradeOffer = async () => {
    try {
      const response = await changeStatus({
        value: { status: "traded" },
      });
      setOffer(response);
      const updatedTrade = (await refetch()).data;
      if (updatedTrade) {
        setTrade(updatedTrade);
      }
    } catch (e) {
      console.error(e);
    }

    setIsConfirmTradeOfferOverlayVisible(false);
  };

  return (
    <>
      <ScrollView
        style={[
          rootViewStyle({ color: collectionType!.color }),
          { paddingVertical: 10, paddingHorizontal: 10 },
        ]}
      >
        {!isMyOffer && tradeStatus === "offerRevertByOfferer" ? (
          <BarterNotification title="The offerer wants to revert an accepted offer. Please decide if you accept the reversion. Go to your offers." />
        ) : null}
        {isMyOffer && tradeStatus === "offerRevertByCreator" ? (
          <BarterNotification title="The trader wants to revert an accepted offer. Please decide if you accept the reversion. Go to your offer." />
        ) : null}
        {!isMyOffer &&
        tradeStatus === "traded" &&
        !isTradeReviewFetching &&
        tradeReviewData?.trader === null ? (
          <BarterNotification title="Please review your experience with the offerer you traded with." />
        ) : null}
        {isMyOffer &&
        tradeStatus === "traded" &&
        !isTradeReviewFetching &&
        tradeReviewData?.offerer === null ? (
          <BarterNotification title="Please review your experience with the trader you traded with." />
        ) : null}
        {isMyOffer ? (
          <>
            <CustomText style={{ fontSize: 20 }}>Belong to trade:</CustomText>
            <TouchableOpacity onPress={handleTradePressed}>
              <CustomText
                style={{
                  fontFamily: "VendSansBold",
                }}
                numberOfLines={3}
                ellipsizeMode="tail"
              >
                {trade!.title}
              </CustomText>
            </TouchableOpacity>
          </>
        ) : null}

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
              color: offerStatus.color,
              fontSize: 18,
              marginTop: 20,
            }}
          >
            {offerStatus.label}
          </CustomText>
        </CustomText>
        {isMyOffer ? (
          offer!.status !== "traded" ? (
            <>
              <CustomButton
                title={"Edit offer"}
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
                  title={"Delete offer"}
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
            user={offer!.user}
            onUserPressed={handleUserPressed}
            isOffer={true}
          />
        )}
        <CustomText
          style={{
            fontFamily: "VendSansBold",
            fontSize: 18,
            marginTop: 20,
          }}
        >
          {"Money Offer"}
        </CustomText>
        {offer!.moneyOffer ? (
          <View
            style={{
              justifyContent: "flex-start",
              alignItems: "center",
              flexDirection: "row",
              gap: 5,
            }}
          >
            <CustomText>{offer!.moneyOffer}</CustomText>
            <FontAwesome
              name="euro"
              size={20}
              color={customTheme.colors.primary}
            />
          </View>
        ) : (
          <CustomText style={{ fontFamily: "VendSansItalic" }}>
            {isMyOffer
              ? "You haven't add a money offer. You can do so now by clicking the 'Edit Offer' button."
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
          {"Item offer"}
        </CustomText>
        <FlatList
          horizontal
          data={offer!.offerItems}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <BarterItemSelectedCard
              collectionType={collectionType!}
              item={item}
              user={offer!.user}
            />
          )}
          contentContainerStyle={{ gap: 10 }}
          style={{ marginBottom: 10 }}
        />

        {isMyOffer ? (
          offer!.status === "accepted" ? (
            <>
              <CustomButton
                title={"Finish trade"}
                icon={
                  <FontAwesome
                    name="exchange"
                    size={24}
                    color={customTheme.colors.secondary}
                    style={{ marginRight: 5 }}
                  />
                }
                onPress={() => setIsConfirmTradeOfferOverlayVisible(true)}
              />
              <CustomButton
                title={"Ask for reversion"}
                onPress={() => handleMakeReversion("offerer")}
                containerStyle={{ marginTop: 10 }}
              />
            </>
          ) : offer!.status === "revertByCreator" ? (
            <View style={{ justifyContent: "center", flexDirection: "row" }}>
              <TouchableOpacity
                style={{ width: "50%", height: 45 }}
                onPress={() => handleRevertOffer("accept")}
              >
                <Button
                  title={"Accept offer reversion"}
                  containerStyle={{
                    flex: 1,
                    borderRadius: 0,
                  }}
                  disabled={true}
                  disabledStyle={{
                    flex: 1,
                    backgroundColor: "green",
                    borderRadius: 0,
                  }}
                  disabledTitleStyle={{ color: "white" }}
                  icon={
                    <AntDesign
                      name="check"
                      size={20}
                      color={"white"}
                      style={{ marginRight: 5 }}
                    />
                  }
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={{ width: "50%", height: 45 }}
                onPress={() => handleRevertOffer("reject")}
              >
                <Button
                  title={"Reject offer reversion"}
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
                      name="close"
                      size={20}
                      color={"white"}
                      style={{ marginRight: 5 }}
                    />
                  }
                />
              </TouchableOpacity>
            </View>
          ) : null
        ) : offer!.status === "pending" && tradeStatus === "open" ? (
          <View style={{ justifyContent: "center", flexDirection: "row" }}>
            <TouchableOpacity
              style={{ width: "50%", height: 45 }}
              onPress={() => setIsConfirmAcceptOfferOverlayVisible(true)}
            >
              <Button
                title={"Accept offer"}
                containerStyle={{
                  flex: 1,
                  borderRadius: 0,
                }}
                disabled={true}
                disabledStyle={{
                  flex: 1,
                  backgroundColor: "green",
                  borderRadius: 0,
                }}
                disabledTitleStyle={{ color: "white" }}
                icon={
                  <AntDesign
                    name="check"
                    size={20}
                    color={"white"}
                    style={{ marginRight: 5 }}
                  />
                }
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={{ width: "50%", height: 45 }}
              onPress={handleRejectOffer}
            >
              <Button
                title={"Reject offer"}
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
                    name="close"
                    size={20}
                    color={"white"}
                    style={{ marginRight: 5 }}
                  />
                }
              />
            </TouchableOpacity>
          </View>
        ) : offer!.status === "revertByOfferer" ? (
          <View style={{ justifyContent: "center", flexDirection: "row" }}>
            <TouchableOpacity
              style={{ width: "50%", height: 45 }}
              onPress={() => handleRevertOffer("accept")}
            >
              <Button
                title={"Accept offer reversion"}
                containerStyle={{
                  flex: 1,
                  borderRadius: 0,
                }}
                disabled={true}
                disabledStyle={{
                  flex: 1,
                  backgroundColor: "green",
                  borderRadius: 0,
                }}
                disabledTitleStyle={{ color: "white" }}
                icon={
                  <AntDesign
                    name="check"
                    size={20}
                    color={"white"}
                    style={{ marginRight: 5 }}
                  />
                }
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={{ width: "50%", height: 45 }}
              onPress={() => handleRevertOffer("reject")}
            >
              <Button
                title={"Reject offer reversion"}
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
                    name="close"
                    size={20}
                    color={"white"}
                    style={{ marginRight: 5 }}
                  />
                }
              />
            </TouchableOpacity>
          </View>
        ) : offer!.status === "accepted" ? (
          <>
            <CustomButton
              title={"Finish trade"}
              icon={
                <FontAwesome
                  name="exchange"
                  size={24}
                  color={customTheme.colors.secondary}
                  style={{ marginRight: 5 }}
                />
              }
              onPress={() => setIsConfirmTradeOfferOverlayVisible(true)}
            />
            <CustomButton
              title={"Ask for reversion"}
              onPress={() => handleMakeReversion("creator")}
              containerStyle={{ marginTop: 10 }}
            />
          </>
        ) : null}
        {isTradeReviewFetching ? (
          <ActivityIndicator color={customTheme.colors.primary} />
        ) : isMyOffer ? (
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
                        <AntDesign name="arrow-up" size={20} color="green" />
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
                        <AntDesign name="arrow-up" size={20} color="red" />
                      </>
                    )}
                  </View>
                  <CustomText>{tradeReviewData!.offerer.comment}</CustomText>
                </View>
                <CustomText
                  style={{ fontFamily: "VendSansItalic", fontSize: 12 }}
                >
                  {new Date(
                    tradeReviewData!.offerer.createdAt,
                  ).toLocaleDateString()}
                </CustomText>
              </View>
            ) : offer!.status === "traded" ? (
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
                        ? { uri: tradeReviewData!.trader.reviewerUser?.avatar }
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
                        <AntDesign name="arrow-up" size={20} color="green" />
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
                        <AntDesign name="arrow-up" size={20} color="red" />
                      </>
                    )}
                  </View>
                  <CustomText>{tradeReviewData!.trader.comment}</CustomText>
                </View>
                <CustomText
                  style={{ fontFamily: "VendSansItalic", fontSize: 12 }}
                >
                  {new Date(
                    tradeReviewData!.trader.createdAt,
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
                        <AntDesign name="arrow-up" size={20} color="green" />
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
                        <AntDesign name="arrow-up" size={20} color="red" />
                      </>
                    )}
                  </View>
                  <CustomText>{tradeReviewData!.trader.comment}</CustomText>
                </View>
                <CustomText
                  style={{ fontFamily: "VendSansItalic", fontSize: 12 }}
                >
                  {new Date(
                    tradeReviewData!.trader.createdAt,
                  ).toLocaleDateString()}
                </CustomText>
              </View>
            ) : offer!.status === "traded" ? (
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
                        ? { uri: tradeReviewData!.offerer.reviewerUser?.avatar }
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
                        <AntDesign name="arrow-up" size={20} color="green" />
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
                        <AntDesign name="arrow-up" size={20} color="red" />
                      </>
                    )}
                  </View>
                  <CustomText>{tradeReviewData!.offerer.comment}</CustomText>
                </View>
                <CustomText
                  style={{ fontFamily: "VendSansItalic", fontSize: 12 }}
                >
                  {new Date(
                    tradeReviewData!.offerer.createdAt,
                  ).toLocaleDateString()}
                </CustomText>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
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
            " You can't edit or delete an offer when it's locked because your offer is accepted, or one of the parties wants to revert the accepted offer. "
          }
        </CustomText>
      </Overlay>
      <DeleteOfferOverlay
        offer={offer!}
        isDeleteOfferOverlayVisible={{
          value: isDeleteOfferOverlayVisible,
          set: setIsDeleteOfferOveralyVisible,
        }}
      />
      <NewOfferOverlay
        isNewOfferOverlayVisible={{
          value: isNewOfferOverlayVisible,
          set: setIsNewOfferOverlayVisible,
        }}
        user={user!}
        collection={collection!}
        collectionType={collectionType!}
        trades={myTradesData}
        offers={myOffersData}
        isTradesFetching={isMyTradesFetching}
        isOffersFetching={isMyOffersFetching}
        trade={trade!}
        offer={offer!}
      />
      <Overlay
        overlayStyle={{
          width: "90%",
          backgroundColor: customTheme.colors.background,
        }}
        isVisible={isConfirmAcceptOfferOverlayVisible}
        onBackdropPress={() => {
          if (isPending) return;
          setIsConfirmAcceptOfferOverlayVisible(false);
        }}
      >
        <CustomText style={{ textAlign: "center" }}>
          {" "}
          Are you sure you want to accept this offer? It can only be reversed if
          the offerer also agrees.
        </CustomText>
        <CustomButton title={"Accept offer"} onPress={handleAcceptOffer} />
      </Overlay>
      <Overlay
        overlayStyle={{
          width: "90%",
          backgroundColor: customTheme.colors.background,
        }}
        isVisible={isConfirmTradeOfferOverlayVisible}
        onBackdropPress={() => {
          if (isPending) return;
          setIsConfirmTradeOfferOverlayVisible(false);
        }}
      >
        <CustomText style={{ textAlign: "center" }}>
          {isMyOffer
            ? "Are you sure you want to finish the trade with this offer? Once a trade is finished, the offer is archived — you can’t edit it."
            : "Are you sure you want to finish the trade with this offer? Once a trade is finished, it’s archived — you can’t edit it, and users can’t make new offers."}
        </CustomText>
        <CustomButton title={"Accept offer"} onPress={handleTradeOffer} />
      </Overlay>
      <NewReviewOverlay
        isNewReviewOverlayVisible={{
          value: isNewReviewOverlayVisible,
          set: setIsNewReviewOverlayVisible,
        }}
        tradeId={trade!.id}
        reviewerId={isMyOffer ? offer!.userId : trade!.userId}
        revieweeId={isMyOffer ? trade!.userId : offer!.userId}
      />
    </>
  );
}

export default OfferDetails;
