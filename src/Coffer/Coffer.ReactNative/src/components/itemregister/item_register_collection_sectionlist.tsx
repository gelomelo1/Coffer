import { endpoints } from "@/src/const/endpoints";
import { useCollectionTypeStore } from "@/src/hooks/collection_type_store";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import { Image, SectionList, Text, TouchableOpacity, View } from "react-native";
import { Overlay } from "react-native-elements";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomText from "../custom_ui/custom_text";

interface ItemRegisterCollectionSectionListProps {
  isItemRegisterCollectionSectionListOverlayOpen: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };

  selectedCollection: {
    value: Collection | null;
    set: React.Dispatch<React.SetStateAction<Collection | null>>;
  };

  collections: Collection[];
}

function ItemRegisterCollectionSectionList({
  isItemRegisterCollectionSectionListOverlayOpen,
  selectedCollection,
  collections,
}: ItemRegisterCollectionSectionListProps) {
  const { collectionTypes } = useCollectionTypeStore();
  const { token } = useUserStore();

  const existingCollectionTypeIds = Array.from(
    new Set(collections.map((collection) => collection.collectionTypeId)),
  );

  const handleClose = () => {
    isItemRegisterCollectionSectionListOverlayOpen.set(false);
  };

  const handleCollectionPress = (collection: Collection) => {
    selectedCollection.set(collection);
    isItemRegisterCollectionSectionListOverlayOpen.set(false);
  };

  const sections = collectionTypes
    .filter((ct) => existingCollectionTypeIds.includes(ct.id))
    .map((ct) => {
      const items = collections.filter(
        (collection) => collection.collectionTypeId === ct.id,
      );
      return {
        id: ct.id,
        title: ct.name,
        icon: ct.icon,
        data: items,
      };
    });

  return (
    <Overlay
      isVisible={isItemRegisterCollectionSectionListOverlayOpen.value}
      fullScreen
      overlayStyle={{ backgroundColor: customTheme.colors.background }}
      onBackdropPress={handleClose}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            paddingHorizontal: 10,
          }}
        >
          <CustomText style={{ fontSize: 18, fontFamily: "VendSansBold" }}>
            Choose a collection...
          </CustomText>
          <Text
            style={{
              color: customTheme.colors.primary,
              fontSize: 24,
              fontWeight: "bold",
            }}
            onPress={handleClose}
          >
            ✕
          </Text>
        </View>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item, section }) => (
            <View
              style={{ marginLeft: 30, marginRight: 10, marginVertical: 10 }}
            >
              <TouchableOpacity
                style={{
                  height: 48,
                  justifyContent: "flex-start",
                  alignItems: "center",
                  flexDirection: "row",
                  gap: 10,
                }}
                onPress={() => handleCollectionPress(item)}
              >
                <Image
                  source={{
                    uri: item.image
                      ? `${endpoints.collectionsCoverImage}/${item.image}`
                      : `${endpoints.icons}/${section.icon}`,
                    headers: {
                      Authorization: `Bearer ${token}`,
                    },
                    cache: "reload",
                  }}
                  style={{
                    height: item.image ? "100%" : 20,
                    aspectRatio: "1/1",
                  }}
                />
                <CustomText style={{ fontFamily: "VendSansBold" }}>
                  {item.name}
                </CustomText>
              </TouchableOpacity>
            </View>
          )}
          renderSectionHeader={({ section }) => (
            <View
              style={{ paddingHorizontal: 10, flexDirection: "row", gap: 5 }}
            >
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
              <CustomText style={{ fontSize: 20 }}>{section.title}</CustomText>
            </View>
          )}
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
          ListEmptyComponent={<CustomText>No collections found.</CustomText>}
        />
      </SafeAreaView>
    </Overlay>
  );
}

export default ItemRegisterCollectionSectionList;
