import {
  itemSortDefaultOptions,
  nestedAttributeFilterQuery,
} from "../const/filter";
import Item from "../types/entities/item";
import ItemAttribute from "../types/entities/item_attribute";
import AttributeValue from "../types/helpers/attribute_data";
import { QuerySortData } from "../types/helpers/query_data";

export function getItemAttributeValue(
  itemAttribute: ItemAttribute
): AttributeValue {
  let value: string | number | boolean | Date | null;
  let valueKey: string;

  switch (itemAttribute.attribute.dataType) {
    case "string":
    case "select":
      value = itemAttribute.valueString ?? null;
      valueKey = "valueString";
      break;
    case "number":
      value = itemAttribute.valueNumber ?? null;
      valueKey = "valueNumber";
      break;
    case "boolean":
      value = itemAttribute.valueBoolean ?? null;
      valueKey = "valueBoolean";
      break;
    case "date":
      value = itemAttribute.valueDate
        ? new Date(itemAttribute.valueDate)
        : null;
      valueKey = "valueDate";
      break;
    default:
      value = null;
      valueKey = "";
  }

  return {
    itemAttribute: itemAttribute,
    value,
    valueKey,
  };
}

export function getItemPrimaryAttributeValue(
  itemAttributes: ItemAttribute[]
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
  item: Item
): { value: string; label: string }[] {
  // Generate default sort options
  const records = itemSortDefaultOptions.flatMap((option) => [
    {
      value: `${option}_asc`,
      label: `${lowerCamelCaseToNormalFormat(option)} ascending`,
    },
    {
      value: `${option}_desc`,
      label: `${lowerCamelCaseToNormalFormat(option)} descending`,
    },
  ]);

  // Get primary attribute
  const primaryAttribute = getItemPrimaryAttributeValue(item.itemAttributes);
  if (primaryAttribute) {
    const id = primaryAttribute.itemAttribute.attributeId;
    const name = primaryAttribute.itemAttribute.attribute.name;
    const key = primaryAttribute.valueKey;
    const nestedSortQuery = nestedAttributeFilterQuery(id.toString(), key);
    records.push(
      {
        value: `${nestedSortQuery}_asc`,
        label: `${lowerCamelCaseToNormalFormat(name)} ascending`,
      },
      {
        value: `${nestedSortQuery}_desc`,
        label: `${lowerCamelCaseToNormalFormat(name)} descending`,
      }
    );
  }

  return records;
}

function lowerCamelCaseToNormalFormat(input: string): string {
  if (!input) return "";

  const capitalized = input[0].toUpperCase() + input.slice(1);
  return capitalized.replace(/([a-z])([A-Z])/g, "$1 $2");
}
