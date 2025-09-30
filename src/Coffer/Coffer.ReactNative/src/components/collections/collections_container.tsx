import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { initCollectionStore } from "@/src/hooks/collection_store";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import User from "@/src/types/entities/user";
import { darkenBy60Percent } from "@/src/utils/frontend_utils";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { navigate } from "expo-router/build/global-state/routing";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  Pressable,
  TouchableOpacity,
  View,
} from "react-native";
import { Divider } from "react-native-elements";
import CustomText from "../custom_ui/custom_text";

interface CollectionsContainerProps {
  collectionTypes: CollectionType[];
  collections: Collection[];
}

export default function CollectionsContainer({
  collectionTypes,
  collections,
}: CollectionsContainerProps) {
  const { user } = useUserStore();

  const [sorts, setSorts] = useState<Record<string, keyof Collection>>(
    Object.fromEntries(
      collectionTypes.map((collectionType) => [collectionType.id, "createdAt"])
    )
  );

  const handleSorts = (typeId: string) => {
    setSorts((prev) => ({
      ...prev,
      [typeId]: prev[typeId] === "name" ? "createdAt" : "name",
    }));
  };

  return (
    <View
      style={{
        width: "100%",
        gap: 20,
      }}
    >
      {collectionTypes.map((type) => {
        const matchingCollections = collections.filter(
          (collection) => collection.collectionTypeId === type.id
        );
        if (matchingCollections.length === 0) return null;

        if (sorts[type.id] === "name" && matchingCollections.length > 1) {
          matchingCollections.sort((a, b) => a.name.localeCompare(b.name));
        } else if (matchingCollections.length > 1) {
          matchingCollections.sort(
            (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
          );
        }

        return (
          <View key={type.id}>
            <View
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexDirection: "row",
                marginHorizontal: 10,
              }}
            >
              <Pressable
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  flexDirection: "row",
                }}
                onPress={() => handleSorts(type.id)}
              >
                <CustomText
                  style={{
                    fontFamily: "VendSansBold",
                    fontSize: 18,
                  }}
                >
                  {type.name}
                </CustomText>
                <MaterialIcons
                  name="sort"
                  size={18}
                  color={customTheme.colors.primary}
                />
                <CustomText
                  style={{
                    color: customTheme.colors.secondary,
                  }}
                >
                  {sorts[type.id] === "name" ? "-> Name" : "-> Date"}
                </CustomText>
              </Pressable>

              <CustomText
                style={{
                  fontFamily: "VendSansBold",
                  fontSize: 18,
                }}
              >
                {matchingCollections.length}
              </CustomText>
            </View>
            <Divider
              width={2}
              color={customTheme.colors.primary}
              style={{ marginBottom: 8, marginHorizontal: 10 }}
            />
            {
              <CollectionCarousel
                matchingCollections={matchingCollections}
                matchingCollectionType={type}
                triggerAnimation={sorts[type.id]}
                user={user}
              />
            }
          </View>
        );
      })}
    </View>
  );
}

function CollectionCarousel({
  matchingCollections,
  matchingCollectionType,
  triggerAnimation,
  user,
}: {
  matchingCollections: Collection[];
  matchingCollectionType: CollectionType;
  triggerAnimation: string;
  user: User;
}) {
  const contrastColor = darkenBy60Percent(matchingCollectionType.color);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (triggerAnimation) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [fadeAnim, triggerAnimation]);

  const handleNavigation = (item: Collection) => {
    initCollectionStore(matchingCollectionType, item);
    navigate({
      pathname: ROUTES.COLLECTIONS.HOME,
      params: pageParams.home(
        user.name,
        matchingCollectionType.icon,
        item.name,
        matchingCollectionType.color
      ),
    });
  };

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
      }}
    >
      <FlatList
        data={matchingCollections}
        keyExtractor={(item) => item.id.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => handleNavigation(item)}
            style={{
              width: 100,
              height: 120,
              marginRight: 12,
              marginBottom: 2,
              padding: 4,
              backgroundColor: matchingCollectionType.color,
              borderWidth: 2,
              borderColor: contrastColor,
            }}
          >
            <Image
              source={{
                uri: `${endpoints.icons}/${matchingCollectionType.icon}`,
              }}
              style={{
                width: "100%",
                aspectRatio: "1/1",
                borderWidth: 2,
                borderColor: contrastColor,
              }}
            />
            <View
              style={{
                height: 24,
                justifyContent: "center",
              }}
            >
              <CustomText
                numberOfLines={2}
                ellipsizeMode="tail"
                style={{
                  fontFamily: "VendSansBold",
                  fontSize: 14,
                  color: contrastColor,
                  lineHeight: 12,
                }}
              >
                {item.name}
              </CustomText>
            </View>
          </TouchableOpacity>
        )}
      />
    </Animated.View>
  );
}
