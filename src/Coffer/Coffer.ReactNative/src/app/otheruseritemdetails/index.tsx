import FeedLike from "@/src/components/collections/tabs/home/feed_like";
import FeedRarity from "@/src/components/collections/tabs/home/feed_rarity";
import CommentSection from "@/src/components/comments/comment_section";
import CustomButton from "@/src/components/custom_ui/custom_button";
import { ItemAttributeList, ItemHero, ItemStats, ItemTags, ItemTextBlock } from "@/src/components/itemdetails/item_details_view";
import ReportOverlay from "@/src/components/market/ui/report_overlay";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { useUserStore } from "@/src/hooks/user_store";
import { colors, spacing } from "@/src/theme/theme";
import { ItemProvided } from "@/src/types/entities/item";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { navigate } from "expo-router/build/global-state/routing";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";

/** Someone else's item: details, like / rate, comments, report. */
function OtherUserItemDetails() {
  const { t } = useTranslation();
  const { collectionType } = useCollectionStore();
  const { user: currentUser } = useUserStore();
  const { user, collection, item, setItem } = useOtherUserStore();
  const [isReporting, setIsReporting] = useState(false);
  const isMine = currentUser?.id === collection?.userId;

  const goToCollection = () => {
    navigate({ pathname: ROUTES.OTHERUSERCOLLECTION, params: pageParams.otherusercollection(user!.name, collection!.name) });
  };

  const onItemUpdate = (updated: ItemProvided) => setItem(updated);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xxl * 2 }}>
      <CustomButton
        title={t("items:details.openCollection", { user: user?.name ?? "", collection: collection?.name ?? "" })}
        variant="outline"
        size="sm"
        icon={<MaterialIcons name="grid-view" size={18} color={colors.text} />}
        onPress={goToCollection}
      />
      <ItemHero item={item!} collectionType={collectionType!} />
      <ItemStats
        item={item!}
        rarity={<FeedRarity user={currentUser!} item={item!} onItemUpdate={onItemUpdate} fontSize={18} showLabel={false} />}
        likes={<FeedLike user={currentUser!} item={item!} onItemUpdate={onItemUpdate} fontSize={18} />}
      />
      <ItemTextBlock title={t("items:details.description")} text={item!.description} emptyText={t("items:details.noDescriptionOther")} />
      <ItemAttributeList item={item!} collectionType={collectionType!} />
      <ItemTags tags={item!.itemTags} />
      {isMine ? null : (
        <CustomButton
          title={t("items:details.report")}
          variant="ghost"
          icon={<MaterialIcons name="flag" size={18} color={colors.text} />}
          onPress={() => setIsReporting(true)}
        />
      )}
      <CommentSection itemId={item!.id} />
      <ReportOverlay isVisible={isReporting} onClose={() => setIsReporting(false)} targetType="item" targetId={item!.id} />
    </ScrollView>
  );
}

export default OtherUserItemDetails;
