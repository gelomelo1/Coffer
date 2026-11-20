import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import { MAX_REPLY, reasonTagLabels } from "@/src/const/market";
import { useMarketMutation } from "@/src/hooks/market_api";
import { colors, sizes, spacing, typography } from "@/src/theme/theme";
import { Review } from "@/src/types/entities/market";
import { formatDate, marketApi } from "@/src/utils/market_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { listingLabel, userLabel } from "@/src/utils/deleted_labels";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import ReportOverlay from "../ui/report_overlay";
import { SectionCard, StarRating, Tag } from "../ui/retro";
import TextPromptOverlay from "../ui/text_prompt_overlay";

/** One published review. The reviewee (canRespond) may reply once or report it to moderators. */
function ReviewCard({ review, canRespond }: { review: Review; canRespond: boolean }) {
  const { t } = useTranslation();
  const [replyOpen, setReplyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const reply = useMarketMutation((text: string) => marketApi.replyToReview(review.id, text), t("market:review.replyPosted"));

  return (
    <SectionCard accent={review.isFrozen ? colors.accent : undefined}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm }}>
        <StarRating value={review.stars} />
        <Text style={[typography.caption, { color: colors.textMuted }]}>{formatDate(review.publishedAt ?? review.createdAt)}</Text>
      </View>
      <Text style={[typography.meta, { color: colors.text }]}>
        {t("market:review.byline", {
          name: userLabel(review.reviewer, t),
          role: t(`market:review.role.${review.reviewerRole}`),
          listing: listingLabel(review.listingTitle, review.listingDeleted, t),
        })}
      </Text>
      {review.isFrozen || review.reasonTag ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xxs }}>
          {review.isFrozen ? <Tag label={t("market:review.frozen")} color={colors.accent} /> : null}
          {review.reasonTag ? <Tag label={reasonTagLabels[review.reasonTag]} color={colors.danger} /> : null}
        </View>
      ) : null}
      {review.comment ? <CustomText foldable>{review.comment}</CustomText> : null}

      {review.reply ? (
        <View style={{ borderLeftWidth: 4, borderLeftColor: colors.secondary, paddingLeft: spacing.sm, gap: 2 }}>
          <Text style={[typography.label, { color: colors.text }]}>{t("market:review.replyFrom", { name: userLabel(review.reviewee, t) })}</Text>
          <Text style={[typography.body, { color: colors.text }]}>{review.reply}</Text>
        </View>
      ) : null}

      {canRespond && (!review.reply || !review.isFrozen) ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {!review.reply ? (
            <CustomButton
              title={t("market:review.reply")}
              size="sm"
              variant="outline"
              icon={<MaterialIcons name="reply" size={sizes.iconSm} color={colors.text} />}
              onPress={() => setReplyOpen(true)}
            />
          ) : null}
          {!review.isFrozen ? (
            <CustomButton
              title={t("market:review.report")}
              size="sm"
              variant="ghost"
              titleStyle={{ color: colors.danger }}
              icon={<MaterialIcons name="flag" size={sizes.iconSm} color={colors.danger} />}
              onPress={() => setReportOpen(true)}
            />
          ) : null}
        </View>
      ) : null}

      <TextPromptOverlay
        isVisible={replyOpen}
        onClose={() => setReplyOpen(false)}
        title={t("market:review.replyTitle")}
        explanation={t("market:review.replyExplanation")}
        label={t("market:review.replyLabel")}
        submitLabel={t("market:review.replySubmit")}
        minLength={1}
        maxLength={MAX_REPLY}
        loading={reply.isPending}
        onSubmit={(text) => reply.mutate(text, { onSuccess: () => setReplyOpen(false) })}
      />
      <ReportOverlay isVisible={reportOpen} onClose={() => setReportOpen(false)} targetType="review" targetId={review.id} />
    </SectionCard>
  );
}

export default ReviewCard;
