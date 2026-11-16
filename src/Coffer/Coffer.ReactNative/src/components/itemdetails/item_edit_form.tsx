import { endpoints } from "@/src/const/endpoints";
import { languageFilter, textInputRegex } from "@/src/const/filter";
import { querykeys } from "@/src/const/querykeys";
import { stringResource } from "@/src/const/resource";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useUpdateData } from "@/src/hooks/data_hooks";
import { useItemStore } from "@/src/hooks/item_store";
import { colors, spacing, typography } from "@/src/theme/theme";
import { useTranslation } from "react-i18next";
import { Item, ItemProvided } from "@/src/types/entities/item";
import {
  getItemAttributeValue,
  getItemPrimaryAttributeValue,
  stringHasValue,
  updateItemAttributeValue,
} from "@/src/utils/data_access_utils";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { SectionHeader } from "../custom_ui/card";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import CustomButton from "../custom_ui/custom_button";
import CustomOverlay from "../custom_ui/custom_overlay";
import CustomTextInput from "../custom_ui/custom_text_input";
import ItemEditDynamicFields from "./item_edit_dynamic_fields";
import ItemEditQuantity from "./item_edit_quantity";
import ItemEditTags from "./item_edit_tags";

interface ItemEditFormProps {
  isItemEditFormOverlayOpen: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
}

