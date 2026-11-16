import { FeedCommentButton } from "@/src/components/comments/comments_overlay";
import Avatar from "@/src/components/custom_ui/avatar";
import { Chip, ChipRow } from "@/src/components/custom_ui/chip";
import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { useUserStore } from "@/src/hooks/user_store";
import { borders, colors, fonts, spacing, typography } from "@/src/theme/theme";
import CollectionType from "@/src/types/entities/collectiontype";
import Feed from "@/src/types/entities/feed";
import User from "@/src/types/entities/user";
import { getCountryByCode, getItemPrimaryAttributeValue } from "@/src/utils/data_access_utils";
import { countryFlag } from "@/src/utils/market_api";
import { navigate } from "expo-router/build/global-state/routing";
import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable, Text, View } from "react-native";
import FeedLike from "./feed_like";
import FeedRarity from "./feed_rarity";

interface FeedCardProps {
  user: User;
  collectionType: CollectionType;
  feed: Feed;
  onTagPress: (tagText: string) => void;
}

/** Feed post: who, which collection, the item image first, its name, description and tags, then reactions. */
function FeedCard({ user, collectionType, feed, onTagPress }: FeedCardProps) {
  const { t, i18n } = useTranslation();
  const { setCollectionType } = useCollectionStore();
  const { token } = useUserStore();
  const { setValues, setUser, setCollection } = useOtherUserStore();

  const [countryName, setCountryName] = useState<string | null>(null);

  useEffect(() => {
    if (!feed.user.country) return;
    getCountryByCode(feed.user.country).then((c) => setCountryName(c ? c.name.toString() : null));
  }, [feed.user.country]);

  const isCollectionFollowed = !!feed.collection.follows.find((follow) => follow.userId === user.id);
  const primaryAttribute = getItemPrimaryAttributeValue(feed.item.itemAttributes);
  const itemName = primaryAttribute?.value?.toString() ?? "";

  const handleUserPress = () => {
    setUser(feed.user);
    navigate({ pathname: ROUTES.OTHERUSER, params: pageParams.otheruser(feed.user.name) });
  };

  const handleCollectionPress = () => {
    setCollectionType(collectionType);
    setUser(feed.user);
    setCollection(feed.collection);
    navigate({ pathname: ROUTES.OTHERUSERCOLLECTION, params: pageParams.otherusercollection(feed.user.name, feed.collection.name) });
  };

  const handleItemPress = () => {
    setCollectionType(collectionType);
    setValues(feed.user, feed.collection, feed.item);
    navigate({ pathname: ROUTES.OTHERUSERITEMDETAILS, params: pageParams.otheruseritemdetails(feed.collection.name) });
  };

  return (
    <View style={{ backgroundColor: colors.surface, borderWidth: borders.width, borderColor: colors.border }}>
      {/* Who and where */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm }}>
        <Pressable
          onPress={handleUserPress}
          accessibilityRole="button"
          accessibilityLabel={t("feed:card.openUser", { name: feed.user.name })}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1, minHeight: 48, opacity: pressed ? 0.6 : 1 })}
        >
          <Avatar uri={feed.user.avatar} size={40} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[typography.bodyStrong, { color: colors.text }]}>
              {feed.user.name}
            </Text>
            <Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted }]}>
              {[`${countryFlag(feed.user.country)} ${countryName ?? ""}`.trim(), new Date(feed.item.acquiredAt).toLocaleDateString(i18n.language)]
                .filter(Boolean)
                .join(" · ") /* i18n-ignore */}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Collection strip in the collection type's color */}
      <Pressable
        onPress={handleCollectionPress}
        accessibilityRole="button"
        accessibilityLabel={t("feed:card.openCollection", { name: feed.collection.name })}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          minHeight: 40,
          paddingHorizontal: spacing.sm,
          borderTopWidth: borders.width,
          borderBottomWidth: borders.width,
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfaceAlt : colors.bg,
        })}
      >
        <View style={{ width: 24, height: 24, backgroundColor: collectionType.color, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
          <Image source={{ uri: `${endpoints.icons}/${collectionType.icon}` }} style={{ width: 18, height: 18 }} />
        </View>
        <Text numberOfLines={1} style={[typography.label, { color: colors.text, flex: 1 }]}>
          {feed.collection.name}
        </Text>
        {isCollectionFollowed ? <Text style={[typography.caption, { color: colors.text, fontFamily: fonts.bold }]}>{t("feed:card.followed")}</Text> : null}
      </Pressable>

      {/* The item */}
      <Pressable
        onPress={handleItemPress}
        accessibilityRole="imagebutton"
        accessibilityLabel={t("feed:card.openItem", { name: itemName })}
        style={({ pressed }) => ({ backgroundColor: collectionType.color, padding: spacing.md, alignItems: "center", opacity: pressed ? 0.9 : 1 })}
      >
        <Image
          source={{
            uri: feed.item.image ? `${endpoints.itemsCoverImage}/${feed.item.image}` : `${endpoints.icons}/${collectionType.icon}`,
            headers: { Authorization: `Bearer ${token}` },
          }}
          style={{ width: "75%", maxWidth: 320, aspectRatio: 1, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.bg }}
          resizeMode="cover"
        />
      </Pressable>

      <View style={{ padding: spacing.md, gap: spacing.xs }}>
        {itemName ? (
          <Text style={[typography.title, { color: colors.text }]} numberOfLines={3}>
            {itemName}
          </Text>
        ) : null}
        {feed.item.description ? (
          <CustomText variant="meta" foldable maxLines={3}>
            {feed.item.description}
          </CustomText>
        ) : null}
        {feed.item.itemTags.length > 0 ? (
          <ChipRow style={{ marginTop: spacing.xxs }}>
            {feed.item.itemTags.map((tag) => (
              <Chip
                key={tag.id}
                label={`#${tag.tag}`}
                accessibilityLabel={t("feed:card.searchTag", { tag: tag.tag })}
                onPress={() => onTagPress(`#${tag.tag}`)}
              />
            ))}
          </ChipRow>
        ) : null}
      </View>

      {/* Reactions */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: spacing.md,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xxs,
          borderTopWidth: borders.hairline,
          borderTopColor: colors.borderMuted,
        }}
      >
        <FeedLike user={user} feed={feed} />
        <FeedRarity user={user} feed={feed} />
        <View style={{ flex: 1 }} />
        <FeedCommentButton itemId={feed.item.id} color={colors.text} />
      </View>
    </View>
  );
}

export default memo(FeedCard);
