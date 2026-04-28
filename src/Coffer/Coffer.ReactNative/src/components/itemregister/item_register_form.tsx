import { endpoints } from "@/src/const/endpoints";
import { languageFilter, textInputRegex } from "@/src/const/filter";
import { querykeys } from "@/src/const/querykeys";
import { stringResource } from "@/src/const/resource";
import { useGetData } from "@/src/hooks/data_hooks";
import { customTheme } from "@/src/theme/theme";
import Attribute from "@/src/types/entities/attribute";
import CollectionType from "@/src/types/entities/collectiontype";
import { Item } from "@/src/types/entities/item";
import ItemAttribute from "@/src/types/entities/item_attribute";
import { AttributeDataTypes } from "@/src/types/helpers/attribute_data";
import {
  getDefaultAttributeValue,
  getItemAttributeValue,
  stringHasValue,
  updateItemAttributeValue,
} from "@/src/utils/data_access_utils";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import CustomText from "../custom_ui/custom_text";
import CustomTextInput from "../custom_ui/custom_text_input";
import { Loading } from "../custom_ui/loading";
import ItemEditDynamicFields from "../itemdetails/item_edit_dynamic_fields";
import ItemEditTags from "../itemdetails/item_edit_tags";

interface ItemRegisterFormProps {
  collectionType: CollectionType;
  newItem: {
    value: { item: Item; version: Date };
    set: React.Dispatch<React.SetStateAction<{ item: Item; version: Date }>>;
  };
  setIsError: (isError: boolean) => void;
}

