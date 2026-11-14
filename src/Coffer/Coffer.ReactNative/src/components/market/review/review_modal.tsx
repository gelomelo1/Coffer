import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import CustomText from "@/src/components/custom_ui/custom_text";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { Loading } from "@/src/components/custom_ui/loading";
import {
  MAX_REVIEW_COMMENT,
  MIN_LOW_RATING_COMMENT,
  reasonTagLabels,
  starLabels,
} from "@/src/const/market";
import { useDealReviews, useMarketMutation } from "@/src/hooks/market_api";
import { customTheme } from "@/src/theme/theme";
import { Deal, ReviewInput, ReviewReasonTag } from "@/src/types/entities/market";
import { daysLeft, formatDate, marketApi } from "@/src/utils/market_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Chip, ChipRow, ErrorText, Label, SectionCard, StarRating } from "../ui/retro";
import ReviewCard from "./review_card";

const c = customTheme.colors;

/**
 * Double-blind review: your review stays hidden from the other person until they review you too, or 14 days pass.
 * 1–2 stars require a reason and at least 20 characters of explanation.
 */
function ReviewModal({ isVisible, onClose, deal }: { isVisible: boolean; onClose: () => void; deal: Deal }) {
  const { data, isFetching } = useDealReviews(isVisible ? deal.id : null);
  const [stars, setStars] = useState(0);
  const [reason, setReason] = useState<ReviewReasonTag | null>(null);
  const [comment, setComment] = useState("");
  const submit = useMarketMutation((input: ReviewInput) => marketApi.submitReview(deal.id, input), "Review submitted");

  useEffect(() => {
    if (isVisible) {
      setStars(0);
      setReason(null);
      setComment("");
    }
  }, [isVisible]);

  const other = deal.myRole === "buyer" ? deal.seller : deal.buyer;
  const low = stars > 0 && stars <= 2;
  const trimmed = comment.trim().length;
  const error =
    stars === 0
      ? "Tap the stars to rate."
      : low && !reason
        ? "Pick what went wrong."
        : low && trimmed < MIN_LOW_RATING_COMMENT
          ? `Explain in at least ${MIN_LOW_RATING_COMMENT} characters (${trimmed}/${MIN_LOW_RATING_COMMENT}).`
          : null;
  const left = daysLeft(data?.deadline ?? deal.reviewDeadline);

  return (
    <CustomOverlay
      isVisible={isVisible}
      onClose={onClose}
      overlayTitle={`Review ${other.name}`}
      footerContent={
        data?.canReview ? (
          <View style={{ width: "90%" }}>
            <CustomButton
              title="Submit review"
              disabled={!!error || submit.isPending}
              loading={submit.isPending}
              onPress={() =>
                submit.mutate({ stars, reasonTag: low ? reason : null, comment: comment.trim() || null })
              }
            />
          </View>
        ) : undefined
      }
    >
      {isFetching && !data ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }} keyboardShouldPersistTaps="handled">
          <SectionCard>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <MaterialIcons name="visibility-off" size={22} color={c.primary} />
              <CustomText style={{ flex: 1, fontSize: 14 }}>
                Double-blind: your review stays hidden until {other.name} reviews you too, or the window closes
                {left != null ? ` in ${left} day${left === 1 ? "" : "s"}` : ""}. Reviews can&apos;t be edited later.
              </CustomText>
            </View>
          </SectionCard>

          {data?.mine ? (
            <>
              <Label>Your review</Label>
              <ReviewCard review={data.mine} canRespond={false} />
              {!data.mine.publishedAt ? (
                <CustomText style={{ fontSize: 13 }}>
                  Hidden until {other.name} reviews you or until {formatDate(data.deadline)}.
                </CustomText>
              ) : null}
            </>
          ) : null}

          {data?.theirs ? (
            <>
              <Label>{other.name}&apos;s review of you</Label>
              <ReviewCard review={data.theirs} canRespond />
            </>
          ) : data?.theyHaveSubmitted ? (
            <CustomText style={{ fontSize: 14, fontFamily: "VendSansBold" }}>
              {other.name} already reviewed you — submit yours to see it.
            </CustomText>
          ) : null}

          {data?.canReview ? (
            <>
              <Label>How was the deal?</Label>
              <View style={{ alignItems: "center", gap: 4 }}>
                <StarRating value={stars} onChange={setStars} size={36} />
                <CustomText style={{ fontFamily: "VendSansBold" }}>{starLabels[stars] || " "}</CustomText>
              </View>
              {low ? (
                <>
                  <Label>What went wrong?</Label>
                  <ChipRow>
                    {(Object.keys(reasonTagLabels) as ReviewReasonTag[]).map((tag) => (
                      <Chip key={tag} label={reasonTagLabels[tag]} selected={reason === tag} onPress={() => setReason(tag)} />
                    ))}
                  </ChipRow>
                </>
              ) : null}
              <CustomTextInput
                label={low ? "Explain what happened (required)" : "Comment (optional)"}
                value={comment}
                onChangeText={setComment}
                multiline
                maxLength={MAX_REVIEW_COMMENT}
                containerStyle={{ maxHeight: 200 }}
              />
              <CustomText style={{ fontSize: 13 }}>
                {trimmed}/{MAX_REVIEW_COMMENT}
              </CustomText>
              <ErrorText>{error}</ErrorText>
            </>
          ) : !data?.mine ? (
            <CustomText>The review window for this deal is closed.</CustomText>
          ) : null}
        </ScrollView>
      )}
    </CustomOverlay>
  );
}

export default ReviewModal;
