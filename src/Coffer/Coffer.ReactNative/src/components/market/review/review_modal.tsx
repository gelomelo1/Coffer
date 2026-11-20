import { SectionHeader } from "@/src/components/custom_ui/card";
import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { Loading } from "@/src/components/custom_ui/loading";
import { MAX_REVIEW_COMMENT, MIN_LOW_RATING_COMMENT, reasonTagLabels, starLabel } from "@/src/const/market";
import { useDealReviews, useMarketMutation } from "@/src/hooks/market_api";
import { colors, sizes, spacing, typography } from "@/src/theme/theme";
import { Deal, ReviewInput, ReviewReasonTag } from "@/src/types/entities/market";
import { daysLeft, formatDate, marketApi } from "@/src/utils/market_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { userLabel } from "@/src/utils/deleted_labels";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { Chip, ChipRow, ErrorText, SectionCard, StarRating } from "../ui/retro";
import ReviewCard from "./review_card";

/**
 * Double-blind review: your review stays hidden from the other person until they review you too, or 14 days pass.
 * 1–2 stars require a reason and at least 20 characters of explanation.
 */
function ReviewModal({ isVisible, onClose, deal }: { isVisible: boolean; onClose: () => void; deal: Deal }) {
  const { t } = useTranslation();
  const { data, isFetching } = useDealReviews(isVisible ? deal.id : null);
  const [stars, setStars] = useState(0);
  const [reason, setReason] = useState<ReviewReasonTag | null>(null);
  const [comment, setComment] = useState("");
  const submit = useMarketMutation((input: ReviewInput) => marketApi.submitReview(deal.id, input), t("market:review.submitted"));

  useEffect(() => {
    if (isVisible) {
      setStars(0);
      setReason(null);
      setComment("");
    }
  }, [isVisible]);

  const other = deal.myRole === "buyer" ? deal.seller : deal.buyer;
  const otherName = userLabel(other, t);
  const low = stars > 0 && stars <= 2;
  const trimmed = comment.trim().length;
  const error =
    stars === 0
      ? t("market:review.errorStars")
      : low && !reason
        ? t("market:review.errorReason")
        : low && trimmed < MIN_LOW_RATING_COMMENT
          ? t("market:review.errorLength", { min: MIN_LOW_RATING_COMMENT, length: trimmed })
          : null;
  const left = daysLeft(data?.deadline ?? deal.reviewDeadline);

  return (
    <CustomOverlay
      isVisible={isVisible}
      onClose={onClose}
      overlayTitle={t("market:review.title", { name: otherName })}
      footerContent={
        data?.canReview ? (
          <CustomButton
            title={t("market:review.submit")}
            disabled={!!error || submit.isPending}
            loading={submit.isPending}
            onPress={() => submit.mutate({ stars, reasonTag: low ? reason : null, comment: comment.trim() || null })}
          />
        ) : undefined
      }
    >
      {isFetching && !data ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
          <SectionCard>
            <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
              <MaterialIcons name="visibility-off" size={sizes.iconMd} color={colors.text} />
              <Text style={[typography.meta, { color: colors.text, flex: 1 }]}>
                {left != null
                  ? t("market:review.blindNoteDays", { name: otherName, count: left })
                  : t("market:review.blindNote", { name: otherName })}
              </Text>
            </View>
          </SectionCard>

          {data?.mine ? (
            <>
              <SectionHeader title={t("market:review.yours")} />
              <ReviewCard review={data.mine} canRespond={false} />
              {!data.mine.publishedAt ? (
                <Text style={[typography.meta, { color: colors.textMuted }]}>
                  {t("market:review.hiddenUntil", { name: otherName, date: formatDate(data.deadline) })}
                </Text>
              ) : null}
            </>
          ) : null}

          {data?.theirs ? (
            <>
              <SectionHeader title={t("market:review.theirs", { name: otherName })} />
              <ReviewCard review={data.theirs} canRespond />
            </>
          ) : data?.theyHaveSubmitted ? (
            <Text style={[typography.bodyStrong, { color: colors.text }]}>{t("market:review.theySubmitted", { name: otherName })}</Text>
          ) : null}

          {data?.canReview ? (
            <>
              <SectionHeader title={t("market:review.howWasIt")} />
              <View style={{ alignItems: "center", gap: spacing.xxs }}>
                <StarRating value={stars} onChange={setStars} size={36} />
                <Text accessibilityLiveRegion="polite" style={[typography.bodyStrong, { color: colors.text, minHeight: 24 }]}>
                  {starLabel(stars)}
                </Text>
              </View>
              {low ? (
                <>
                  <SectionHeader title={t("market:review.whatWentWrong")} />
                  <ChipRow>
                    {(Object.keys(reasonTagLabels) as ReviewReasonTag[]).map((tag) => (
                      <Chip key={tag} label={reasonTagLabels[tag]} selected={reason === tag} onPress={() => setReason(tag)} />
                    ))}
                  </ChipRow>
                </>
              ) : null}
              <CustomTextInput
                label={low ? t("market:review.explainRequired") : t("market:review.commentOptional")}
                required={low}
                value={comment}
                onChangeText={setComment}
                multiline
                maxLength={MAX_REVIEW_COMMENT}
                containerStyle={{ maxHeight: 220 }}
              />
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {t("market:prompt.count", { length: trimmed, max: MAX_REVIEW_COMMENT })}
              </Text>
              <ErrorText>{error}</ErrorText>
            </>
          ) : !data?.mine ? (
            <Text style={[typography.body, { color: colors.text }]}>{t("market:review.closed")}</Text>
          ) : null}
        </ScrollView>
      )}
    </CustomOverlay>
  );
}

export default ReviewModal;
