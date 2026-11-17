import i18n from "@/src/i18n";
import { emptyItem, tempItemId } from "@/src/const/emptyItem";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useGetData } from "@/src/hooks/data_hooks";
import { useUserStore } from "@/src/hooks/user_store";
import { borders, colors, fonts, spacing, typography } from "@/src/theme/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Trans, useTranslation } from "react-i18next";
import CustomButton from "../custom_ui/custom_button";
import CustomOverlayMessage from "../custom_ui/custom_overlay_message";
import { Tag } from "../custom_ui/tag";
import Attribute from "@/src/types/entities/attribute";
import { Collection } from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import ImageCheck from "@/src/types/entities/imagecheck";
import { Item } from "@/src/types/entities/item";
import { AttributeDataTypes } from "@/src/types/helpers/attribute_data";
import { ItemsCreate } from "@/src/types/helpers/items_create";
import {
  getDefaultAttributeValue,
  getItemPrimaryAttributeValue,
} from "@/src/utils/data_access_utils";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import CustomIconButton from "../custom_ui/custom_icon_button";
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
  const { t } = useTranslation();
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
            attribute.dataType === AttributeDataTypes.Date
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

  const similarName = selectedSimilar ? (getItemPrimaryAttributeValue(selectedSimilar.itemAttributes)?.value?.toLocaleString(i18n.language) ?? "") : "";

  const choiceTile = (key: string, selected: boolean, onPress: () => void, label: string, content: React.ReactNode, disabled = false) => (
    <Pressable
      key={key}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      style={{
        flex: 1,
        aspectRatio: 1,
        borderWidth: selected ? borders.focus : borders.width,
        borderColor: selected ? colors.secondary : colors.border,
        backgroundColor: collectionType.color,
        opacity: disabled ? 0.3 : 1,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {content}
      {selected ? (
        <View style={{ position: "absolute", top: 0, right: 0, backgroundColor: colors.secondary, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
          <MaterialIcons name="check" size={16} color={colors.onSecondary} />
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Tag
            label={imageCheck.state === "found" ? t("items:register.found") : t("items:register.new")}
            color={imageCheck.state === "found" ? colors.primary : colors.secondary}
            textColor={imageCheck.state === "found" ? colors.onPrimary : colors.onSecondary}
          />
          <Text style={[typography.meta, { color: colors.text, flex: 1 }]}>
            {selectedIndex === 0 ? t("items:register.willAddNew") : t("items:register.willAddTo", { rank: selectedIndex })}
          </Text>
          <CustomIconButton variant="plain" iconName="info-outline" accessibilityLabel={t("items:register.howItWorks")} onPress={() => setIsInformationOverlayOpened(true)} />
        </View>

        <View style={{ width: "70%", maxWidth: 320, aspectRatio: 1, alignSelf: "center", borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surfaceAlt }}>
          <Image
            source={{
              uri:
                selectedIndex === 0 || !selectedSimilar
                  ? `${endpoints.itemsTempImage}/${imageCheck.id}`
                  : `${endpoints.itemsCoverImage}/${selectedSimilar.image}`,
              headers: { Authorization: `Bearer ${token}` },
            }}
            style={{ width: "100%", height: "100%" }}
          />
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={[typography.title, { color: colors.text, textAlign: "center" }]}>{selectedSimilar ? similarName : t("items:register.newItem")}</Text>
          {selectedIndex > 0 ? <Text style={[typography.caption, { color: colors.textMuted }]}>{t("items:register.rank", { rank: selectedIndex })}</Text> : null}
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.label, { color: colors.text }]}>
            {imageCheck.similars.length === 0 ? t("items:register.noSimilars") : t("items:register.chooseMatch")}
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {choiceTile(
              "new",
              selectedIndex === 0,
              () => setSelectedIndex(0),
              t("items:register.addAsNew"),
              <View style={{ alignItems: "center", gap: 2 }}>
                <MaterialIcons name="add" size={28} color={colors.text} />
                <Text style={[typography.caption, { color: colors.text, fontFamily: fonts.bold, textAlign: "center" }]} numberOfLines={2}>
                  {t("items:register.new")}
                </Text>
              </View>,
            )}
            {[0, 1, 2].map((i) =>
              choiceTile(
                `similar-${i}`,
                selectedIndex === i + 1,
                () => setSelectedIndex(i + 1),
                t("items:register.rank", { rank: i + 1 }),
                imageCheck.similars.length > i ? (
                  <Image
                    source={{ uri: `${endpoints.itemsCoverImage}/${imageCheck.similars[i].image}`, headers: { Authorization: `Bearer ${token}` } }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                ) : null,
                imageCheck.similars.length <= i,
              ),
            )}
          </View>
        </View>

        {selectedSimilar ? (
          <View style={{ borderWidth: borders.width, borderColor: colors.border, borderLeftWidth: 6, borderLeftColor: colors.secondary, padding: spacing.md }}>
            <Text style={[typography.body, { color: colors.text }]}>
              <Trans
                i18nKey="items:register.addExplanation"
                values={{ name: similarName, count: imageCheck.quantity }}
                components={{ b: <Text style={{ fontFamily: fonts.bold }} /> }}
              />
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>{t("items:register.detectedQuantity", { count: imageCheck.quantity })}</Text>
            <ItemRegisterForm collectionType={collectionType} newItem={{ value: newItem, set: setNewItem }} setIsError={setIsFormError} />
          </View>
        )}
      </ScrollView>

      <View style={{ flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderTopWidth: borders.width, borderTopColor: colors.border, backgroundColor: colors.bg }}>
        <CustomButton
          title={t("items:register.skip")}
          variant="outline"
          icon={<MaterialIcons name="close" size={20} color={colors.text} />}
          onPress={handleRemovePressed}
          containerStyle={{ flex: 1 }}
        />
        <CustomButton
          title={t("items:register.add")}
          icon={<MaterialIcons name="check" size={20} color={colors.onPrimary} />}
          onPress={handleAddPressed}
          disabled={isFormError && selectedIndex === 0}
          containerStyle={{ flex: 1 }}
        />
      </View>

      <CustomOverlayMessage
        isVisible={isInformationOverlayOpened}
        onClose={() => setIsInformationOverlayOpened(false)}
        overlayTitle={t("items:register.howItWorks")}
        message={imageCheck.state === "not found" ? t("items:register.helpNew") : t("items:register.helpFound")}
      />
    </View>
  );
}

export default ItemRegisterCard;
