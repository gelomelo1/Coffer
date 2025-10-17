import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCreateData } from "@/src/hooks/data_hooks";
import { customTheme } from "@/src/theme/theme";
import Feed from "@/src/types/entities/feed";
import { ReactionRequired } from "@/src/types/entities/reaction";
import User from "@/src/types/entities/user";
import { getReactionsLikeCount } from "@/src/utils/data_access_utils";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useEffect, useState } from "react";
import { Animated, Easing, TouchableOpacity, View } from "react-native";

interface FeedLikeProps {
  user: User;
  feed: Feed;
}

function FeedLike({ user, feed }: FeedLikeProps) {
  const { mutateAsync: postLike, isSuccess: isLikePostSuccess } =
    useCreateData<ReactionRequired>(
      endpoints.reactions,
      querykeys.feedListData,
      ""
    );

  const scaleAnim = useState(new Animated.Value(1))[0];

  // Instead of toggling a local boolean, we store the "optimistic" value.
  const [localLiked, setLocalLiked] = useState<boolean | null>(null);

  const isLiked = feed.item.reactions.find(
    (reaction) => reaction.userId === user.id
  )?.liked;

  const reaction = feed.item.reactions.find(
    (reaction) => reaction.userId === user.id
  );

  const effectiveLiked = localLiked !== null ? localLiked : isLiked ?? false;

  const handleLikePress = async () => {
    const newValue = !effectiveLiked;
    setLocalLiked(newValue); // instant UI feedback

    let newReaction: ReactionRequired = {
      userId: user.id,
      itemId: feed.item.id,
      liked: newValue,
      rarity: reaction?.rarity ?? null,
    };

    await postLike({ value: newReaction });
  };

  // reset local state once feed updates from the server
  useEffect(() => {
    setLocalLiked(null);
  }, [feed]);

  // animate on success
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
        flexDirection: "row",
        gap: 5,
      }}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity onPress={handleLikePress}>
          <FontAwesome
            name={effectiveLiked ? "heart" : "heart-o"}
            size={24}
            color={effectiveLiked ? "red" : customTheme.colors.secondary}
          />
        </TouchableOpacity>
      </Animated.View>

      <CustomText
        style={{
          fontFamily: "VendSansBold",
          color: customTheme.colors.secondary,
        }}
      >
        {getReactionsLikeCount(feed.item.reactions)}
      </CustomText>
    </View>
  );
}

export default FeedLike;
