import { AttributeDataTypes } from "../helpers/attribute_data";

interface Attribute {
  id: number;
  collectionTypeId: number;
  itemOptionsId: number;
  name: string;
  dataType: AttributeDataTypes;
  primary: boolean;
  /** Must have a value before an item is added (the primary attribute always must). */
  required?: boolean;
}

export default Attribute;
