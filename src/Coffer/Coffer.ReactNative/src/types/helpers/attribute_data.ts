import ItemAttribute from "../entities/item_attribute";
import { QueryFilterData } from "./query_data";

export type AttributeTypes =
  | "valueString"
  | "valueNumber"
  | "valueDate"
  | "valueBoolean"
  | "";

interface AttributeValue {
  itemAttribute: ItemAttribute;
  value: string | number | boolean | Date | null;
  valueKey: AttributeTypes;
}

export default AttributeValue;

export interface QueryFilterDataItem {
  id: number | string;
  value: QueryFilterData;
}

export interface DatePickerData {
  id: "before" | "after";
  value: Date;
}
