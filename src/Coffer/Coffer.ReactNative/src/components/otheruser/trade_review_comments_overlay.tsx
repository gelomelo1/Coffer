import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import TradeReivewPack from "@/src/types/entities/trade_review_pack";
import React from "react";
import { FlatList, View } from "react-native";
import { Overlay } from "react-native-elements";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomText from "../custom_ui/custom_text";
import TradeReviewCommentCard from "./trade_review_comment_card";

interface TradeReviewCommentsOverlayProps {
  isTradeReviewCommentsOverlayVisible: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
  tradeReviews: TradeReivewPack[];
  userId: string;
}

function TradeReviewCommentsOverlay({
  isTradeReviewCommentsOverlayVisible,
  tradeReviews,
  userId,
}: TradeReviewCommentsOverlayProps) {
  const { user } = useUserStore();

  return (
    <Overlay
      fullScreen
      overlayStyle={{
        backgroundColor: customTheme.colors.background,
        padding: 0,
        margin: 0,
      }}
      isVisible={isTradeReviewCommentsOverlayVisible.value}
      onBackdropPress={() => isTradeReviewCommentsOverlayVisible.set(false)}
    >
      <SafeAreaView>
        <FlatList
          data={tradeReviews}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={{
            gap: 50,
          }}
          renderItem={({ item }) => (
            <View style={{ marginHorizontal: 10 }}>
              <TradeReviewCommentCard
                tradeReview={item}
                user={user!}
                userId={userId}
                setIsTradeReviewCommentsOverlayVisible={
                  isTradeReviewCommentsOverlayVisible.set
                }
              />
            </View>
          )}
          ListEmptyComponent={
            <CustomText
              style={{ fontFamily: "VendSansItalic", textAlign: "center" }}
            >
              This user does not have reviews
            </CustomText>
          }
        />
      </SafeAreaView>
    </Overlay>
  );
}

export default TradeReviewCommentsOverlay;
