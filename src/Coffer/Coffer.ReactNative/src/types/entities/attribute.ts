import { AttributeDataTypes } from "../helpers/attribute_data";

interface Attribute {
  id: number;
  collectionTypeId: number;
  itemOptionsId: number;
  name: string;
  dataType: AttributeDataTypes;
  primary: boolean;
}

export default Attribute;
