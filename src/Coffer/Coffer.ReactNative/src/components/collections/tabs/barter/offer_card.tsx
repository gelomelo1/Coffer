import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { ROUTES, pageParams } from "@/src/const/navigation_params";
import { querykeys } from "@/src/const/querykeys";
import { offerStatusRecord } from "@/src/const/trade_status";
import { useCreateData, useGetSingleData } from "@/src/hooks/data_hooks";
import { useOfferStore } from "@/src/hooks/offer_store";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { useTradeStore } from "@/src/hooks/trade_store";
import { customTheme } from "@/src/theme/theme";
import CollectionType from "@/src/types/entities/collectiontype";
import { Offer } from "@/src/types/entities/offer";
import { Trade } from "@/src/types/entities/trade";
import { getTradeStatus } from "@/src/utils/data_access_utils";
import AntDesign from "@expo/vector-icons/AntDesign";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { navigate } from "expo-router/build/global-state/routing";
import { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { Avatar, Button, Overlay } from "react-native-elements";
import BarterMozaicGallery from "./barter_mozaic_gallery";

interface OfferCardProps {
  trade: Trade;
  offer: Offer;
  collectionType: CollectionType;
  isMyOffer: boolean;
}

function OfferCard({
  trade,
  offer,
  collectionType,
  isMyOffer,
}: OfferCardProps) {
  const { setOffer } = useOfferStore();
  const { setTrade } = useTradeStore();
  const { setUser } = useOtherUserStore();

  const { mutateAsync: changeStatus, isPending } = useCreateData<
    { status: string },
    Offer
  >(
    `${endpoints.offersChangeStatus}/${offer.id}`,
    isMyOffer
      ? `${querykeys.myOffersData};${querykeys.tradesData}`
      : querykeys.myTradesData,
    "Status changed successfully",
    "Failed to change status"
  );

  const { refetch } = useGetSingleData<Trade>(
    endpoints.trades,
    querykeys.tradeData,
    trade.id,
    undefined,
    undefined,
    { enabled: false, queryKey: [querykeys.tradeData] }
  );

  const [
    isConfirmAcceptOfferOverlayVisible,
    setIsConfirmAcceptOfferOverlayVisible,
  ] = useState(false);

  const [
    isConfirmTradeOfferOverlayVisible,
    setIsConfirmTradeOfferOverlayVisible,
  ] = useState(false);

  const handleOfferDetailsPress = () => {
    setOffer(offer);
    navigate({
      pathname: ROUTES.OFFERDETAILS,
      params: pageParams.offerDetails(
        isMyOffer ? "My offer" : `${offer.user.name}'s offer`
      ),
    });
  };

  const handleUserPress = () => {
    setUser(offer.user);
    navigate({
      pathname: ROUTES.OTHERUSER,
      params: pageParams.otheruser(offer.user.name),
    });
  };

  const handleRejectOffer = async () => {
    try {
      await changeStatus({ value: { status: "rejected" } });
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
      await changeStatus({ value: { status: "accepted" } });
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
      await changeStatus({
        value: { status: decision === "accept" ? "pending" : "accepted" },
      });
      const updatedTrade = (await refetch()).data;
      if (updatedTrade) {
        setTrade(updatedTrade);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMakeReversion = async () => {
    try {
      await changeStatus({
        value: { status: "revertByCreator" },
      });
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
      await changeStatus({
        value: { status: "traded" },
      });
      const updatedTrade = (await refetch()).data;
      if (updatedTrade) {
        setTrade(updatedTrade);
      }
    } catch (e) {
      console.error(e);
    }

    setIsConfirmTradeOfferOverlayVisible(false);
  };

  const offerStatus = offerStatusRecord[offer.status];

  const tradeStatus = getTradeStatus(trade.offers);

  return (
    <View
      style={{
        width: "100%",
        alignItems: "flex-start",
        borderBottomWidth: 2,
        borderBottomColor: customTheme.colors.primary,
        borderRadius: 10,
      }}
    >
      {!isMyOffer ? (
        <TouchableOpacity
          style={{
            justifyContent: "flex-start",
            alignItems: "center",
            flexDirection: "row",
            gap: 10,
          }}
          onPress={handleUserPress}
        >
          <Avatar
            size={20}
            rounded
            source={offer.user?.avatar ? { uri: offer.user.avatar } : undefined}
            icon={
              !offer.user?.avatar
                ? {
                    name: "user",
                    type: "feather",
                    color: customTheme.colors.secondary,
                  }
                : undefined
            }
            containerStyle={{ backgroundColor: customTheme.colors.primary }}
          />
          <CustomText
            style={{
              fontFamily: "VendSansBold",
              fontSize: 20,
              textDecorationLine: "underline",
            }}
          >
            {`${offer.user.name}'s offer`}
          </CustomText>
        </TouchableOpacity>
      ) : null}
      <BarterMozaicGallery
        collectionType={collectionType}
        items={offer.offerItems}
      />
      {offer.moneyOffer ? (
        <View
          style={{
            width: "100%",
            backgroundColor: customTheme.colors.primary,
            borderRadius: 50,
            marginTop: 10,
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "row",
            gap: 5,
          }}
        >
          <CustomText
            style={{
              fontFamily: "VendSansBold",
              color: customTheme.colors.secondary,
            }}
          >
            {offer.moneyOffer}
          </CustomText>
          <FontAwesome
            name="euro"
            size={16}
            color={customTheme.colors.secondary}
          />
        </View>
      ) : null}
      <CustomText>
        Status:{" "}
        <CustomText style={{ color: offerStatus.color }}>
          {offerStatus.label}
        </CustomText>
      </CustomText>
      <CustomText>
        Created At: {new Date(offer.createdAt).toLocaleDateString()}
      </CustomText>
      {isMyOffer ? null : offer.status === "pending" &&
        tradeStatus === "open" ? (
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
      ) : offer.status === "revertByOfferer" ? (
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
      ) : offer.status === "accepted" ? (
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
            onPress={handleMakeReversion}
            containerStyle={{ marginTop: 10 }}
          />
        </>
      ) : null}
      <TouchableOpacity
        style={{ width: "100%" }}
        onPress={handleOfferDetailsPress}
      >
        <CustomText
          style={{
            textAlign: "center",
            color: customTheme.colors.secondary,
            fontSize: 24,
            textDecorationLine: "underline",
          }}
        >
          Details
        </CustomText>
      </TouchableOpacity>
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
          {" "}
          Are you sure you want to finish the trade with this offer? Once a
          trade is finished, it’s archived — you can’t edit it, and users can’t
          make new offers.
        </CustomText>
        <CustomButton title={"Accept offer"} onPress={handleTradeOffer} />
      </Overlay>
    </View>
  );
}

export default OfferCard;
