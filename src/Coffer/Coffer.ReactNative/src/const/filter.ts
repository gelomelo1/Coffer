import Item from "../types/entities/item";

export const itemSortDefaultOptions: (keyof Item)[] = [
  "quantity",
  "acquiredAt",
];

export const nestedAttributeFilterQuery = (
  id: string,
  attributeName: string
) => {
  return `itemAttributes.Where(a => a.attributeId == ${id}).Select(a => a.${attributeName}).FirstOrDefault()`;
};
