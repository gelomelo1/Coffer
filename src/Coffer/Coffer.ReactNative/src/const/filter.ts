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

export const phoneRegex = /^\+?\d{7,15}$/;

export const facebookRegex = /^(https?:\/\/)?(www\.)?facebook\.com\/.+$/i;

export const instagramRegex = /^@[a-z0-9._]{1,29}[a-z0-9_]$/;

export const instagramDomainRegex =
  /^(https?:\/\/)?(www\.)?instagram\.com\/.+$/i;
