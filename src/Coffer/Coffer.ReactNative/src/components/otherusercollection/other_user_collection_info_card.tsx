import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCreateData } from "@/src/hooks/data_hooks";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import { FollowRequired } from "@/src/types/entities/follow";
import User from "@/src/types/entities/user";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { View } from "react-native";
import CustomImage from "../custom_ui/custom_image";

interface OtherUserCollectionInfoCardProps {
  currentUser: User;
  collection: Collection;
  collectionType: CollectionType;
}

function OtherUserCollectionInfoCard({
  currentUser,
  collection,
  collectionType,
}: OtherUserCollectionInfoCardProps) {
  const { token } = useUserStore();
  const follow = collection.follows.find(
    (follow) => follow.userId === currentUser.id,
  );

  const { mutateAsync: manageFollow, isPending } = useCreateData<
    FollowRequired,
    Collection
  >(
    endpoints.follows,
    `${querykeys.feedListData};${querykeys.otherUserCollectionsData};${querykeys.followsData}`,
    follow
      ? "You stopped following this collection"
      : "You started following this collection",
  );

  const { setCollection } = useOtherUserStore();

  const handleFollowPress = async () => {
    let followChange: FollowRequired = {
      userId: currentUser.id,
      collectionId: collection.id,
    };

    if (follow) followChange = follow;

    const response = await manageFollow({ value: followChange });
    setCollection(response);
  };

  return (
    <View
      style={{
        borderWidth: 4,
        borderColor: customTheme.colors.primary,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        marginHorizontal: 10,
        marginBottom: 20,
      }}
    >
      <View
        style={{
          height: 150,
          flexDirection: "row",
          margin: 5,
          marginBottom: 10,
          gap: 5,
        }}
      >
        <View
          style={{
            position: "relative",
            width: 150,
            borderWidth: 1,
            borderColor: customTheme.colors.primary,
            justifyContent: "center",
          }}
        >
          <CustomImage
            uri={
              collection.image
                ? `${endpoints.collectionsCoverImage}/${collection.image}`
                : `${endpoints.icons}/${collectionType.icon}`
            }
            style={{ width: "100%", aspectRatio: 1, resizeMode: "cover" }}
            enableFullScreenView={true}
          />
        </View>
        <View
          style={{
            flex: 1,
          }}
        >
          <CustomText
            style={{ fontFamily: "VendSansBold", fontSize: 20 }}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {collection.name}
          </CustomText>
          <CustomText>
            {new Date(collection.createdAt).toLocaleDateString()}
          </CustomText>
          <CustomText style={{ fontFamily: "VendSansBold" }}>
            {collection.follows.length} <CustomText>follower</CustomText>
          </CustomText>
        </View>
      </View>
      {follow ? (
        <CustomText style={{ textAlign: "center", marginBottom: 5 }}>
          You follow this collection since{" "}
          {new Date(follow.followedAt).toLocaleDateString()}
        </CustomText>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          marginBottom: 1,
        }}
      >
        <CustomButton
          title={follow ? "Unfollow" : "Follow"}
          icon={
            follow ? (
              <MaterialCommunityIcons
                name="emoticon-minus"
                size={20}
                color={customTheme.colors.secondary}
                style={{ marginRight: 5 }}
              />
            ) : (
              <MaterialCommunityIcons
                name="emoticon-plus"
                size={20}
                color={customTheme.colors.secondary}
                style={{ marginRight: 5 }}
              />
            )
          }
          containerStyle={{ width: "100%" }}
          onPress={handleFollowPress}
          loading={isPending}
        />
      </View>
    </View>
  );
}

export default OtherUserCollectionInfoCard;
