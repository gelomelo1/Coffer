import { SectionHeader } from "@/src/components/custom_ui/card";
import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomHTMLView from "@/src/components/custom_ui/custom_html_view";
import CustomImage from "@/src/components/custom_ui/custom_image";
import { isRichTextEmpty } from "@/src/components/custom_ui/rich_text_field";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCreateData } from "@/src/hooks/data_hooks";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import { FollowRequired } from "@/src/types/entities/follow";
import User from "@/src/types/entities/user";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

interface OtherUserCollectionInfoCardProps {
  currentUser: User;
  collection: Collection;
  collectionType: CollectionType;
}

/** Header of someone else's collection: cover, name, stats, follow / unfollow and the description. */
function OtherUserCollectionInfoCard({ currentUser, collection, collectionType }: OtherUserCollectionInfoCardProps) {
  const { t, i18n } = useTranslation();
  const follow = collection.follows.find((f) => f.userId === currentUser.id);
  const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.language);

  const { mutateAsync: manageFollow, isPending } = useCreateData<FollowRequired, Collection>(
    endpoints.follows,
    `${querykeys.feedListData};${querykeys.otherUserCollectionsData};${querykeys.followsData}`,
    follow ? t("collections:follow.unfollowed") : t("collections:follow.followed"),
  );
  const { setCollection } = useOtherUserStore();

  const handleFollowPress = async () => {
    const change: FollowRequired = follow ?? { userId: currentUser.id, collectionId: collection.id };
    try {
      setCollection(await manageFollow({ value: change }));
    } catch {
      // error toast comes from the mutation
    }
  };

  return (
    <>
      <View style={{ marginHorizontal: spacing.md, marginTop: spacing.md, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: "row", gap: spacing.md, padding: spacing.md, flexWrap: "wrap" }}>
          <View
            style={{
              width: 112,
              height: 112,
              borderWidth: borders.width,
              borderColor: colors.border,
              backgroundColor: collectionType.color ?? colors.surfaceAlt,
              overflow: "hidden",
            }}
          >
            <CustomImage
              uri={collection.image ? `${endpoints.collectionsCoverImage}/${collection.image}` : `${endpoints.icons}/${collectionType.icon}`}
              style={{ width: "100%", height: "100%", resizeMode: "cover" }}
              enableFullScreenView
            />
          </View>
          <View style={{ flex: 1, minWidth: 140, gap: spacing.xxs }}>
            <Text accessibilityRole="header" style={[typography.headline, { color: colors.text }]} numberOfLines={3}>
              {collection.name}
            </Text>
            <Text style={[typography.meta, { color: colors.textMuted }]}>{t("collections:info.created", { date: date(collection.createdAt) })}</Text>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>{t("collections:info.followers", { count: collection.follows.length })}</Text>
            {follow ? (
              <Text style={[typography.meta, { color: colors.text }]}>{t("collections:follow.since", { date: date(follow.followedAt) })}</Text>
            ) : null}
          </View>
        </View>
        <View style={{ padding: spacing.md, paddingTop: 0 }}>
          <CustomButton
            title={follow ? t("collections:follow.unfollow") : t("collections:follow.follow")}
            variant={follow ? "outline" : "primary"}
            icon={
              <MaterialCommunityIcons
                name={follow ? "emoticon-minus" : "emoticon-plus"}
                size={sizes.iconSm}
                color={follow ? colors.text : colors.onPrimary}
              />
            }
            onPress={handleFollowPress}
            loading={isPending}
            disabled={isPending}
          />
        </View>
      </View>
      <View style={{ marginHorizontal: spacing.md }}>
        <SectionHeader title={t("collections:edit.description")} />
        {!isRichTextEmpty(collection.description) ? (
          <View style={{ marginHorizontal: -spacing.sm }}>
            <CustomHTMLView content={collection.description!} foldable />
          </View>
        ) : (
          <Text style={[typography.meta, { color: colors.textMuted }]}>{t("collections:info.noDescriptionOther")}</Text>
        )}
      </View>
    </>
  );
}

export default OtherUserCollectionInfoCard;
