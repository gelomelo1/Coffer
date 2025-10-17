import { Filter } from "profanity-check";
import { Item } from "../types/entities/item";
import { AttributeTypes } from "../types/helpers/attribute_data";

export const quantityItemFilterKey = "quantity";

export const acquiredAtItemFilterKey = "acquiredAt";

export const tagItemFilterKey = "tags";

export const itemSortDefaultOptions: (keyof Item)[] = [
  quantityItemFilterKey,
  acquiredAtItemFilterKey,
];

export const nestedAttributeFilterQuery = (
  id: number,
  attributeName: AttributeTypes
) => {
  let extension = "";
  if (attributeName === "valueString") extension = ".ToLower()";
  return `itemAttributes.Where(a => a.attributeId == ${id}).Select(a => a.${attributeName}${extension}).FirstOrDefault()`;
};

export const nestedTagFilterQuery = (value: string) => {
  return `itemTags.Any(Tag.ToLower().Contains("${value}"))`;
};

export const textInputRegex = /^[a-zA-Z0-9 .-]+$/;

export const languageFilter = new Filter();
