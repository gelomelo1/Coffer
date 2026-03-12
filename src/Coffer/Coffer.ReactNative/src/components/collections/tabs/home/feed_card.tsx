import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import CollectionType from "@/src/types/entities/collectiontype";
import Feed from "@/src/types/entities/feed";
import User from "@/src/types/entities/user";
import {
  getCountryByCode,
  getItemPrimaryAttributeValue,
} from "@/src/utils/data_access_utils";
import { adjustColor } from "@/src/utils/frontend_utils";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { navigate } from "expo-router/build/global-state/routing";
import { useEffect, useState } from "react";
import { Image, TouchableOpacity, View } from "react-native";
import { Country } from "react-native-country-picker-modal";
import { Avatar } from "react-native-elements";
import FeedLike from "./feed_like";
import FeedRarity from "./feed_rarity";

interface FeedCardProps {
  user: User;
  collectionType: CollectionType;
  feed: Feed;
}

function FeedCard({ user, collectionType, feed }: FeedCardProps) {
  const { setCollectionType } = useCollectionStore();
  const { token } = useUserStore();
  const { setValues, setUser, setCollection } = useOtherUserStore();
  const [country, setCountry] = useState<Country | null>(null);

  useEffect(() => {
    const fetchCountry = async () => {
      if (feed.user.country) {
        const countryData = await getCountryByCode(feed.user.country);
        setCountry(countryData);
      }
    };

    fetchCountry();
  }, [feed.user.country]);

  const isCollectionFollwed = !!feed.collection.follows.find(
    (follow) => follow.userId === user.id,
  );

  const primaryAttribute = getItemPrimaryAttributeValue(
    feed.item.itemAttributes,
  );

  const darkContrastColor = adjustColor(
    collectionType.color,
    customTheme.colorChangePercent.dark,
  );

  const handleUserPress = () => {
    setUser(feed.user);
    navigate({
      pathname: ROUTES.OTHERUSER,
      params: pageParams.otheruser(feed.user.name),
    });
  };

  const handleCollectionPress = () => {
    setCollectionType(collectionType);
    setUser(feed.user);
    setCollection(feed.collection);
    navigate({
      pathname: ROUTES.OTHERUSERCOLLECTION,
      params: pageParams.otherusercollection(
        feed.user.name,
        feed.collection.name,
      ),
    });
  };

  const handleItemPress = () => {
    setCollectionType(collectionType);
    setValues(feed.user, feed.collection, feed.item);
    navigate({
      pathname: ROUTES.OTHERUSERITEMDETAILS,
      params: pageParams.otheruseritemdetails(feed.collection.name),
    });
  };

  return (
    <>
      <View
        style={{
          width: "100%",
          backgroundColor: customTheme.colors.primary,
          borderRadius: 20,
        }}
      >
        <View style={{ margin: 10 }}>
          <View
            style={{ justifyContent: "space-between", flexDirection: "row" }}
          >
            <TouchableOpacity
              style={{
                justifyContent: "flex-start",
                alignItems: "center",
                flexShrink: 1,
                flexDirection: "row",
                gap: 10,
              }}
              onPress={handleUserPress}
            >
              <Avatar
                size={32}
                rounded
                source={
                  feed.user.avatar ? { uri: feed.user.avatar } : undefined
                }
                icon={
                  !feed.user?.avatar
                    ? {
                        name: "user",
                        type: "feather",
                        color: customTheme.colors.primary,
                      }
                    : undefined
                }
                containerStyle={{
                  backgroundColor: customTheme.colors.secondary,
                }}
              />
              <CustomText
                style={{
                  color: customTheme.colors.secondary,
                  flexShrink: 1,
                }}
                numberOfLines={1}
                lineBreakMode="tail"
              >
                {feed.user.name}
              </CustomText>
            </TouchableOpacity>
            <View>
              <View
                style={{
                  justifyContent: "flex-start",
                  alignItems: "center",
                  flexDirection: "row",
                }}
              >
                <MaterialIcons
                  name="place"
                  size={24}
                  color={customTheme.colors.secondary}
                />
                <CustomText style={{ color: customTheme.colors.secondary }}>
                  {country ? country.name.toString() : ""}
                </CustomText>
              </View>
              <CustomText
                style={{
                  fontSize: 12,
                  color: customTheme.colors.secondary,
                  textAlign: "right",
                }}
              >
                {new Date(feed.item.acquiredAt).toLocaleDateString()}
              </CustomText>
            </View>
          </View>
          <View
            style={{
              justifyContent: "flex-start",
              alignItems: "center",
              flexDirection: "row",
            }}
          >
            <TouchableOpacity onPress={handleCollectionPress}>
              <CustomText
                style={{
                  fontFamily: "VendSansItalic",
                  color: customTheme.colors.secondary,
                }}
              >
                {feed.collection.name}
              </CustomText>
            </TouchableOpacity>
            {isCollectionFollwed ? (
              <>
                <CustomText style={{ color: customTheme.colors.secondary }}>
                  {" "}
                  -{" "}
                </CustomText>
                <CustomText
                  style={{
                    fontFamily: "VendSansBold",
                    color: customTheme.colors.secondary,
                  }}
                >
                  Followed
                </CustomText>
              </>
            ) : null}
          </View>
        </View>
        <View
          style={{
            justifyContent: "center",
            alignItems: "center",
            borderRadius: 20,
            backgroundColor: collectionType.color,
            padding: 10,
            borderWidth: 2,
            borderColor: customTheme.colors.secondary,
          }}
        >
          <TouchableOpacity
            style={{
              width: "40%",
              alignSelf: "center",
              borderWidth: 2,
              borderColor: darkContrastColor,
              borderRadius: 5,
              boxShadow: `2px 2px 2px ${darkContrastColor}`,
            }}
            onPress={handleItemPress}
          >
            <Image
              source={{
                uri: feed.item.image
                  ? `${endpoints.itemsCoverImage}/${feed.item.image}`
                  : `${endpoints.icons}/${collectionType.icon}`,
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }}
              style={{
                width: "100%",
                aspectRatio: 1,
                resizeMode: "cover",
              }}
            />
          </TouchableOpacity>
          <CustomText
            style={{
              alignSelf: "center",
              color: darkContrastColor,
              fontFamily: "VendSansBold",
              fontSize: 24,
              marginTop: 5,
            }}
            numberOfLines={1}
            lineBreakMode="tail"
          >
            {primaryAttribute?.value?.toString()}
          </CustomText>
          <View
            style={{
              width: "100%",
              justifyContent: "flex-start",
              alignItems: "center",
              flexDirection: "row",
              gap: 5,
              flexWrap: "wrap",
            }}
          >
            {feed.item.itemTags.map((tag) => (
              <CustomText
                key={tag.id}
                style={{ color: darkContrastColor, fontSize: 14 }}
              >{`#${tag.tag}`}</CustomText>
            ))}
          </View>
        </View>
        <View
          style={{
            justifyContent: "flex-start",
            flexDirection: "row",
            gap: 20,
            margin: 10,
          }}
        >
          <FeedLike user={user} feed={feed} />

          <View
            style={{
              justifyContent: "flex-start",
              flexDirection: "row",
              gap: 5,
            }}
          >
            <CustomText style={{ color: customTheme.colors.secondary }}>
              Rarity Rating:
            </CustomText>
            <FeedRarity user={user} feed={feed} />
          </View>
        </View>
      </View>
    </>
  );
}

export default FeedCard;
