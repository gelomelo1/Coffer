import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCreateData } from "@/src/hooks/data_hooks";
import { colors, fonts, spacing } from "@/src/theme/theme";
import Feed from "@/src/types/entities/feed";
import { ItemProvided } from "@/src/types/entities/item";
import { ReactionRequired } from "@/src/types/entities/reaction";
import User from "@/src/types/entities/user";
import { getReactionsLikeCount } from "@/src/utils/data_access_utils";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Animated, Easing, Pressable } from "react-native";

interface FeedLikeProps {
  user: User;
  feed?: Feed;
  item?: ItemProvided;
  onItemUpdate?: (updatedItem: ItemProvided) => void;
  color?: string;
  fontSize?: number;
}

function FeedLike({
  user,
  feed,
  item,
  onItemUpdate,
  color,
  fontSize,
}: FeedLikeProps) {
  const { t } = useTranslation();
  const { mutateAsync: postLike, isSuccess: isLikePostSuccess } =
    useCreateData<ReactionRequired>(
      endpoints.reactions,
      querykeys.feedListData,
      "",
    );

  const scaleAnim = useState(new Animated.Value(1))[0];
  const [localLiked, setLocalLiked] = useState<boolean | null>(null);
  const [localItem, setLocalItem] = useState<ItemProvided | null>(item ?? null);

  const currentItem = feed ? feed.item : localItem;

  const userReaction = currentItem!.reactions.find(
    (reaction) => reaction.userId === user.id,
  );

  const userRarity = feed
    ? feed.item.reactions.find((reaction) => reaction.userId === user.id)
        ?.rarity
    : item!.reactions.find((reaction) => reaction.userId === user.id)?.rarity;

  const effectiveLiked =
    localLiked !== null ? localLiked : (userReaction?.liked ?? false);

  const handleLikePress = async () => {
    const newValue = !effectiveLiked;
    setLocalLiked(newValue);

    const newReaction: ReactionRequired = {
      userId: user.id,
      itemId: currentItem!.id,
      liked: newValue,
      rarity: userRarity ?? null,
    };

    try {
      const response = await postLike({ value: newReaction });

      if (item && response) {
        const updatedItem = response as unknown as ItemProvided;
        setLocalItem(updatedItem);
        onItemUpdate?.(updatedItem);

        const updatedUserReaction = updatedItem.reactions.find(
          (r) => r.userId === user.id,
        );
        setLocalLiked(updatedUserReaction?.liked ?? false);
      }
    } catch {
      setLocalLiked(userReaction?.liked ?? false);
    }
  };

  useEffect(() => {
    setLocalLiked(null);
  }, [feed, item]);

  useEffect(() => {
    if (isLikePostSuccess) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.3,
          duration: 150,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isLikePostSuccess]);

  const likeCount = getReactionsLikeCount(currentItem!.reactions);
  const tint = color ?? colors.text;

  return (
    <Pressable
      onPress={handleLikePress}
      accessibilityRole="button"
      accessibilityLabel={effectiveLiked ? t("feed:card.unlike") : t("feed:card.like")}
      accessibilityValue={{ text: t("feed:card.likes", { count: likeCount }) }}
      accessibilityState={{ selected: effectiveLiked }}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: spacing.xs, minHeight: 48, minWidth: 48, opacity: pressed ? 0.6 : 1 })}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <FontAwesome name={effectiveLiked ? "heart" : "heart-o"} size={22} color={effectiveLiked ? colors.danger : tint} />
      </Animated.View>
      <CustomText style={{ fontFamily: fonts.bold, color: tint, fontSize: fontSize ?? 16 }} concatNumber>
        {likeCount}
      </CustomText>
    </Pressable>
  );
}

export default FeedLike;
