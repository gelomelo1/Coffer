import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useGetData } from "@/src/hooks/data_hooks";
import { customTheme } from "@/src/theme/theme";
import TradeReivewPack from "@/src/types/entities/trade_review_pack";
import { getTradeReviewsRating } from "@/src/utils/data_access_utils";
import AntDesign from "@expo/vector-icons/AntDesign";
import { useEffect, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import CustomText from "../custom_ui/custom_text";
import TradeReviewCommentsOverlay from "./trade_review_comments_overlay";

interface TradeReviewsRatingProps {
  userId: string;
}

function TradeReviewsRating({ userId }: TradeReviewsRatingProps) {
  const { data: userReviewsData = [], isFetching } =
    useGetData<TradeReivewPack>(
      `${endpoints.tradeReviewsUser}/${userId}`,
      `${querykeys.userReviewsData}/${userId}`,
    );

  useEffect(() => {
    console.log(userReviewsData);
  }, [userReviewsData]);

  const likes = getTradeReviewsRating("like", userReviewsData, userId);
  const dislikes = getTradeReviewsRating("dislike", userReviewsData, userId);

  const [
    isTradeReviewCommentsOverlayVisible,
    setIsTradeReviewCommentsOverlayVisible,
  ] = useState(false);

  return isFetching ? (
    <ActivityIndicator
      color={customTheme.colors.primary}
      style={{ marginTop: 10 }}
    />
  ) : (
    <>
      <TouchableOpacity
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "row",
          gap: 10,
          marginTop: 10,
        }}
        onPress={() => setIsTradeReviewCommentsOverlayVisible(true)}
      >
        <CustomText>Reviews:</CustomText>
        <View
          style={{
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "row",
          }}
        >
          <CustomText style={{ color: "green" }} concatNumber={true}>
            {likes}
          </CustomText>
          <AntDesign name="arrow-up" size={16} color="green" />
        </View>
        <View
          style={{
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "row",
          }}
        >
          <CustomText style={{ color: "red" }} concatNumber={true}>
            {dislikes}
          </CustomText>
          <AntDesign name="arrow-down" size={16} color="red" />
        </View>
      </TouchableOpacity>
      <TradeReviewCommentsOverlay
        isTradeReviewCommentsOverlayVisible={{
          value: isTradeReviewCommentsOverlayVisible,
          set: setIsTradeReviewCommentsOverlayVisible,
        }}
        tradeReviews={userReviewsData}
        userId={userId}
      />
    </>
  );
}

export default TradeReviewsRating;
