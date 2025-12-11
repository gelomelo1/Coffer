import CustomText from "@/src/components/custom_ui/custom_text";
import { Loading } from "@/src/components/custom_ui/loading";
import { customTheme } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import User from "@/src/types/entities/user";
import { chunkArray } from "@/src/utils/data_access_utils";
import { useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  SectionList,
  View,
} from "react-native";
import SettingsUserCard from "../settings/settings_user_card";
import OtherUserCollectionCard from "./other_user_collection_card";

interface OtherUserCollectionSectionListProps {
  currentUser: User;
  user: User;
  collectionType: CollectionType;
  collections: Collection[];
  allLoading: boolean;
}

function OtherUserCollectionSectionList({
  currentUser,
  user,
  collectionType,
  collections,
  allLoading,
}: OtherUserCollectionSectionListProps) {
  const chunkedItems = chunkArray(collections, 2);

  const sections = [{ data: chunkedItems.length > 0 ? chunkedItems : [[]] }];

  const [isStickyShadow, setIsStickyShadow] = useState(false);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;

    setIsStickyShadow(offsetY > 260);
  };

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item, index) =>
        item.map((i) => i.id).join("_") ?? index.toString()
      }
      onScroll={onScroll}
      scrollEventThrottle={16}
      ListHeaderComponent={<SettingsUserCard user={user} otherUser={true} />}
      renderSectionHeader={() => (
        <View
          style={{
            width: "100%",
            backgroundColor: customTheme.colors.background,
            paddingHorizontal: 10,
            paddingVertical: 10,
            boxShadow: isStickyShadow
              ? ` 0 4px 4px -4px ${customTheme.colors.disabledOverlay}`
              : "none",
          }}
        >
          <CustomText
            style={{
              fontFamily: "VendSansBold",
              fontSize: 24,
              color: customTheme.colors.secondary,
            }}
          >
            {user.name}
            <CustomText style={{ fontSize: 20 }}>{"'s collections"}</CustomText>
          </CustomText>
          {allLoading && <Loading />}

          {!allLoading && collections.length === 0 ? (
            <>
              <View
                style={{
                  justifyContent: "center",
                  alignItems: "center",
                  marginHorizontal: 10,
                  marginTop: 20,
                }}
              >
                <CustomText
                  style={{ fontFamily: "VendSansBold", fontSize: 20 }}
                >
                  No collection found
                </CustomText>
              </View>
            </>
          ) : null}
        </View>
      )}
      renderItem={({ item }) => (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: 10,
            marginHorizontal: 10,
          }}
        >
          {item.map((i) => (
            <OtherUserCollectionCard
              key={i.id}
              currentUser={currentUser}
              user={user}
              collection={i}
              collectionType={collectionType}
            />
          ))}
        </View>
      )}
      stickySectionHeadersEnabled
      ListFooterComponent={
        <CustomText
          style={{
            textAlign: "center",
            fontFamily: "VendSansItalic",
            marginTop: 20,
          }}
        >
          End of list
        </CustomText>
      }
      contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
    />
  );
}

export default OtherUserCollectionSectionList;
