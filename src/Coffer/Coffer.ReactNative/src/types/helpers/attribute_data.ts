import ItemAttribute from "../entities/item_attribute";

interface AttributeValue {
  itemAttribute: ItemAttribute;
  value: string | number | boolean | Date | null;
  valueKey: string;
}

export default AttributeValue;