function ItemEditForm({ isItemEditFormOverlayOpen }: ItemEditFormProps) {
  const { t } = useTranslation();
  const { collection } = useCollectionStore();
  const { mutateAsync: updateItem, isPending: isItemUpdatePending } =
    useUpdateData<Item, ItemProvided>(
      endpoints.items,
      `${querykeys.itemsData}${collection!.id}`,
    );

  const { item, setItem } = useItemStore();

  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  const [draftItem, setDraftItem] = useState(item);

  const [isQuantityPressed, setIsQuantityPressed] = useState(false);

  const handleEditOverlayClose = () => {
    if (!isItemUpdatePending) isItemEditFormOverlayOpen.set(false);
  };
  const handleUpdate = async () => {
    try {
      const response = await updateItem({ id: draftItem.id, value: draftItem });
      setItem(response);
    } catch (error) {
      console.error("Failed to update item", error);
    } finally {
      handleEditOverlayClose();
    }
  };

  const handleEditPress = async () => {
    await handleUpdate();
  };

  useEffect(() => {
    if (!isItemEditFormOverlayOpen.value) return;

    setDraftItem(item);
    setFieldErrors({});
    setDescriptionErrorMessage("");
    setIsQuantityPressed(false);
  }, [isItemEditFormOverlayOpen, item]);

  const primaryAttribute = getItemPrimaryAttributeValue(item.itemAttributes);

  const isError = Object.values(fieldErrors).some(Boolean);

  const [descriptionErrorMessage, setDescriptionErrorMessage] = useState("");

  const checkDescriptionInput = (newValue: string) => {
    let errorMessage = "";
    if (!textInputRegex.test(newValue)) {
      errorMessage = stringResource.textInputRegexError;
    } else if (languageFilter.isProfane(newValue)) {
      errorMessage = stringResource.profaneError;
    }
    setDescriptionErrorMessage(errorMessage);
    setFieldErrors((prev) => ({
      ...prev,
      ["description"]: !!errorMessage,
    }));
  };

  if (!primaryAttribute) {
    throw Error("No primary attribute found");
  }

  const handleDescriptionChange = (newValue: string) => {
    const descriptionValue = stringHasValue(newValue) ? newValue : undefined;
    if (descriptionValue) {
      checkDescriptionInput(newValue);
    }
    setDraftItem((prev) => ({
      ...prev,
      description: descriptionValue,
    }));
  };

  const handlePrivateNoteChange = (newValue: string) => {
    const privateNoteValue = stringHasValue(newValue) ? newValue : undefined;
    setDraftItem((prev) => ({
      ...prev,
      privateNote: privateNoteValue,
    }));
  };

  return (
    <CustomOverlay
      isVisible={isItemEditFormOverlayOpen.value}
      onClose={handleEditOverlayClose}
      overlayTitle={t("items:edit.title")}
      footerContent={
        <CustomButton
          title={t("collections:edit.save")}
          loading={isItemUpdatePending}
          onPress={handleEditPress}
          disabled={isError}
        />
      }
    >
      <KeyboardAwareScrollView
        enableOnAndroid
        extraScrollHeight={120}
        enableResetScrollToCoords={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ padding: spacing.md, paddingTop: 0, gap: spacing.md }}>
          <SectionHeader title={t("items:edit.basics")} />
          <ItemEditDynamicFields
            attribute={primaryAttribute.itemAttribute.attribute}
            defaultValue={primaryAttribute.value!}
            onValueChange={(newValue) => {
              setDraftItem((prev) => ({
                ...prev,
                itemAttributes: prev.itemAttributes.map((itemAttribute) =>
                  itemAttribute.attribute.id ===
                  primaryAttribute.itemAttribute.attribute.id
                    ? updateItemAttributeValue(itemAttribute, newValue)
                    : itemAttribute,
                ),
              }));
            }}
            onErrorChange={(hasError) => {
              setFieldErrors((prev) => ({
                ...prev,
                [primaryAttribute.itemAttribute.attribute.id]: hasError,
              }));
            }}
          />
          <ItemEditQuantity
            defaultValue={item.quantity}
            onValueChange={(newValue) => {
              setDraftItem((prev) => ({
                ...prev,
                quantity: newValue,
              }));
              setIsQuantityPressed(true);
            }}
          />
          {draftItem.quantity === 1 && isQuantityPressed ? (
            <Text style={[typography.caption, { color: colors.textMuted }]}>{t("items:edit.minQuantity")}</Text>
          ) : null}
          <SectionHeader title={t("items:edit.notes")} />
          <CustomTextInput
            label={t("items:details.privateNote")}
            helperText={t("items:details.privateNoteHelp")}
            defaultValue={item.privateNote}
            onChangeText={handlePrivateNoteChange}
            multiline
          />
          <CustomTextInput
            label={t("items:details.description")}
            helperText={t("items:details.descriptionHelp")}
            defaultValue={item.description}
            onChangeText={handleDescriptionChange}
            multiline
            errorMessage={descriptionErrorMessage}
          />
          {item.itemAttributes.length > 1 ? <SectionHeader title={t("items:details.attributes")} /> : null}
          {item.itemAttributes.map((itemAttribute) =>
            itemAttribute.attribute.id ===
            primaryAttribute.itemAttribute.attribute.id ? null : (
              <ItemEditDynamicFields
                key={itemAttribute.attribute.id}
                attribute={itemAttribute.attribute}
                defaultValue={getItemAttributeValue(itemAttribute).value!}
                onValueChange={(newValue) => {
                  setDraftItem((prev) => ({
                    ...prev,
                    itemAttributes: prev.itemAttributes.map((attr) =>
                      attr.attribute.id === itemAttribute.attribute.id
                        ? updateItemAttributeValue(attr, newValue)
                        : attr,
                    ),
                  }));
                }}
                onErrorChange={(hasError) => {
                  setFieldErrors((prev) => ({
                    ...prev,
                    [itemAttribute.attribute.id]: hasError,
                  }));
                }}
              />
            ),
          )}
          <ItemEditTags
            defaultValue={item.itemTags}
            onValueChange={(newValues) =>
              setDraftItem((prev) => ({
                ...prev,
                itemTags: newValues,
              }))
            }
            onErrorChange={(hasError) => {
              setFieldErrors((prev) => ({
                ...prev,
                ["itemTags"]: hasError,
              }));
            }}
            itemId={item.id}
          />
        </View>
      </KeyboardAwareScrollView>
    </CustomOverlay>
  );
}

export default ItemEditForm;
