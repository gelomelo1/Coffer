import Item from "../types/entities/item";
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
  return `itemAttributes.Where(a => a.attributeId == ${id}).Select(a => a.${attributeName}.ToLower()).FirstOrDefault()`;
};

export const nestedTagFilterQuery = `itemTags.Select(a => a.tag.ToLower()).FirstOrDefault()`;
