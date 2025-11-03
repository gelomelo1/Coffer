import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { emptyTradeReviewRequired } from "@/src/const/emptyTradeReview";
import { endpoints } from "@/src/const/endpoints";
import { languageFilter } from "@/src/const/filter";
import { querykeys } from "@/src/const/querykeys";
import { stringResource } from "@/src/const/resource";
import { useCreateData } from "@/src/hooks/data_hooks";
import { customTheme } from "@/src/theme/theme";
import {
  TradeReview,
  TradeReviewRequired,
} from "@/src/types/entities/trade_review";
import AntDesign from "@expo/vector-icons/AntDesign";
import React, { useRef, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { Overlay } from "react-native-elements";
import { SafeAreaView } from "react-native-safe-area-context";

interface NewReviewOverlayProps {
  isNewReviewOverlayVisible: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
  tradeId: string;
  reviewerId: string;
  revieweeId: string;
}

function NewReviewOverlay({
  isNewReviewOverlayVisible,
  tradeId,
  reviewerId,
  revieweeId,
}: NewReviewOverlayProps) {
  const { mutateAsync: createReview, isPending: isCreateReviewPending } =
    useCreateData<TradeReviewRequired, TradeReview>(
      endpoints.tradeReviews,
      `${querykeys.tradeReviewData}`
    );

  const [draftReview, setDraftReview] = useState<TradeReviewRequired>(
    emptyTradeReviewRequired(tradeId, reviewerId, revieweeId)
  );

  const [commentError, setCommentError] = useState<string | undefined>();
  const commentDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const validateProfanity = (value?: string) =>
    languageFilter.isProfane(value ?? "")
      ? stringResource.profaneError
      : undefined;

  const validateRequired = (value?: string) =>
    !value ? stringResource.requiredError : undefined;

  const getInstantError = (value: string | undefined) =>
    validateRequired(value) || validateProfanity(value);

  const handleCommentChange = (value: string) => {
    setDraftReview((prev) => ({ ...prev, comment: value }));

    if (commentDebounceTimer.current)
      clearTimeout(commentDebounceTimer.current);

    commentDebounceTimer.current = setTimeout(() => {
      setCommentError(getInstantError(value));
    }, 1000);
  };

  const handleOverlayClose = () => {
    if (isCreateReviewPending) return;
    isNewReviewOverlayVisible.set(false);
  };

  const handlePostReviewPress = async () => {
    try {
      await createReview({ value: draftReview });
    } catch (e) {
      console.error(e);
    }
    handleOverlayClose();
  };

  const isPostButtonDisabled =
    !!getInstantError(draftReview.comment) || isCreateReviewPending;

  return (
    <Overlay
      fullScreen
      overlayStyle={{
        backgroundColor: customTheme.colors.background,
      }}
      isVisible={isNewReviewOverlayVisible.value}
      onBackdropPress={handleOverlayClose}
    >
      <SafeAreaView>
        <View
          style={{
            width: "100%",
            justifyContent: "space-evenly",
            alignItems: "center",
            flexDirection: "row",
            marginTop: 50,
            marginBottom: 10,
          }}
        >
          <TouchableOpacity
            style={{
              borderBottomWidth: draftReview.rating ? 2 : 0,
              borderColor: "green",
              justifyContent: "center",
              alignItems: "center",
              flexDirection: "row",
            }}
            onPress={() =>
              setDraftReview((prev) => ({ ...prev, rating: true }))
            }
          >
            <CustomText style={{ color: "green", fontSize: 20 }}>
              Liked
            </CustomText>
            <AntDesign name="arrow-up" size={20} color="green" />
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              borderBottomWidth: !draftReview.rating ? 2 : 0,
              borderColor: "red",
              justifyContent: "center",
              alignItems: "center",
              flexDirection: "row",
            }}
            onPress={() =>
              setDraftReview((prev) => ({ ...prev, rating: false }))
            }
          >
            <CustomText style={{ color: "red", fontSize: 20 }}>
              Disliked
            </CustomText>
            <AntDesign name="arrow-down" size={20} color="red" />
          </TouchableOpacity>
        </View>

        <CustomTextInput
          label="Comment"
          placeholder="Please write down your thoughts on the trade"
          multiline
          value={draftReview.comment}
          onChangeText={handleCommentChange}
          onBlur={() => setCommentError(getInstantError(draftReview.comment))}
          errorMessage={commentError}
          inputStyle={{ height: 200 }}
          containerStyle={{ height: 200 }}
          style={{ marginBottom: 45 }}
        />

        <CustomButton
          title={"Post review"}
          onPress={handlePostReviewPress}
          loading={isCreateReviewPending}
          disabled={isPostButtonDisabled}
        />
      </SafeAreaView>
    </Overlay>
  );
}

export default NewReviewOverlay;
