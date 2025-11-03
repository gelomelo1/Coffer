import { ROUTES, pageParams } from "@/src/const/navigation_params";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import TradeReivewPack from "@/src/types/entities/trade_review_pack";
import User from "@/src/types/entities/user";
import {
  getCurrentUserReview,
  getCurrentUserReviewer,
} from "@/src/utils/data_access_utils";
import AntDesign from "@expo/vector-icons/AntDesign";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { navigate } from "expo-router/build/global-state/routing";
import React, { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { Avatar } from "react-native-elements";
import CustomText from "../custom_ui/custom_text";

interface TradeReviewCommentCardProps {
  tradeReview: TradeReivewPack;
  user: User;
  userId: string;
  setIsTradeReviewCommentsOverlayVisible: React.Dispatch<
    React.SetStateAction<boolean>
  >;
}

function TradeReviewCommentCard({
  tradeReview,
  user,
  userId,
  setIsTradeReviewCommentsOverlayVisible,
}: TradeReviewCommentCardProps) {
  const { setUser } = useUserStore();

  console.log(tradeReview);

  const [isExpanded, setIsExpanded] = useState(false);

  const currentUserReview = getCurrentUserReview(tradeReview, userId);
  const otherUserReview = getCurrentUserReviewer(tradeReview, userId);

  console.log(currentUserReview);

  if (otherUserReview === null) return null;

  const handleReviewUserPressed = () => {
    if (otherUserReview.review.reviewerId !== user.id) {
      setUser(user);
      navigate({
        pathname: ROUTES.OTHERUSER,
        params: pageParams.otheruser(user.name),
      });
      setIsTradeReviewCommentsOverlayVisible(false);
    }
  };

  return (
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
            otherUserReview.review.reviewerUser?.avatar
              ? { uri: otherUserReview.review.reviewerUser?.avatar }
              : undefined
          }
          icon={
            otherUserReview.review.reviewerUser?.avatar
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
          {otherUserReview.review.reviewerUser?.name ?? "Deleted user"}
        </CustomText>
        <CustomText>-</CustomText>
        <CustomText style={{ fontFamily: "VendSansItalic" }}>
          {otherUserReview.side}
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
          {otherUserReview.review.rating ? (
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
        <CustomText>{otherUserReview.review.comment}</CustomText>
      </View>
      <CustomText style={{ fontFamily: "VendSansItalic", fontSize: 12 }}>
        {new Date(otherUserReview.review.createdAt).toLocaleDateString()}
      </CustomText>
      {currentUserReview ? (
        <TouchableOpacity
          style={{ justifyContent: "center", alignItems: "center" }}
          onPress={() => setIsExpanded(!isExpanded)}
        >
          <CustomText>
            {currentUserReview.review.reviewerUser
              ? `${currentUserReview.review.reviewerUser.name}'s review`
              : "Deleter user's review"}
          </CustomText>
          {isExpanded ? (
            <MaterialIcons
              name="expand-less"
              size={24}
              color={customTheme.colors.primary}
            />
          ) : (
            <MaterialIcons
              name="expand-more"
              size={24}
              color={customTheme.colors.primary}
            />
          )}
        </TouchableOpacity>
      ) : null}
      {isExpanded && currentUserReview ? (
        <>
          <View
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
              source={
                currentUserReview.review.reviewerUser?.avatar
                  ? { uri: currentUserReview.review.reviewerUser?.avatar }
                  : undefined
              }
              icon={
                currentUserReview.review.reviewerUser?.avatar
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
              {currentUserReview.review.reviewerUser?.name ?? "Deleted user"}
            </CustomText>
            <CustomText>-</CustomText>
            <CustomText style={{ fontFamily: "VendSansItalic" }}>
              {currentUserReview.side}
            </CustomText>
          </View>
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
              {currentUserReview.review.rating ? (
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
            <CustomText>{currentUserReview.review.comment}</CustomText>
          </View>
          <CustomText style={{ fontFamily: "VendSansItalic", fontSize: 12 }}>
            {new Date(currentUserReview.review.createdAt).toLocaleDateString()}
          </CustomText>
        </>
      ) : null}
    </View>
  );
}

export default TradeReviewCommentCard;
