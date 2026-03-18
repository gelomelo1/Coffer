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
  attributeName: AttributeTypes,
) => {
  let extension = "";
  if (attributeName === "valueString") extension = ".ToLower()";
  return `itemAttributes.Where(a => a.attributeId == ${id}).Select(a => a.${attributeName}${extension}).FirstOrDefault()`;
};

export const nestedTagFilterQuery = (values: string[]) => {
  if (values.length === 0) return "";

  const query = values
    .map(
      (value) =>
        `itemTags.Any(Tag.ToLower().Contains("${value.toLowerCase()}"))`,
    )
    .join(" OR ");

  const closedQuery = `(${query})`;

  return closedQuery;
};

export const textInputRegex = /^[a-zA-Z0-9 .-]+$/;

export const languageFilter = new Filter();

export const phoneRegex = /^\+?\d{7,15}$/;

export const facebookRegex = /^(https?:\/\/)?(www\.)?facebook\.com\/.+$/i;

export const instagramRegex = /^@[a-z0-9._]{1,29}[a-z0-9_]$/;

export const instagramDomainRegex =
  /^(https?:\/\/)?(www\.)?instagram\.com\/.+$/i;

export const titleTradeFilterKey = "title";

export const tradeUsernameFilterQuery = (value: string) => {
  return `user.name.ToLower().Contains("${value.toLowerCase()}")`;
};

export const nestedTradeItemAttributeFilterQuery = (
  id: number,
  attributeName: string,
  value: string,
) => {
  const lowerValue = value.toLowerCase();
  return `TradeItems.Any(ti => ti.Item.ItemAttributes.Any(a => a.AttributeId == ${id} && a.${
    attributeName.charAt(0).toUpperCase() + attributeName.slice(1)
  }.ToLower().Contains("${lowerValue}")))`;
};
