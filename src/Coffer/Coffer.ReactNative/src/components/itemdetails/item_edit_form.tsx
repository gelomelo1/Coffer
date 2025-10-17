import { endpoints } from "@/src/const/endpoints";
import { languageFilter, textInputRegex } from "@/src/const/filter";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { querykeys } from "@/src/const/querykeys";
import { stringResource } from "@/src/const/resource";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useUpdateData } from "@/src/hooks/data_hooks";
import { useItemStore } from "@/src/hooks/item_store";
import { useResetNavigation } from "@/src/hooks/navigation";
import { customTheme } from "@/src/theme/theme";
import { Item, ItemProvided } from "@/src/types/entities/item";
import {
  getItemAttributeValue,
  getItemPrimaryAttributeValue,
  updateItemAttributeValue,
} from "@/src/utils/data_access_utils";
import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { Overlay } from "react-native-elements";
import CustomButton from "../custom_ui/custom_button";
import CustomText from "../custom_ui/custom_text";
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
  const resetNavigate = useResetNavigation();
  const { collection } = useCollectionStore();
  const { mutateAsync: updateItem, isPending: isItemUpdatePending } =
    useUpdateData<Item, ItemProvided>(
      endpoints.items,
      `${querykeys.itemsData}${collection.id}`
    );

  const { item, setItem } = useItemStore();

  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  const [draftItem, setDraftItem] = useState(item);

  const [isDeleteConfirmOverlayOpen, setIsDeleteConfirmOverlayOpen] =
    useState(false);

  const handleEditOverlayClose = () => {
    if (!isItemUpdatePending && !isDeleteConfirmOverlayOpen)
      isItemEditFormOverlayOpen.set(false);
  };

  const handleDeleteOverlayClose = () => {
    setIsDeleteConfirmOverlayOpen(false);
  };

  const handleUpdate = async (isDelete: boolean) => {
    try {
      const response = await updateItem({ id: draftItem.id, value: draftItem });
      if (!isDelete) setItem(response);
    } catch (error) {
      console.error("Failed to update item", error);
    } finally {
      handleEditOverlayClose();
    }
  };

  const handleDeleteConfirm = async () => {
    handleDeleteOverlayClose();
    await handleUpdate(true);
    resetNavigate({
      pathname: ROUTES.COLLECTIONS.MYCOLLECTION,
      params: pageParams.mycollection,
    });
  };

  const handleEditPress = async () => {
    console.log(draftItem);
    if (draftItem.quantity === 0) setIsDeleteConfirmOverlayOpen(true);
    else await handleUpdate(false);
  };

  useEffect(() => {
    if (!isItemEditFormOverlayOpen.value) return;

    setDraftItem(item);
    setFieldErrors({});
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

  return (
    <>
      <Overlay
        isVisible={isDeleteConfirmOverlayOpen}
        onBackdropPress={handleEditOverlayClose}
        overlayStyle={{
          width: "90%",
          backgroundColor: customTheme.colors.background,
        }}
      >
        <CustomText>
          You set the item quantity to 0. This will delete the item. Are you
          sure you want to continue?
        </CustomText>
        <CustomButton
          title={"Cancel"}
          onPress={handleDeleteOverlayClose}
          containerStyle={{ marginBottom: 10 }}
        />
        <CustomButton title={"Confirm"} onPress={handleDeleteConfirm} />
      </Overlay>
      <Overlay
        isVisible={isItemEditFormOverlayOpen.value}
        onBackdropPress={handleEditOverlayClose}
        overlayStyle={{
          width: "90%",
          maxHeight: "80%",
          backgroundColor: customTheme.colors.background,
        }}
      >
        <ScrollView
          style={{ width: "100%" }}
          contentContainerStyle={{
            justifyContent: "center",
            gap: 20,
            paddingHorizontal: 4,
          }}
        >
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
                    : itemAttribute
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
          <CustomTextInput
            label="Description"
            defaultValue={item.description}
            onChangeText={(newValue) => {
              checkDescriptionInput(newValue);
              setDraftItem((prev) => ({
                ...prev,
                description: newValue,
              }));
            }}
            style={{ height: 100 }}
            inputContainerStyle={{ height: 100 }}
            multiline
            errorMessage={descriptionErrorMessage}
          />
          <ItemEditQuantity
            defaultValue={item.quantity}
            onValueChange={(newValue) => {
              setDraftItem((prev) => ({
                ...prev,
                quantity: newValue,
              }));
            }}
          />
          {draftItem.quantity === 0 ? (
            <CustomText
              style={{ fontSize: 12, color: customTheme.colors.accent }}
            >
              Setting the item quantity to 0 will remove it from your list
            </CustomText>
          ) : null}
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
                        : attr
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
            )
          )}
          <ItemEditTags
            defaultValue={item.itemTags}
            onValueChange={(newValues) =>
              setDraftItem((prev) => ({
                ...prev,
                itemTags: newValues,
              }))
            }
            itemId={item.id}
          />
          <CustomButton
            title="Edit item"
            containerStyle={{ marginTop: 20 }}
            loading={isItemUpdatePending}
            onPress={handleEditPress}
            disabled={isError}
          />
        </ScrollView>
      </Overlay>
    </>
  );
}

export default ItemEditForm;
