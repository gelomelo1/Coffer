import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useGetData } from "@/src/hooks/data_hooks";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Overlay } from "react-native-elements";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomText from "../custom_ui/custom_text";
import CustomTextInput from "../custom_ui/custom_text_input";
import { Loading } from "../custom_ui/loading";
import ItemRegisterCollectionSectionList from "./item_register_collection_sectionlist";

interface ItemRegisterCollectionSelectOverlayProps {
  isItemRegisterCollectionSelectOverlayOpen: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
  selectedCollection: {
    value: Collection | null;
    set: React.Dispatch<React.SetStateAction<Collection | null>>;
  };

  onGalleryPick: () => void;
  onPhotoPick: () => void;
}

function ItemRegisterCollectionSelectOverlay({
  isItemRegisterCollectionSelectOverlayOpen,
  selectedCollection,
  onGalleryPick,
  onPhotoPick,
}: ItemRegisterCollectionSelectOverlayProps) {
  const { user } = useUserStore();

  const { data: collections = [], isFetching: isCollectionsFetching } =
    useGetData<Collection>(endpoints.collections, querykeys.collectionsData, {
      filters: [
        {
          filter: "Match",
          field: "userId",
          value: user!.id,
        },
      ],
    });

  const [
    isItemRegisterCollectionSectionListOverlayOpen,
    setIsItemRegisterCollectionSectionListOverlayOpen,
  ] = useState(false);

  const handleClose = () => {
    selectedCollection.set(null);
    isItemRegisterCollectionSelectOverlayOpen.set(false);
  };

  const handleOpenSectionList = () => {
    setIsItemRegisterCollectionSectionListOverlayOpen(true);
  };

  const isDisabled = !selectedCollection.value;

  return (
    <>
      <Overlay
        isVisible={isItemRegisterCollectionSelectOverlayOpen.value}
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
              marginBottom: 50,
            }}
          >
            <View style={{ flexDirection: "column", gap: 4 }}>
              <CustomText style={{ fontSize: 18, fontFamily: "VendSansBold" }}>
                Add Item & Check Collection
              </CustomText>
              <View style={{ marginLeft: 20 }}>
                <CustomText>I. Select a collection</CustomText>
                <CustomText>II. Take a photo or choose from gallery</CustomText>
                <CustomText>
                  The item will be checked for duplicates.
                </CustomText>
              </View>
            </View>
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
          {isCollectionsFetching ? (
            <Loading />
          ) : (
            <View style={{ flex: 1, paddingHorizontal: 20 }}>
              <TouchableOpacity
                style={{
                  width: "100%",
                  padding: 0,
                  paddingBottom: 0,
                  height: 59,
                }}
                onPress={handleOpenSectionList}
              >
                <CustomTextInput
                  placeholder="Choose a collection first..."
                  value={
                    selectedCollection.value
                      ? selectedCollection.value.name
                      : ""
                  }
                  editable={false}
                />
              </TouchableOpacity>
              <View
                style={{
                  flex: 1,
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 50,
                }}
              >
                <TouchableOpacity disabled={isDisabled} onPress={onPhotoPick}>
                  <View
                    style={{
                      height: 100,
                      width: 100,
                      backgroundColor: customTheme.colors.primary,
                      borderWidth: 2,
                      borderColor: customTheme.colors.secondary,
                      borderRadius: 20,
                      justifyContent: "center",
                      alignItems: "center",
                      marginBottom: 10,
                      alignSelf: "center",
                      opacity: isDisabled ? 0.4 : 1,
                    }}
                  >
                    <FontAwesome
                      name="camera"
                      size={50}
                      color={customTheme.colors.secondary}
                    />
                  </View>
                  <CustomText
                    style={{ fontSize: 18, opacity: isDisabled ? 0.4 : 1 }}
                  >
                    Take a photo
                  </CustomText>
                </TouchableOpacity>

                <TouchableOpacity disabled={isDisabled} onPress={onGalleryPick}>
                  <View
                    style={{
                      height: 100,
                      width: 100,
                      backgroundColor: customTheme.colors.primary,
                      borderWidth: 2,
                      borderColor: customTheme.colors.secondary,
                      borderRadius: 20,
                      justifyContent: "center",
                      alignItems: "center",
                      marginBottom: 10,
                      alignSelf: "center",
                      opacity: isDisabled ? 0.4 : 1,
                    }}
                  >
                    <MaterialIcons
                      name="image"
                      size={50}
                      color={customTheme.colors.secondary}
                    />
                  </View>
                  <CustomText
                    style={{ fontSize: 18, opacity: isDisabled ? 0.4 : 1 }}
                  >
                    Choose from gallery
                  </CustomText>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Overlay>
      <ItemRegisterCollectionSectionList
        isItemRegisterCollectionSectionListOverlayOpen={{
          value: isItemRegisterCollectionSectionListOverlayOpen,
          set: setIsItemRegisterCollectionSectionListOverlayOpen,
        }}
        selectedCollection={{
          value: selectedCollection.value,
          set: selectedCollection.set,
        }}
        collections={collections}
      />
    </>
  );
}

export default ItemRegisterCollectionSelectOverlay;
