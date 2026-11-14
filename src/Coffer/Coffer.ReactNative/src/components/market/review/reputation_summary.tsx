import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import CustomText from "@/src/components/custom_ui/custom_text";
import { Loading } from "@/src/components/custom_ui/loading";
import { useReputation, useUserReviews } from "@/src/hooks/market_api";
import { customTheme } from "@/src/theme/theme";
import { formatResponseTime } from "@/src/utils/market_api";
import { useState } from "react";
import { FlatList, TouchableOpacity, View } from "react-native";
import { EmptyState, StarRating } from "../ui/retro";
import ReviewCard from "./review_card";

/** "★ 4.5 (12) · 8 deals · replies within 2 hours" — tap to open the reviews. */
function ReputationSummary({ userId, userName, isMe = false }: { userId: string; userName?: string; isMe?: boolean }) {
  const [open, setOpen] = useState(false);
  const { data: reputation } = useReputation(userId);
  const { data: reviews = [], isFetching } = useUserReviews(userId, open);

  const response = formatResponseTime(reputation?.typicalResponseMinutes);

  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} style={{ gap: 2 }} accessibilityLabel="Show reviews">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <StarRating value={reputation?.average ?? 0} size={16} />
          <CustomText style={{ fontSize: 14, fontFamily: "VendSansBold" }}>
            {reputation?.average != null ? reputation.average.toFixed(1) : "No ratings"}
            {reputation?.count ? ` (${reputation.count})` : ""}
          </CustomText>
        </View>
        <CustomText style={{ fontSize: 12, color: customTheme.colors.primary }}>
          {reputation?.completedDeals ?? 0} completed deals
          {reputation?.responseRate != null ? ` · answers ${Math.round(reputation.responseRate * 100)}% of chats` : ""}
          {response ? `, usually ${response}` : ""}
        </CustomText>
      </TouchableOpacity>

      <CustomOverlay isVisible={open} onClose={() => setOpen(false)} overlayTitle={`Reviews${userName ? ` of ${userName}` : ""}`}>
        {isFetching && reviews.length === 0 ? (
          <Loading />
        ) : (
          <FlatList
            data={reviews}
            keyExtractor={(r) => r.id}
            contentContainerStyle={{ padding: 12 }}
            ListHeaderComponent={
              <CustomText style={{ fontSize: 13, marginBottom: 10 }}>
                Verified reviews only: just the buyer and seller of a deal completed with a PIN handover or a tracked
                shipment (or closed as disputed) can review each other. Reviews appear when both sides have reviewed,
                or after 14 days.
              </CustomText>
            }
            ListEmptyComponent={<EmptyState icon="star-border" title="No reviews yet" />}
            renderItem={({ item }) => <ReviewCard review={item} canRespond={isMe} />}
          />
        )}
      </CustomOverlay>
    </>
  );
}

export default ReputationSummary;
