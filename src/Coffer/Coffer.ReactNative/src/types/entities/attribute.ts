interface Attribute {
  id: number;
  collectionTypeId: number;
  itemOptionsId: number;
  name: string;
  dataType: "string" | "number" | "date" | "boolean" | "select";
  primary: boolean;
}

export default Attribute;
