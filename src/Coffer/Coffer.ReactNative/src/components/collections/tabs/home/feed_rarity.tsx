import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import rarityVariants from "@/src/const/rarity_variants";
import { useCreateData } from "@/src/hooks/data_hooks";
import { colors, fonts, spacing } from "@/src/theme/theme";
import Feed from "@/src/types/entities/feed";
import { ItemProvided } from "@/src/types/entities/item";
import { ReactionRequired } from "@/src/types/entities/reaction";
import User from "@/src/types/entities/user";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import FeedRaritySelector from "./feed_rarity_selector";

interface FeedRarityProps {
  user: User;
  feed?: Feed;
  item?: ItemProvided;
  onItemUpdate?: (updatedItem: ItemProvided) => void;
  fontSize?: number;
  color?: string;
  /** Show the "Rarity" caption before the value (off where a surrounding label already says it). */
  showLabel?: boolean;
}

function FeedRarity({
  user,
  feed,
  item,
  onItemUpdate,
  fontSize,
  color,
  showLabel = true,
}: FeedRarityProps) {
  const { t } = useTranslation();
  const { mutateAsync: postRarity, isSuccess: isRarityPostSuccess } =
    useCreateData<ReactionRequired>(
      endpoints.reactions,
      querykeys.feedListData,
      ""
    );

  const rarityScaleAnim = useState(new Animated.Value(1))[0];
  const [isSelectorVisible, setIsSelectorVisible] = useState(false);

  const [localItem, setLocalItem] = useState<ItemProvided | null>(item ?? null);
  const [localRarity, setLocalRarity] = useState<number | null | undefined>(
    null
  );

  const currentItem = feed ? feed.item : localItem;

  const reaction = currentItem!.reactions.find((r) => r.userId === user.id);

  const userLiked = feed
    ? feed.item.reactions.find((reaction) => reaction.userId === user.id)?.liked
    : item!.reactions.find((reaction) => reaction.userId === user.id)?.liked;

  const rarityValue =
    localRarity !== null ? localRarity : reaction?.rarity ?? null;

  useEffect(() => {
    if (isRarityPostSuccess) {
      Animated.sequence([
        Animated.timing(rarityScaleAnim, {
          toValue: 1.3,
          duration: 150,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rarityScaleAnim, {
          toValue: 1,
          duration: 150,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isRarityPostSuccess]);

  useEffect(() => {
    setLocalRarity(null);
  }, [feed, item]);

  const handleRaritySelect = async (rarity: number | null | undefined) => {
    setLocalRarity(rarity);

    const newReaction: ReactionRequired = {
      userId: user.id,
      itemId: currentItem!.id,
      liked: userLiked ?? false,
      rarity: rarity ?? null,
    };

    try {
      const response = await postRarity({ value: newReaction });

      if (item && response) {
        const updatedItem = response as unknown as ItemProvided;
        setLocalItem(updatedItem);
        onItemUpdate?.(updatedItem);

        const updatedUserReaction = updatedItem.reactions.find(
          (r) => r.userId === user.id
        );
        setLocalRarity(updatedUserReaction?.rarity ?? null);
      }
    } catch {
      setLocalRarity(reaction?.rarity ?? null);
    }
  };

  const variant = rarityValue ? rarityVariants[rarityValue] : null;
  const tint = color ?? colors.text;

  return (
    <>
      <Pressable
        onPress={() => setIsSelectorVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={t("feed:card.rate")}
        accessibilityValue={{ text: variant ? t(variant.titleKey) : t("feed:rarity.none") }}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: spacing.xs, minHeight: 48, opacity: pressed ? 0.6 : 1 })}
      >
        {showLabel ? <Text style={{ color: tint, fontFamily: fonts.regular, fontSize: (fontSize ?? 16) - 2 }}>{t("feed:card.rarity")}</Text> : null}
        <Animated.View style={{ transform: [{ scale: rarityScaleAnim }], flexDirection: "row", alignItems: "center", gap: spacing.xxs }}>
          {variant ? <View style={{ width: 12, height: 12, backgroundColor: variant.color, borderWidth: 1, borderColor: colors.border }} /> : null}
          <Text style={{ color: tint, fontFamily: variant ? fonts.bold : fonts.italic, fontSize: fontSize ?? 16 }}>
            {variant ? t(variant.titleKey) : t("feed:rarity.none")}
          </Text>
        </Animated.View>
      </Pressable>

      <FeedRaritySelector
        isFeedRaritySelectorVisible={{ value: isSelectorVisible, set: setIsSelectorVisible }}
        selectedRarity={rarityValue}
        onRaritySelect={handleRaritySelect}
      />
    </>
  );
}

export default FeedRarity;
