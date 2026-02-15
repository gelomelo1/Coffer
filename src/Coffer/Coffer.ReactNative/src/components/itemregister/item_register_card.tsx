import { emptyItem, tempItemId } from "@/src/const/emptyItem";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useGetData } from "@/src/hooks/data_hooks";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import Attribute from "@/src/types/entities/attribute";
import { Collection } from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import ImageCheck from "@/src/types/entities/imagecheck";
import { Item } from "@/src/types/entities/item";
import { ItemsCreate } from "@/src/types/helpers/items_create";
import {
  getDefaultAttributeValue,
  getItemPrimaryAttributeValue,
} from "@/src/utils/data_access_utils";
import { adjustColor } from "@/src/utils/frontend_utils";
import Entypo from "@expo/vector-icons/Entypo";
import { useEffect, useState } from "react";
import { Image, ScrollView, TouchableOpacity, View } from "react-native";
import { Overlay } from "react-native-elements";
import CustomIconButton from "../custom_ui/custom_icon_button";
import CustomText from "../custom_ui/custom_text";
import ItemRegisterForm from "./item_register_form";

interface ItemRegisterCardProps {
  collectionType: CollectionType;
  collection: Collection;
  selectedImageCheckIndex: number;
  imageCheck: ImageCheck;
  handleAddItemsCreateChange: (item: ItemsCreate) => void;
  handleRemoveItemsCreateChange: (id: string) => void;
  itemsCreate?: ItemsCreate;
}

