import CustomText from "@/src/components/custom_ui/custom_text";
import { MAX_REPLY, reasonTagLabels } from "@/src/const/market";
import { useMarketMutation } from "@/src/hooks/market_api";
import { customTheme } from "@/src/theme/theme";
import { Review } from "@/src/types/entities/market";
import { formatDate, marketApi } from "@/src/utils/market_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { SectionCard, StarRating, Tag } from "../ui/retro";
import ReportOverlay from "../ui/report_overlay";
import TextPromptOverlay from "../ui/text_prompt_overlay";

const c = customTheme.colors;

/** One published review. The reviewee (canRespond) may reply once or report it to moderators. */
function ReviewCard({ review, canRespond }: { review: Review; canRespond: boolean }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const reply = useMarketMutation(
    (text: string) => marketApi.replyToReview(review.id, text),
    "Reply posted",
  );

  return (
    <SectionCard accent={review.isFrozen ? c.accent : undefined}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <StarRating value={review.stars} />
        <CustomText style={{ fontSize: 12 }}>{formatDate(review.publishedAt ?? review.createdAt)}</CustomText>
      </View>
      <CustomText style={{ fontSize: 13 }}>
        {review.reviewer?.name ?? "Deleted user"} · as {review.reviewerRole} · {review.listingTitle}
      </CustomText>
      {review.isFrozen ? <Tag label="Under review — not counted" color={c.accent} /> : null}
      {review.reasonTag ? <Tag label={reasonTagLabels[review.reasonTag]} color="red" /> : null}
      {review.comment ? <CustomText foldable>{review.comment}</CustomText> : null}

      {review.reply ? (
        <View style={{ borderLeftWidth: 4, borderLeftColor: c.secondary, paddingLeft: 8, marginTop: 4 }}>
          <CustomText style={{ fontFamily: "VendSansBold", fontSize: 13 }}>Reply from {review.reviewee.name}</CustomText>
          <CustomText>{review.reply}</CustomText>
        </View>
      ) : null}

      {canRespond ? (
        <View style={{ flexDirection: "row", gap: 16, marginTop: 4 }}>
          {!review.reply ? (
            <TouchableOpacity onPress={() => setReplyOpen(true)} style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
              <MaterialIcons name="reply" size={18} color={c.primary} />
              <CustomText style={{ fontFamily: "VendSansBold" }}>Reply</CustomText>
            </TouchableOpacity>
          ) : null}
          {!review.isFrozen ? (
            <TouchableOpacity onPress={() => setReportOpen(true)} style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
              <MaterialIcons name="flag" size={18} color="red" />
              <CustomText style={{ fontFamily: "VendSansBold", color: "red" }}>Report</CustomText>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <TextPromptOverlay
        isVisible={replyOpen}
        onClose={() => setReplyOpen(false)}
        title="Reply to review"
        explanation="You can reply once. Your reply is public and can't be edited."
        placeholder="Your reply…"
        submitLabel="Post reply"
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
