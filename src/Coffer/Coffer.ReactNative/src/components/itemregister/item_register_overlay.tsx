import { tempItemId } from "@/src/const/emptyItem";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCreateData } from "@/src/hooks/data_hooks";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { useTranslation } from "react-i18next";
import CustomButton from "../custom_ui/custom_button";
import { EmptyState, ErrorState } from "../custom_ui/states";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Collection } from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import ImageCheck from "@/src/types/entities/imagecheck";
import { ItemsCreate } from "@/src/types/helpers/items_create";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import { Modal, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import CustomPagination from "../custom_ui/custom_pagination";
import { Loading } from "../custom_ui/loading";
import ItemRegisterCard from "./item_register_card";

interface ItemRegisterOverlayProps {
  collectionType: CollectionType;
  collection: Collection;
  isItemRegisterOverlayOpen: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
  asset: {
    value: ImagePicker.ImagePickerAsset | null;
    set: React.Dispatch<
      React.SetStateAction<ImagePicker.ImagePickerAsset | null>
    >;
  };
}

function ItemRegisterOverlay({
  collectionType,
  collection,
  isItemRegisterOverlayOpen,
  asset,
}: ItemRegisterOverlayProps) {
  const { t } = useTranslation();
  const {
    mutateAsync: doImageCheck,
    isPending: isDoImageCheckPending,
    isError: isDoImageCheckError,
    isSuccess: isDoImageCheckSuccess,
  } = useCreateData<FormData, ImageCheck[]>(
    `${endpoints.itemsImageCheck}/${collection.id}`,
    undefined,
    t("items:register.checked"),
    undefined,
    {
      "Content-Type": "multipart/form-data",
    },
  );

  const { mutateAsync: upsertItems, isPending: isUpsertItemsPending } =
    useCreateData<ItemsCreate[]>(
      `${endpoints.itemsUpsert}`,
      `${querykeys.itemsData}${collection.id}`,
      t("items:register.saved"),
      t("items:register.saveFailed"),
    );

  const [imageCheckResponse, setImageCheckResponse] = useState<ImageCheck[]>(
    [],
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
        : [...prev, newItem],
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
    if (!asset.value) return;

    const uploadImage = async () => {
      const formData = new FormData();
      formData.append("file", {
        uri: asset.value!.uri,
        name: asset.value!.fileName ?? "upload.jpg",
        type: asset.value!.mimeType ?? "image/jpeg",
      } as any);

      try {
        const response = await doImageCheck({ value: formData });
        setImageCheckResponse(response);
        if (response.length > 0) setSelectedImageCheckIndex(0);
      } catch {
        // The mutation's onError already shows the translated error toast; the screen shows the failed state.
      }
    };

    uploadImage();
  }, [asset.value]);

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
    if (submittedItems.length > 0) {
      try {
        await upsertItems({ value: remapItemsCreated(submittedItems) });
      } catch (error) {
        console.log(error);
      }
    }
    asset.set(null);
    isItemRegisterOverlayOpen.set(false);
  };

  const centered = (children: React.ReactNode) => (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg, gap: spacing.sm }}>{children}</View>
  );

  return (
    // Back does nothing here on purpose: leaving must go through Finish, which uploads the chosen items.
    <Modal visible={isItemRegisterOverlayOpen.value} onRequestClose={() => {}} animationType="slide" statusBarTranslucent navigationBarTranslucent>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          {isDoImageCheckPending ? (
            centered(<Loading label={t("items:register.checkingImage")} />)
          ) : isUpsertItemsPending ? (
            centered(<Loading label={t("items:register.saving")} />)
          ) : (
            <View style={{ flex: 1 }}>
              <View style={{ borderBottomWidth: borders.width, borderBottomColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Text accessibilityRole="header" style={[typography.headline, { color: colors.text, flex: 1 }]} numberOfLines={2}>
                    {t("items:register.reviewTitle")}
                  </Text>
                  <CustomButton
                    title={t("items:register.finish")}
                    size="sm"
                    icon={<MaterialIcons name="check" size={18} color={colors.onPrimary} />}
                    onPress={() => handleFinnish()}
                    containerStyle={{ alignSelf: "center" }}
                  />
                </View>
                {imageCheckResponse.length > 0 ? (
                  <CustomPagination
                    totalItems={imageCheckResponse.length}
                    pageSize={1}
                    currentPage={isListEndReached ? undefined : selectedImageCheckIndex + 1}
                    onPageChange={handlePagePress}
                    pagesToDisplay={2}
                    allowOverNext
                    pageIcon={(page) =>
                      submittedItemIsIdPresent(imageCheckResponse[page - 1].id)
                        ? { name: "check", color: colors.success }
                        : { name: "close", color: colors.danger }
                    }
                  />
                ) : null}
              </View>

              <View style={{ flex: 1 }}>
                {isDoImageCheckError ? (
                  <ErrorState message={t("items:register.checkFailed")} />
                ) : isDoImageCheckSuccess ? (
                  imageCheckResponse.length === 0 ? (
                    <EmptyState icon="image-search" title={t("items:register.noneFound")} text={t("items:register.noneFoundHint")} />
                  ) : isListEndReached ? (
                    centered(
                      <>
                        <MaterialIcons name="flag" size={40} color={colors.secondary} />
                        <Text style={[typography.title, { color: colors.text, textAlign: "center" }]}>{t("items:register.endTitle")}</Text>
                        <Text style={[typography.body, { color: colors.text, textAlign: "center" }]}>{t("items:register.endText")}</Text>
                        <View style={{ gap: spacing.xs, alignSelf: "stretch" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                            <MaterialIcons name="check-box" size={20} color={colors.success} />
                            <Text style={[typography.meta, { color: colors.text, flex: 1 }]}>{t("items:register.legendUpload")}</Text>
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                            <MaterialIcons name="disabled-by-default" size={20} color={colors.danger} />
                            <Text style={[typography.meta, { color: colors.text, flex: 1 }]}>{t("items:register.legendSkip")}</Text>
                          </View>
                        </View>
                      </>,
                    )
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
                      itemsCreate={findSubmittedItem(imageCheckResponse[selectedImageCheckIndex].id)}
                    />
                  ) : null
                ) : null}
              </View>
            </View>
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

export default ItemRegisterOverlay;
