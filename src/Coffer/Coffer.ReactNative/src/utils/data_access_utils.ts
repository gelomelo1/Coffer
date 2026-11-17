import i18n from "../i18n";
import { formatNumberShort as formatNumberShortFor } from "./format";
import * as ImagePicker from "expo-image-picker";
import { FlagType, getAllCountries } from "react-native-country-picker-modal";
import {
  itemSortDefaultOptions,
  nestedAttributeFilterQuery,
} from "../const/filter";
import rarityVariants from "../const/rarity_variants";
import Attribute from "../types/entities/attribute";
import { Item, ItemProvided } from "../types/entities/item";
import ItemAttribute from "../types/entities/item_attribute";
import ItemOptions from "../types/entities/itemoptions";
import { Reaction } from "../types/entities/reaction";
import AttributeValue, {
  AttributeDataTypes,
  AttributeTypes,
} from "../types/helpers/attribute_data";
import {
  ImagePickerResult,
  ImageSource,
} from "../types/helpers/image_picker_result";
import { QuerySortData } from "../types/helpers/query_data";
import RarityValue from "../types/helpers/rarity_value";

export function getItemAttributeValue(
  itemAttribute: ItemAttribute,
): AttributeValue {
  let value: string | number | boolean | Date | null;
  let valueString = "";
  let valueKey: AttributeTypes;

  switch (itemAttribute.attribute.dataType) {
    case AttributeDataTypes.String:
    case AttributeDataTypes.Multi_Select:
    case AttributeDataTypes.Autocomplete:
    case AttributeDataTypes.Select:
      value = itemAttribute.valueString ?? null;
      valueString = itemAttribute.valueString;
      valueKey = "valueString";
      break;
    case AttributeDataTypes.Number:
      value = itemAttribute.valueNumber ?? null;
      valueString = itemAttribute.valueNumber.toLocaleString(i18n.language);
      valueKey = "valueNumber";
      break;
    case AttributeDataTypes.Boolean:
      value = itemAttribute.valueBoolean ?? null;
      valueString = itemAttribute.valueBoolean ? "true" : "false";
      valueKey = "valueBoolean";
      break;
    case AttributeDataTypes.Date:
      value = itemAttribute.valueDate
        ? new Date(itemAttribute.valueDate)
        : null;
      valueString = new Date(itemAttribute.valueDate).toLocaleDateString(i18n.language);
      valueKey = "valueDate";
      break;
    default:
      value = null;
      valueKey = "";
  }

  return {
    itemAttribute: itemAttribute,
    value,
    valueString,
    valueKey,
  };
}

export function getAttributeValue(attribute: Attribute): AttributeTypes {
  switch (attribute.dataType) {
    case AttributeDataTypes.String:
    case AttributeDataTypes.Multi_Select:
    case AttributeDataTypes.Autocomplete:
    case AttributeDataTypes.Select:
      return "valueString";
    case AttributeDataTypes.Number:
      return "valueNumber";
    case AttributeDataTypes.Boolean:
      return "valueBoolean";
    case AttributeDataTypes.Date:
      return "valueDate";
    default:
      return "";
  }
}

export function getItemPrimaryAttributeValue(
  itemAttributes: ItemAttribute[],
): AttributeValue | null {
  const primaryAttr = itemAttributes.find((attr) => attr.attribute.primary);
  return primaryAttr ? getItemAttributeValue(primaryAttr) : null;
}

export function parseSortKeysToQuerySortData(keys: string[]): QuerySortData[] {
  return keys.map((key) => {
    const [field, direction] = key.split("_");
    if (direction !== "asc" && direction !== "desc") {
      throw new Error(`Invalid direction in sort key: ${key}`);
    }
    return { field, direction };
  });
}

export function generateSortRecordDataForItem(
  attributes: Attribute[],
): { value: string; label: string }[] {
  // Built-in sort fields are app text (translated); attribute names are collection-type data (shown as stored).
  const fieldName = (option: string) => i18n.t(`collections:sort.fields.${option}`, { defaultValue: lowerCamelCaseToNormalFormat(option) });
  const records = itemSortDefaultOptions.flatMap((option) => [
    { value: `${option}_asc`, label: i18n.t("collections:sort.ascending", { field: fieldName(option) }) },
    { value: `${option}_desc`, label: i18n.t("collections:sort.descending", { field: fieldName(option) }) },
  ]);

  const primaryAttribute = attributes.find((attribute) => attribute.primary);
  if (primaryAttribute) {
    const id = primaryAttribute.id;
    const name = primaryAttribute.name;
    const key = getAttributeValue(primaryAttribute);
    const nestedSortQuery = nestedAttributeFilterQuery(id, key);
    records.push(
      { value: `${nestedSortQuery}_asc`, label: i18n.t("collections:sort.ascending", { field: name }) },
      { value: `${nestedSortQuery}_desc`, label: i18n.t("collections:sort.descending", { field: name }) },
    );
  }

  return records;
}

