import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { querykeys } from "@/src/const/querykeys";
import { tradeStatusRecord } from "@/src/const/trade_status";
import { useGetSingleData } from "@/src/hooks/data_hooks";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { useTradeStore } from "@/src/hooks/trade_store";
import { customTheme } from "@/src/theme/theme";
import CollectionType from "@/src/types/entities/collectiontype";
import { Trade } from "@/src/types/entities/trade";
import TradeReivewPack from "@/src/types/entities/trade_review_pack";
import { getTradeStatus } from "@/src/utils/data_access_utils";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { navigate } from "expo-router/build/global-state/routing";
import { TouchableOpacity, View } from "react-native";
import { Avatar } from "react-native-elements";
import BarterMozaicGallery from "./barter_mozaic_gallery";

interface TradeCardProps {
  trade: Trade;
  collectiontType: CollectionType;
  isMyTrade: boolean;
}

function TradeCard({ trade, collectiontType, isMyTrade }: TradeCardProps) {
  const { setTrade } = useTradeStore();
  const { setUser } = useOtherUserStore();

  const { data: tradeReviewData, isFetching: isTradeReviewFetching } =
    useGetSingleData<TradeReivewPack>(
      endpoints.tradeReviewsTrade,
      querykeys.tradeReviewData,
      trade!.id
    );

  const handleTradeTitlePress = () => {
    setTrade(trade);
    navigate({
      pathname: ROUTES.TRADEDETAILS,
      params: pageParams.tradeDetails(
        isMyTrade ? "My trade" : `${trade.user.name}'s trade`
      ),
    });
  };

  const handleUserPress = () => {
    setUser(trade.user);
    navigate({
      pathname: ROUTES.OTHERUSER,
      params: pageParams.otheruser(trade.user.name),
    });
  };

  const tradeStatus = getTradeStatus(trade.offers);
  const tradeStatusDisplay = tradeStatusRecord[tradeStatus];

  return (
    <View style={{ width: "100%", alignItems: "flex-start" }}>
      {(!isMyTrade &&
        tradeStatus === "traded" &&
        !isTradeReviewFetching &&
        tradeReviewData?.offerer === null) ||
      (isMyTrade && tradeStatus === "offerRevertByOfferer") ||
      (!isMyTrade && tradeStatus === "offerRevertByCreator") ||
      (isMyTrade &&
        tradeStatus === "traded" &&
        !isTradeReviewFetching &&
        tradeReviewData?.trader === null) ? (
        <MaterialIcons
          name="report-gmailerrorred"
          size={24}
          color="red"
          style={{ position: "absolute", bottom: 0, right: 0 }}
        />
      ) : null}
      <BarterMozaicGallery
        collectionType={collectiontType}
        items={trade.tradeItems}
      />
      <TouchableOpacity onPress={handleTradeTitlePress}>
        <CustomText
          style={{
            fontFamily: "VendSansBold",
            fontSize: 20,
            textDecorationLine: "underline",
          }}
          numberOfLines={3}
          ellipsizeMode="tail"
        >
          {trade.title}
        </CustomText>
      </TouchableOpacity>
      {isMyTrade ? null : (
        <TouchableOpacity
          onPress={handleUserPress}
          style={{
            justifyContent: "flex-start",
            alignItems: "center",
            flexDirection: "row",
            gap: 10,
          }}
        >
          <Avatar
            size={16}
            rounded
            source={trade.user?.avatar ? { uri: trade.user.avatar } : undefined}
            icon={
              !trade.user?.avatar
                ? {
                    name: "user",
                    type: "feather",
                    color: customTheme.colors.secondary,
                  }
                : undefined
            }
            containerStyle={{ backgroundColor: customTheme.colors.primary }}
          />
          <CustomText>{trade.user.name}</CustomText>
        </TouchableOpacity>
      )}
      <CustomText>
        Status:{" "}
        <CustomText style={{ color: tradeStatusDisplay.color }}>
          {tradeStatusDisplay.label}
        </CustomText>
      </CustomText>
      <CustomText>
        Created At: {new Date(trade.createdAt).toLocaleDateString()}
      </CustomText>
    </View>
  );
}

export default TradeCard;
