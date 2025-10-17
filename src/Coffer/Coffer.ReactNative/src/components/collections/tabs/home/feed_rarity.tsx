import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import rarityVariants from "@/src/const/rarity_variants";
import { useCreateData } from "@/src/hooks/data_hooks";
import { customTheme } from "@/src/theme/theme";
import Feed from "@/src/types/entities/feed";
import { ReactionRequired } from "@/src/types/entities/reaction";
import User from "@/src/types/entities/user";
import { useEffect, useState } from "react";
import { Animated, Easing, TouchableOpacity } from "react-native";
import FeedRaritySelector from "./feed_rarity_selector";

interface FeedRarityProps {
  user: User;
  feed: Feed;
}

function FeedRarity({ user, feed }: FeedRarityProps) {
  const { mutateAsync: postRarity, isSuccess: isRarityPostSuccess } =
    useCreateData<ReactionRequired>(
      endpoints.reactions,
      querykeys.feedListData,
      ""
    );

  const rarityScaleAnim = useState(new Animated.Value(1))[0];
  const [isFeedRaritySelectorVisible, setIsFeedRaritySelectorVisible] =
    useState(false);

  // Optimistic local rarity (null = no local override)
  const [localRarity, setLocalRarity] = useState<number | null | undefined>(
    null
  );

  const reaction = feed.item.reactions.find(
    (reaction) => reaction.userId === user.id
  );

  // Pick local rarity if exists, otherwise from backend
  const rarityValue =
    localRarity !== null ? localRarity : reaction?.rarity ?? null;

  // Animate rarity text when mutation succeeds
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

  // Reset optimistic state when feed updates
  useEffect(() => {
    setLocalRarity(null);
  }, [feed]);

  const handleRaritySelect = async (rarity: number | null | undefined) => {
    // instant UI update (optimistic)
    setLocalRarity(rarity);

    let newReaction: ReactionRequired = {
      userId: user.id,
      itemId: feed.item.id,
      liked: reaction?.liked ?? false,
      rarity: rarity ?? null,
    };

    await postRarity({ value: newReaction });
  };

  return (
    <>
      <TouchableOpacity onPress={() => setIsFeedRaritySelectorVisible(true)}>
        <Animated.View style={{ transform: [{ scale: rarityScaleAnim }] }}>
          {rarityValue ? (
            <CustomText
              style={{
                fontFamily: "VendSansItalic",
                color: rarityVariants[rarityValue].color,
              }}
            >
              {rarityVariants[rarityValue].title}
            </CustomText>
          ) : (
            <CustomText
              style={{
                fontFamily: "VendSansItalic",
                color: customTheme.colors.secondary,
              }}
            >
              Not rated
            </CustomText>
          )}
        </Animated.View>
      </TouchableOpacity>

      <FeedRaritySelector
        isFeedRaritySelectorVisible={{
          value: isFeedRaritySelectorVisible,
          set: setIsFeedRaritySelectorVisible,
        }}
        selectedRarity={rarityValue}
        onRaritySelect={handleRaritySelect}
      />
    </>
  );
}

export default FeedRarity;