function lowerCamelCaseToNormalFormat(input: string): string {
  if (!input) return "";

  const capitalized = input[0].toUpperCase() + input.slice(1);
  return capitalized.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function getOptions(optionsData: ItemOptions | undefined) {
  if (!optionsData) return [];
  const values = optionsData.optionIds.split(";");
  const labels = optionsData.optionLabels.split(";");

  const options = values.map((value, index) => ({
    value: value.trim(),
    label: labels[index].trim() ?? "",
  }));

  return options;
}

export function getItemsQuantity(items: Item[]) {
  let quantity = 0;
  items.forEach((item) => (quantity += item.quantity));
  return quantity;
}

export function updateItemAttributeValue(
  attr: ItemAttribute,
  newValue: any,
): ItemAttribute {
  switch (attr.attribute.dataType) {
    case AttributeDataTypes.String:
    case AttributeDataTypes.Multi_Select:
    case AttributeDataTypes.Autocomplete:
    case AttributeDataTypes.Select:
      return { ...attr, valueString: newValue as string };
    case AttributeDataTypes.Number:
      return { ...attr, valueNumber: newValue as number };
    case AttributeDataTypes.Boolean:
      return { ...attr, valueBoolean: newValue as boolean };
    case AttributeDataTypes.Date:
      return { ...attr, valueDate: newValue as string };
    default:
      return attr;
  }
}

export const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunked: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
};

export function getDefaultAttributeValue(
  attribute: Attribute,
): string | number | boolean | null {
  switch (attribute.dataType) {
    case AttributeDataTypes.String:
      return "";
    case AttributeDataTypes.Multi_Select:
      return "";
    case AttributeDataTypes.Autocomplete:
      return "";
    case AttributeDataTypes.Number:
      return 0;
    case AttributeDataTypes.Boolean:
      return false;
    case AttributeDataTypes.Date:
      return new Date().toISOString();
    case AttributeDataTypes.Select:
      return "";
    default:
      return null;
  }
}

export async function getCountryByCode(countryCode: string) {
  const value = await getAllCountries(
    FlagType.FLAT,
    undefined,
    undefined,
    undefined,
    [countryCode as any],
    undefined,
    undefined,
    undefined,
  );

  if (value.length === 0) return null;

  return value[0];
}

export function getReactionsLikeCount(reactions: Reaction[]) {
  let likeCount = 0;
  reactions.forEach((reactions) => {
    if (reactions.liked) likeCount += 1;
  });

  return likeCount;
}

export function getRarityVariantByValue(
  reactions: Reaction[],
): RarityValue | null {
  if (!reactions.length) return null;

  const validRarities = reactions
    .map((r) => r.rarity)
    .filter((r): r is number => r !== null);

  if (!validRarities.length) return null;

  const averageRarity =
    validRarities.reduce((sum, r) => sum + r, 0) / validRarities.length;

  const roundedRarity = Math.floor(averageRarity + 0.5);

  const clampedRarity = Math.min(Math.max(roundedRarity, 1), 4);

  return rarityVariants[clampedRarity];
}

export const pickImage = async (
  source: ImageSource,
  pickerOptions?: ImagePicker.ImagePickerOptions,
): Promise<ImagePickerResult> => {
  try {
    let permission;

    if (source === "camera") {
      permission = await ImagePicker.getCameraPermissionsAsync();

      if (!permission.granted) {
        permission = await ImagePicker.requestCameraPermissionsAsync();
      }
    } else {
      permission = await ImagePicker.getMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
    }

    if (!permission.granted) {
      return { status: "permission_denied" };
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            ...pickerOptions,
            mediaTypes: ["images"],
          })
        : await ImagePicker.launchImageLibraryAsync({
            ...pickerOptions,
            mediaTypes: ["images"],
          });

    if (result.canceled) {
      return { status: "cancel" };
    }

    return {
      status: "success",
      assets: result.assets,
    };
  } catch (error) {
    return {
      status: "error",
      error,
    };
  }
};

export function stringHasValue(text: string | null | undefined) {
  if (!text) return false;

  const stripped = text.replace(/<[^>]*>/g, "").trim();

  return stripped.length > 0;
}

/** Big counts shortened in the app language: 1530 → "1.53k" (en), "1,53 E" (hu). */
export const formatNumberShort = (num: number): string => formatNumberShortFor(num, i18n.language);