function ItemRegisterCard({
  collectionType,
  collection,
  selectedImageCheckIndex,
  imageCheck,
  handleAddItemsCreateChange,
  handleRemoveItemsCreateChange,
  itemsCreate,
}: ItemRegisterCardProps) {
  const { token } = useUserStore();
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

  const darkContrastColor = adjustColor(
    collectionType.color,
    customTheme.colorChangePercent.dark,
  );

  const lightContrastColor = adjustColor(
    collectionType.color,
    customTheme.colorChangePercent.light,
  );

  const baseDefaultIndex =
    imageCheck.similars.length >= 1 && imageCheck.state === "found" ? 1 : 0;

  const overrideIndex = itemsCreate
    ? (() => {
        const foundIndex = imageCheck.similars.findIndex(
          (similar) => similar.id === itemsCreate.item.id,
        );
        return foundIndex >= 0 ? foundIndex + 1 : 0;
      })()
    : undefined;

  const defaultIndex = overrideIndex ?? baseDefaultIndex;

  const [selectedIndex, setSelectedIndex] = useState(defaultIndex);
  const [isInformationOverlayOpened, setIsInformationOverlayOpened] =
    useState(false);

  const selectedSimilar =
    selectedIndex > 0 && imageCheck.similars[selectedIndex - 1]
      ? imageCheck.similars[selectedIndex - 1]
      : null;

  const [newItem, setNewItem] = useState<{ item: Item; version: Date }>({
    item: emptyItem(collection.id, imageCheck.quantity),
    version: new Date(),
  });

  const [isFormError, setIsFormError] = useState(false);

  useEffect(() => {
    if (itemsCreate) {
      const foundIndex = imageCheck.similars.findIndex(
        (similar) => similar.id === itemsCreate.item.id,
      );
      setSelectedIndex(foundIndex >= 0 ? foundIndex + 1 : 0);
      if (foundIndex === -1)
        setNewItem({ item: itemsCreate.item, version: new Date() });
      else
        setNewItem({
          item: emptyItem(collection.id, imageCheck.quantity),
          version: new Date(),
        });
    } else {
      if (baseDefaultIndex > imageCheck.similars.length) {
        setSelectedIndex(0);
      } else {
        setSelectedIndex(baseDefaultIndex);
      }
      setNewItem({
        item: emptyItem(collection.id, imageCheck.quantity),
        version: new Date(),
      });
    }
  }, [itemsCreate, imageCheck, selectedImageCheckIndex]);

  const handleAddPressed = () => {
    if (selectedSimilar) {
      handleAddQuantityToItem();
    } else if (newItem) {
      handleAddNewItem();
    }
  };

  const handleRemovePressed = () => {
    handleRemoveItemsCreateChange(imageCheck.id);
  };

  const handleAddQuantityToItem = () => {
    if (selectedSimilar) {
      const updatedItem: ItemsCreate = {
        id: imageCheck.id,
        item: {
          ...selectedSimilar,
          quantity: selectedSimilar.quantity + imageCheck.quantity,
        },
      };

      handleAddItemsCreateChange(updatedItem);
    }
  };

  const handleAddNewItem = () => {
    if (!newItem) return;

    const updatedItem = { ...newItem.item };

    updatedItem.itemAttributes = updatedItem.itemAttributes
      ? [...updatedItem.itemAttributes]
      : [];

    attributes.forEach((attribute) => {
      const alreadyExists = updatedItem.itemAttributes.some(
        (attr) => attr.attributeId === attribute.id,
      );

      if (!alreadyExists) {
        const defaultValue = getDefaultAttributeValue(attribute)!;

        const newItemAttribute = {
          id: 0,
          itemId: updatedItem.id ?? tempItemId,
          attributeId: attribute.id,
          valueString: typeof defaultValue === "string" ? defaultValue : "",
          valueNumber: typeof defaultValue === "number" ? defaultValue : 0,
          valueDate:
            attribute.dataType === "date"
              ? (defaultValue as string)
              : new Date().toISOString(),
          valueBoolean:
            typeof defaultValue === "boolean" ? defaultValue : false,
          attribute,
        };

        updatedItem.itemAttributes.push(newItemAttribute);
      }
    });

    const updateNewItem: ItemsCreate = {
      id: imageCheck.id,
      item: updatedItem,
    };

    handleAddItemsCreateChange(updateNewItem);
  };

  return (
    <>
      <ScrollView>
        <View
          style={{
            width: "100%",
            justifyContent: "space-between",
            alignItems: "center",
            flexDirection: "row",
          }}
        >
          <CustomText
            style={{
              fontFamily: "VendSansBold",
              fontSize: 42,
              color:
                imageCheck.state === "found"
                  ? customTheme.colors.primary
                  : customTheme.colors.secondary,
              padding: 0,
            }}
          >
            {imageCheck.state === "found" ? "Found" : "New"}
          </CustomText>
          <TouchableOpacity onPress={() => setIsInformationOverlayOpened(true)}>
            <Entypo
              name="info-with-circle"
              size={24}
              color={customTheme.colors.primary}
            />
          </TouchableOpacity>
        </View>
        <CustomText style={{ fontFamily: "VendSansItalic", fontSize: 12 }}>
          {selectedIndex === 0
            ? "You will add this item as a new"
            : `You will add the quantity to the ${selectedIndex}. highest accuracy item`}
        </CustomText>
        <View
          style={{
            width: "60%",
            aspectRatio: 1 / 1,
            alignSelf: "center",
            borderWidth: 2,
            borderColor: darkContrastColor,
            borderRadius: 5,
            boxShadow: `2px 2px 2px ${darkContrastColor}`,
            marginBottom: 20,
            overflow: "hidden",
          }}
        >
          <Image
            source={{
              uri:
                selectedIndex === 0 || !selectedSimilar
                  ? `${endpoints.itemsTempImage}/${imageCheck.id}`
                  : `${endpoints.itemsCoverImage}/${selectedSimilar.image}`,
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }}
            style={{ width: "100%", height: "100%" }}
          />
        </View>
        <CustomText
          style={{
            fontFamily: "VendSansBold",
            fontSize: 24,
            color: collectionType.color,
            textAlign: "center",
          }}
        >
          {selectedSimilar
            ? getItemPrimaryAttributeValue(
                selectedSimilar.itemAttributes,
              )?.value?.toLocaleString()
            : "New item"}
        </CustomText>
        <CustomText
          style={{
            fontFamily: "VendSansItalic",
            fontSize: 12,
            textAlign: "center",
          }}
        >
          {selectedIndex > 0 ? `${selectedIndex}. most accurate` : ""}
        </CustomText>
        <View
          style={{
            width: "100%",
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <View style={{ flex: 1 }}>
            <CustomText style={{ fontSize: 12 }}>Add as new</CustomText>
            <TouchableOpacity
              style={{
                width: "100%",
                aspectRatio: 1,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: collectionType.color,
                borderWidth: 2,
                borderColor:
                  selectedIndex === 0 ? darkContrastColor : lightContrastColor,
                borderRadius: 5,
              }}
              onPress={() => setSelectedIndex(0)}
            >
              <Entypo name="plus" size={24} color={darkContrastColor} />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 3 }}>
            <CustomText style={{ fontSize: 12 }}>
              Similars
              {imageCheck.similars.length === 0 ? " - no similars found" : ""}
            </CustomText>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              {[0, 1, 2].map((i) => (
                <TouchableOpacity
                  key={i}
                  style={{
                    flex: 1,
                    aspectRatio: 1,
                    borderWidth: imageCheck.similars.length > i ? 2 : 0,
                    borderColor:
                      selectedIndex === i + 1
                        ? darkContrastColor
                        : lightContrastColor,
                    borderRadius: 5,
                    overflow: "hidden",
                  }}
                  disabled={imageCheck.similars.length <= i}
                  onPress={() => setSelectedIndex(i + 1)}
                >
                  {imageCheck.similars.length > i && (
                    <Image
                      source={{
                        uri: `${endpoints.itemsCoverImage}/${imageCheck.similars[i].image}`,
                        headers: {
                          Authorization: `Bearer ${token}`,
                        },
                      }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
        {selectedSimilar ? (
          <View
            style={{
              width: "100%",
              alignSelf: "center",
              backgroundColor: collectionType.color,
              borderWidth: 2,
              borderColor: darkContrastColor,
              borderRadius: 5,
              padding: 10,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <CustomText style={{ color: darkContrastColor }}>
              {`By clicking on `}{" "}
              <CustomText
                style={{ fontFamily: "VendSansBold", color: darkContrastColor }}
              >
                Add
              </CustomText>
              {", you will increase this "}
              <CustomText
                style={{
                  fontFamily: "VendSansBold",
                  fontSize: 18,
                  color: lightContrastColor,
                }}
              >
                {getItemPrimaryAttributeValue(
                  selectedSimilar.itemAttributes,
                )?.value?.toLocaleString()}
              </CustomText>
              {" item quantity by "}
              <CustomText
                style={{ fontFamily: "VendSansBold", color: darkContrastColor }}
              >
                {imageCheck.quantity}
              </CustomText>
            </CustomText>
          </View>
        ) : (
          <View style={{ width: "100%" }}>
            <CustomText>
              Quantity{" "}
              <CustomText
                style={{
                  fontFamily: "VendSansBold",
                  color: customTheme.colors.secondary,
                }}
              >
                {imageCheck.quantity}
              </CustomText>
            </CustomText>
            <ItemRegisterForm
              collectionType={collectionType}
              newItem={{
                value: newItem,
                set: setNewItem,
              }}
              setIsError={setIsFormError}
            />
          </View>
        )}
      </ScrollView>
      <View
        style={{
          position: "absolute",
          width: "100%",
          justifyContent: "center",
          flexDirection: "row",
          gap: 50,
          bottom: 10,
        }}
      >
        <CustomIconButton
          iconName={"clear"}
          iconType={"materialicons"}
          title={"Skip"}
          color="red"
          reverseColor="white"
          onPress={handleRemovePressed}
        />
        <CustomIconButton
          iconName={"check"}
          iconType={"entypo"}
          title={"Add"}
          color="green"
          reverseColor="white"
          onPress={handleAddPressed}
          disabled={isFormError && selectedIndex === 0}
        />
      </View>
      <Overlay
        isVisible={isInformationOverlayOpened}
        onBackdropPress={() => setIsInformationOverlayOpened(false)}
        overlayStyle={{
          backgroundColor: customTheme.colors.background,
        }}
      >
        <View style={{ width: "90%" }}>
          <CustomText style={{ textAlign: "center" }}>
            {imageCheck.state === "not found"
              ? "The system detected the item as new, so you can add it as a new entry by default. If you think that’s incorrect, you can choose from the top three matches (by accuracy) and add the detected quantity to the selected item."
              : "The system detected the item as already existing, so by default, you can add the recognized quantity to the top match. If you think that’s incorrect, you can instead add it to one of the next two best matches or create it as a new item."}
          </CustomText>
        </View>
      </Overlay>
    </>
  );
}

export default ItemRegisterCard;
