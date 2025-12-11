import { tempItemId } from "@/src/const/emptyItem";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCreateData } from "@/src/hooks/data_hooks";
import { customTheme } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import ImageCheck from "@/src/types/entities/imagecheck";
import { ItemsCreate } from "@/src/types/helpers/items_create";
import Entypo from "@expo/vector-icons/Entypo";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { Overlay } from "react-native-elements";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomPagination from "../custom_ui/custom_pagination";
import CustomText from "../custom_ui/custom_text";
import { Loading } from "../custom_ui/loading";
import ItemRegisterCard from "./item_register_card";

interface ItemRegisterOverlayProps {
  collectionType: CollectionType;
  collection: Collection;
  isImagePickerLoading: "Gallery" | "Camera" | null;
  isItemRegisterOverlayOpen: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
  asset: ImagePicker.ImagePickerAsset | null;
}

function ItemRegisterOverlay({
  collectionType,
  collection,
  isImagePickerLoading,
  isItemRegisterOverlayOpen,
  asset,
}: ItemRegisterOverlayProps) {
  const {
    mutateAsync: doImageCheck,
    isPending: isDoImageCheckPending,
    isError: isDoImageCheckError,
    isSuccess: isDoImageCheckSuccess,
  } = useCreateData<FormData, ImageCheck[]>(
    `${endpoints.itemsImageCheck}/${collection.id}`,
    undefined,
    "Successfully checked",
    undefined,
    {
      "Content-Type": "multipart/form-data",
    }
  );

  const { mutateAsync: upsertItems, isPending: isUpsertItemsPending } =
    useCreateData<ItemsCreate[]>(
      `${endpoints.itemsUpsert}`,
      `${querykeys.itemsData}${collection.id}`,
      "Items successfully created and updated",
      "Create and Update Failed"
    );

  const [imageCheckResponse, setImageCheckResponse] = useState<ImageCheck[]>(
    []
  );

  const [selectedImageCheckIndex, setSelectedImageCheckIndex] =
    useState<number>(0);

  const selectedImageCheck = imageCheckResponse[selectedImageCheckIndex];

  const [submittedItems, setSubmittedItems] = useState<ItemsCreate[]>([]);

  const [isListEndReached, setIsListEndReached] = useState(false);

  const handleAddSubittedItem = (newItem: ItemsCreate) => {
    setSubmittedItems((prev) =>
      prev.some((x) => x.id === newItem.id)
        ? prev.map((x) => (x.id === newItem.id ? newItem : x))
        : [...prev, newItem]
    );
  };

  const handleRemoveSubittedItem = (id: string) => {
    setSubmittedItems((prev) => prev.filter((x) => x.id !== id));
  };

  const submittedItemIsIdPresent = (id: string) => {
    return !!submittedItems.find((item) => item.id === id);
  };

  const findSubmittedItem = (id: string) => {
    return submittedItems.find((item) => item.id === id);
  };

  const remapItemsCreated = (itemCreates: ItemsCreate[]) => {
    return itemCreates.map((ic) => ({
      ...ic,
      id: ic.item?.id && ic.item.id !== tempItemId ? ic.item.id : ic.id,
    })) as ItemsCreate[];
  };

  useEffect(() => {
    if (!isItemRegisterOverlayOpen.value) {
      setIsListEndReached(false);
      setSubmittedItems([]);
      setImageCheckResponse([]);
      setSelectedImageCheckIndex(0);
    }
  }, [isItemRegisterOverlayOpen.value]);

  useEffect(() => {
    if (!asset) return;

    const uploadImage = async () => {
      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: asset.fileName ?? "upload.jpg",
        type: asset.mimeType ?? "image/jpeg",
      } as any);

      const response = await doImageCheck({
        value: formData,
      });

      setImageCheckResponse(response);
      if (response.length > 0) setSelectedImageCheckIndex(0);
    };

    uploadImage();
  }, [asset]);

  const handleNextItem = () => {
    if (imageCheckResponse.length - 1 > selectedImageCheckIndex)
      setSelectedImageCheckIndex((prev) => prev + 1);
    else setIsListEndReached(true);
  };

  const handlePagePress = (page: number) => {
    if (page > imageCheckResponse.length) {
      setIsListEndReached(true);
    } else {
      setSelectedImageCheckIndex(page - 1);
      setIsListEndReached(false);
    }
  };

  const handleFinnish = async () => {
    console.log(JSON.stringify(remapItemsCreated(submittedItems)));
    if (submittedItems.length > 0) {
      try {
        await upsertItems({ value: remapItemsCreated(submittedItems) });
      } catch (error) {
        console.log(error);
      }
    }
    isItemRegisterOverlayOpen.set(false);
  };

  return (
    <Overlay
      isVisible={isItemRegisterOverlayOpen.value}
      fullScreen
      overlayStyle={{ backgroundColor: customTheme.colors.background }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        {isImagePickerLoading ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <CustomText>{isImagePickerLoading}</CustomText>
            <Loading />
          </View>
        ) : isDoImageCheckPending ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <CustomText>{"Checking image"}</CustomText>
            <Loading />
          </View>
        ) : isUpsertItemsPending ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <CustomText>{"Creating and updating items"}</CustomText>
            <Loading />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <View
              style={{
                width: "100%",
                borderRightWidth: 2,
                borderBottomWidth: 2,
                borderColor: customTheme.colors.primary,
                justifyContent: "space-between",
                alignItems: "center",
                flexDirection: "row",
              }}
            >
              <CustomPagination
                totalItems={imageCheckResponse.length}
                pageSize={1}
                currentPage={
                  isListEndReached ? undefined : selectedImageCheckIndex + 1
                }
                onPageChange={handlePagePress}
                pagesToDisplay={2}
                allowOverNext
                pageChangeBtnStyle={{
                  backgroundColor: customTheme.colors.primary,
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                }}
                pageChangeTextStyle={{
                  fontSize: 12,
                  color: customTheme.colors.secondary,
                }}
                btnStyle={(page) => ({
                  backgroundColor: submittedItemIsIdPresent(
                    imageCheckResponse[page - 1].id
                  )
                    ? "green"
                    : "red",
                  paddingVertical: 3,
                  paddingHorizontal: 8,
                })}
                textStyle={{
                  fontSize: 12,
                  color: "black",
                }}
                activeBtnStyle={{
                  backgroundColor: customTheme.colors.secondary,
                }}
                activeTextStyle={{ color: customTheme.colors.primary }}
              />
              <TouchableOpacity
                style={{
                  alignSelf: "flex-end",
                  margin: 16,
                  justifyContent: "center",
                  alignItems: "center",
                  flexDirection: "row",
                }}
                onPress={() => handleFinnish()}
              >
                <CustomText
                  style={{
                    fontFamily: "VendSansBold",
                    color: "green",
                    fontSize: 24,
                  }}
                >
                  Finish
                </CustomText>
                <Entypo name="check" size={24} color="green" />
              </TouchableOpacity>
            </View>

            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {isDoImageCheckError ? (
                <CustomText
                  style={{
                    fontFamily: "VendSansBold",
                    color: "red",
                    fontSize: 20,
                  }}
                >
                  Error during checking the image
                </CustomText>
              ) : isDoImageCheckSuccess ? (
                imageCheckResponse.length === 0 ? (
                  <>
                    <CustomText
                      style={{
                        fontFamily: "VendSansBold",
                        fontSize: 20,
                      }}
                    >
                      No Item Found
                    </CustomText>
                    <CustomText
                      style={{
                        fontFamily: "VendSansItalic",
                        textAlign: "center",
                      }}
                    >
                      Try taking a closer picture of the item, and make sure the
                      lighting is good
                    </CustomText>
                  </>
                ) : (
                  <View
                    style={{
                      position: "relative",
                      flex: 1,
                      width: "100%",
                    }}
                  >
                    {isListEndReached ? (
                      <View
                        style={{
                          flex: 1,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <CustomText
                          style={{
                            fontFamily: "VendSansBold",
                            fontSize: 20,
                          }}
                        >
                          List End Reached
                        </CustomText>
                        <CustomText>
                          Click{" "}
                          <CustomText style={{ fontFamily: "VendSansBold" }}>
                            Finish
                          </CustomText>{" "}
                          when done. To adjust the list, go back.{" "}
                          <CustomText style={{ color: "red" }}>Red</CustomText>{" "}
                          page button means the change won’t upload;{" "}
                          <CustomText style={{ color: "green" }}>
                            green
                          </CustomText>{" "}
                          means it will.
                        </CustomText>
                      </View>
                    ) : selectedImageCheck ? (
                      <ItemRegisterCard
                        collectionType={collectionType}
                        collection={collection}
                        selectedImageCheckIndex={selectedImageCheckIndex}
                        imageCheck={selectedImageCheck}
                        handleAddItemsCreateChange={(item) => {
                          handleAddSubittedItem(item);
                          handleNextItem();
                        }}
                        handleRemoveItemsCreateChange={(id) => {
                          handleRemoveSubittedItem(id);
                          handleNextItem();
                        }}
                        itemsCreate={findSubmittedItem(
                          imageCheckResponse[selectedImageCheckIndex].id
                        )}
                      />
                    ) : null}
                  </View>
                )
              ) : null}
            </View>
          </View>
        )}
      </SafeAreaView>
    </Overlay>
  );
}

export default ItemRegisterOverlay;
