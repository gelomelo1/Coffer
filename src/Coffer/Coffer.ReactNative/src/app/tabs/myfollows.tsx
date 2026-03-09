import FeedSearchCollectionCard from "@/src/components/collections/tabs/home/feed_search_collection_card";
import CustomText from "@/src/components/custom_ui/custom_text";
import { Loading } from "@/src/components/custom_ui/loading";
import rootViewStyle from "@/src/components/custom_ui/root_view";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCollectionTypeStore } from "@/src/hooks/collection_type_store";
import { useGetData } from "@/src/hooks/data_hooks";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import CollectionSearch from "@/src/types/entities/collection_search";
import { useState } from "react";
import { Image, SectionList, TouchableOpacity, View } from "react-native";

function MyFollows() {
  const { collectionTypes } = useCollectionTypeStore();
  const { token, user } = useUserStore();

  const { data: followsData = [], isFetching } = useGetData<CollectionSearch>(
    `${endpoints.feedUserFollows}/${user!.id}`,
    querykeys.followsData,
  );

  const existingCollectionTypeIds = Array.from(
    new Set(followsData.map((follow) => follow.collection.collectionTypeId)),
  );

  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set(),
  );

  const toggleSection = (sectionId: number) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId); // collapse
      } else {
        newSet.add(sectionId); // expand
      }
      return newSet;
    });
  };

  const sections = collectionTypes
    .filter((ct) => existingCollectionTypeIds.includes(ct.id))
    .map((ct) => {
      const items = followsData.filter(
        (follow) => follow.collection.collectionTypeId === ct.id,
      );
      return {
        id: ct.id,
        title: ct.name,
        icon: ct.icon,
        totalCount: items.length, // total number of follows
        data: expandedSections.has(ct.id) ? items : [], // only expanded items
      };
    });

  return (
    <View style={[rootViewStyle(), { flex: 1, padding: 0 }]}>
      {/*<FlatList
        data={isFetching ? [] : followsData}
        keyExtractor={(item) => item.collection.id}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 10 }}>
            <FeedSearchCollectionCard
              currentUser={user!}
              collectionSearch={item}
              closeOverlay={() => {}}
            />
          </View>
        )}
        ListHeaderComponent={
          <View
            style={{
              width: "100%",
              backgroundColor: customTheme.colors.background,
            }}
          >
            <CustomText
              style={{ fontSize: 18, marginBottom: 5, paddingHorizontal: 10 }}
            >{`You follow ${followsData.length} collections`}</CustomText>
          </View>
        }
        stickyHeaderIndices={[0]}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListFooterComponent={
          <CustomText
            style={{
              textAlign: "center",
              fontFamily: "VendSansItalic",
              marginTop: 20,
            }}
          >
            End of results
          </CustomText>
        }
        ListEmptyComponent={isFetching ? <Loading /> : null}
      />
*/}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.collection.id}
        renderItem={({ item }) => (
          <View style={{ marginLeft: 30, marginRight: 10, marginVertical: 10 }}>
            <FeedSearchCollectionCard
              currentUser={user!}
              collectionSearch={item}
              closeOverlay={() => {}}
            />
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <TouchableOpacity
            onPress={() => toggleSection(section.id)}
            style={{
              width: "100%",
              flexDirection: "row",
              justifyContent: "space-between",
              backgroundColor: customTheme.colors.secondary,
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderColor: customTheme.colors.primary,
            }}
          >
            <View style={{ flexDirection: "row", gap: 5 }}>
              <Image
                source={{
                  uri: `${endpoints.icons}/${section.icon}`,
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                  cache: "reload",
                }}
                style={{
                  width: 28,
                  height: 28,
                }}
              />
              <CustomText style={{ fontSize: 18 }}>
                {section.title} {expandedSections.has(section.id) ? "▲" : "▼"}
              </CustomText>
            </View>
            <CustomText>{`(${section.totalCount})`}</CustomText>
          </TouchableOpacity>
        )}
        ListHeaderComponent={
          <View
            style={{
              width: "100%",
              backgroundColor: customTheme.colors.background,
            }}
          >
            <CustomText
              style={{
                fontSize: 20,
                fontFamily: "VendSansBold",
                marginBottom: 5,
                paddingHorizontal: 10,
              }}
            >{`You follow ${followsData.length} collections`}</CustomText>
          </View>
        }
        stickySectionHeadersEnabled={true}
        ListFooterComponent={
          <CustomText
            style={{
              textAlign: "center",
              fontFamily: "VendSansItalic",
              marginTop: 20,
            }}
          >
            End of results
          </CustomText>
        }
        ListEmptyComponent={isFetching ? <Loading /> : null}
      />
    </View>
  );
}

export default MyFollows;