function ItemRegisterForm({
  collectionType,
  newItem,
  setIsError,
}: ItemRegisterFormProps) {
  const { data: attributes = [], isFetching: isAttributesFetching } =
    useGetData<Attribute>(
      endpoints.attributes,
      `${querykeys.attributesData}${collectionType.id}`,
      {
        filters: [
          {
            filter: "==",
            field: "collectionTypeId",
            value: collectionType.id,
          },
        ],
      },
    );

  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  const [draftItem, setDraftItem] = useState(newItem.value.item);

  const [descriptionErrorMessage, setDescriptionErrorMessage] = useState("");

  const primaryAttribute = attributes.find((attribtue) => attribtue.primary);

  const primaryItemAttribute = draftItem.itemAttributes.find(
    (itemAttribute) => itemAttribute.attributeId === primaryAttribute?.id,
  );

  useEffect(() => {
    setDraftItem(newItem.value.item);
  }, [newItem.value.version]);

  useEffect(() => {
    const isError = Object.values(fieldErrors).some(Boolean);
    setIsError(isError);
  }, [fieldErrors]);

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

  const handlePrivateNoteInput = (newValue: string) => {
    const privateNoteContent = stringHasValue(newValue) ? newValue : undefined;

    newItem.set((prev) => ({
      item: {
        ...prev.item,
        description: privateNoteContent,
      },
      version: prev.version,
    }));
  };

  const handleDescriptionInput = (newValue: string) => {
    const descriptionContent = stringHasValue(newValue) ? newValue : undefined;

    if (descriptionContent) {
      checkDescriptionInput(newValue);
    }
    newItem.set((prev) => ({
      item: {
        ...prev.item,
        description: descriptionContent,
      },
      version: prev.version,
    }));
  };

  return isAttributesFetching ? (
    <Loading />
  ) : (
    <View
      style={{ width: "100%", gap: 20 }}
      key={newItem.value.version.toString()}
    >
      <ItemEditDynamicFields
        attribute={primaryAttribute!}
        defaultValue={
          primaryItemAttribute
            ? (getItemAttributeValue(primaryItemAttribute).value as any)
            : getDefaultAttributeValue(primaryAttribute!)
        }
        onValueChange={(newValue) => {
          newItem.set((prev) => {
            const existingAttrIndex = prev.item.itemAttributes.findIndex(
              (ia) => ia.attributeId === primaryAttribute!.id,
            );

            let updatedItemAttributes = [...prev.item.itemAttributes];

            if (existingAttrIndex > -1) {
              updatedItemAttributes[existingAttrIndex] =
                updateItemAttributeValue(
                  updatedItemAttributes[existingAttrIndex],
                  newValue,
                );
            } else {
              updatedItemAttributes.push({
                id: 0,
                itemId: draftItem.id,
                attributeId: primaryAttribute!.id,
                valueString: typeof newValue === "string" ? newValue : null,
                valueNumber: typeof newValue === "number" ? newValue : null,
                valueDate:
                  primaryAttribute!.dataType === AttributeDataTypes.Date
                    ? (newValue as string)
                    : null,
                valueBoolean: typeof newValue === "boolean" ? newValue : null,
                attribute: primaryAttribute!,
              } as ItemAttribute);
            }

            return {
              item: { ...prev.item, itemAttributes: updatedItemAttributes },
              version: prev.version,
            };
          });
        }}
        onErrorChange={(hasError) => {
          setFieldErrors((prev) => ({
            ...prev,
            [primaryAttribute!.id]: hasError,
          }));
        }}
      />
      <CustomTextInput
        label="Private note"
        placeholder="The private note is visible only to you. Use it to store additional information about the item, for example, its location in your physical collection."
        defaultValue={draftItem.privateNote}
        onChangeText={handlePrivateNoteInput}
        style={{ height: 100, marginBottom: 20 }}
        inputContainerStyle={{ height: 100 }}
        multiline
      />
      <CustomTextInput
        label="Description"
        placeholder="The description is public and visible to everyone. It is used to describe your item, similar to a post."
        defaultValue={draftItem.description}
        onChangeText={handleDescriptionInput}
        style={{ height: 100, marginBottom: 20 }}
        inputContainerStyle={{ height: 100 }}
        multiline
        errorMessage={descriptionErrorMessage}
      />
      {draftItem.quantity === 0 ? (
        <CustomText style={{ fontSize: 12, color: customTheme.colors.accent }}>
          Setting the item quantity to 0 will remove it from your list
        </CustomText>
      ) : null}
      {attributes
        .filter((attribute) => attribute.id !== primaryAttribute?.id)
        .map((attribute) => {
          const itemAttr = draftItem.itemAttributes.find(
            (ia) => ia.attributeId === attribute.id,
          );

          const defaultValue = itemAttr
            ? (getItemAttributeValue(itemAttr).value as any)
            : getDefaultAttributeValue(attribute);

          return (
            <ItemEditDynamicFields
              key={attribute.id}
              attribute={attribute}
              defaultValue={defaultValue}
              onValueChange={(newValue) => {
                newItem.set((prev) => {
                  const existingIndex = prev.item.itemAttributes.findIndex(
                    (ia) => ia.attributeId === attribute.id,
                  );

                  const updatedItemAttributes = [...prev.item.itemAttributes];

                  if (existingIndex > -1) {
                    updatedItemAttributes[existingIndex] =
                      updateItemAttributeValue(
                        updatedItemAttributes[existingIndex],
                        newValue,
                      );
                  } else {
                    updatedItemAttributes.push({
                      id: 0,
                      itemId: draftItem.id,
                      attributeId: attribute.id,
                      valueString:
                        typeof newValue === "string" ? newValue : null,
                      valueNumber:
                        typeof newValue === "number" ? newValue : null,
                      valueDate:
                        attribute.dataType === AttributeDataTypes.Date
                          ? (newValue as string)
                          : null,
                      valueBoolean:
                        typeof newValue === "boolean" ? newValue : null,
                      attribute: attribute,
                    } as ItemAttribute);
                  }

                  return {
                    item: {
                      ...prev.item,
                      itemAttributes: updatedItemAttributes,
                    },
                    version: prev.version,
                  };
                });
              }}
              onErrorChange={(hasError) => {
                setFieldErrors((prev) => ({
                  ...prev,
                  [attribute.id]: hasError,
                }));
              }}
            />
          );
        })}
      <ItemEditTags
        defaultValue={draftItem.itemTags}
        onValueChange={(newValues) =>
          newItem.set((prev) => ({
            item: {
              ...prev.item,
              itemTags: newValues,
            },
            version: prev.version,
          }))
        }
        itemId={draftItem.id}
      />
      <View style={{ width: "100%", height: 150 }} />
    </View>
  );
}

export default ItemRegisterForm;
