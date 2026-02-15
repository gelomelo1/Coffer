import React from "react";
import { ItemType, ValueType } from "react-native-dropdown-picker";

type CustomDropdownItem<T extends ValueType> = ItemType<T> & {
  additionalElement?: React.ReactNode;
};

export default CustomDropdownItem;
