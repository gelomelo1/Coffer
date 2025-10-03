import Attribute from "./attribute";

interface ItemAttribute {
  id: number;
  itemId: string;
  attributeId: number;
  valueString: string;
  valueNumber: number;
  valueDate: string;
  valueBoolean: boolean;
  attribute: Attribute;
}

export default ItemAttribute;
