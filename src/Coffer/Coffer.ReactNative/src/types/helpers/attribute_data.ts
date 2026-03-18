import ItemAttribute from "../entities/item_attribute";
import { QueryFilterData, QueryFilterNode } from "./query_data";

export enum AttributeDataTypes {
  String = 0,
  Number = 1,
  Date = 2,
  Boolean = 3,
  Select = 4,
  Multi_Select = 5,
  Autocomplete = 6,
}

export type AttributeTypes =
  | "valueString"
  | "valueNumber"
  | "valueDate"
  | "valueBoolean"
  | "";

interface AttributeValue {
  itemAttribute: ItemAttribute;
  value: string | number | boolean | Date | null;
  valueString: string;
  valueKey: AttributeTypes;
}

export default AttributeValue;

export interface QueryFilterDataItem {
  id: number | string;
  value?: QueryFilterData;
  filterTree?: QueryFilterNode;
}

export interface DatePickerData {
  id: "before" | "after";
  value: Date;
}
