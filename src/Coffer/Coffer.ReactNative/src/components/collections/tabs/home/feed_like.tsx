import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCreateData } from "@/src/hooks/data_hooks";
import { customTheme } from "@/src/theme/theme";
import Feed from "@/src/types/entities/feed";
import { ItemProvided } from "@/src/types/entities/item";
import { ReactionRequired } from "@/src/types/entities/reaction";
import User from "@/src/types/entities/user";
import { getReactionsLikeCount } from "@/src/utils/data_access_utils";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useEffect, useState } from "react";
import { Animated, Easing, TouchableOpacity, View } from "react-native";

interface FeedLikeProps {
  user: User;
  feed?: Feed; // optional
  item?: ItemProvided; // optional
  onItemUpdate?: (updatedItem: ItemProvided) => void; // callback to sync updated item externally
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
  const { mutateAsync: postLike, isSuccess: isLikePostSuccess } =
    useCreateData<ReactionRequired>(
      endpoints.reactions,
      querykeys.feedListData,
      ""
    );

  const scaleAnim = useState(new Animated.Value(1))[0];
  const [localLiked, setLocalLiked] = useState<boolean | null>(null);
  const [localItem, setLocalItem] = useState<ItemProvided | null>(item ?? null);

  // Determine working item
  const currentItem = feed ? feed.item : localItem;

  const userReaction = currentItem!.reactions.find(
    (reaction) => reaction.userId === user.id
  );

  const userRarity = feed
    ? feed.item.reactions.find((reaction) => reaction.userId === user.id)
        ?.rarity
    : item!.reactions.find((reaction) => reaction.userId === user.id)?.rarity;

  const effectiveLiked =
    localLiked !== null ? localLiked : userReaction?.liked ?? false;

  const handleLikePress = async () => {
    const newValue = !effectiveLiked;
    setLocalLiked(newValue); // ✅ optimistic UI

    const newReaction: ReactionRequired = {
      userId: user.id,
      itemId: currentItem!.id,
      liked: newValue,
      rarity: userRarity ?? null,
    };

    try {
      // The API returns updated item only when type = item
      const response = await postLike({ value: newReaction });

      // If this is an item, server returns updated item → replace local state
      if (item && response) {
        const updatedItem = response as unknown as ItemProvided;
        setLocalItem(updatedItem);
        onItemUpdate?.(updatedItem);

        // update optimistic liked state to match server (in case backend logic differs)
        const updatedUserReaction = updatedItem.reactions.find(
          (r) => r.userId === user.id
        );
        setLocalLiked(updatedUserReaction?.liked ?? false);
      }
    } catch {
      // rollback on failure
      setLocalLiked(userReaction?.liked ?? false);
    }
  };

  // Reset optimistic state when feed or item changes
  useEffect(() => {
    setLocalLiked(null);
  }, [feed, item]);

  // Animate heart on success
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

  return (
    <View
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        flexDirection: "row",
        gap: 5,
      }}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity onPress={handleLikePress}>
          <FontAwesome
            name={effectiveLiked ? "heart" : "heart-o"}
            size={24}
            color={
              effectiveLiked ? "red" : color ?? customTheme.colors.secondary
            }
          />
        </TouchableOpacity>
      </Animated.View>

      <CustomText
        style={{
          fontFamily: "VendSansBold",
          color: color ?? customTheme.colors.secondary,
          fontSize: fontSize ?? 16,
        }}
      >
        {getReactionsLikeCount(currentItem!.reactions)}
      </CustomText>
    </View>
  );
}

export default FeedLike;
