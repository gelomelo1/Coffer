import Attribute from "@/src/types/entities/attribute";
import ItemEditDynamicBoolean from "./item_edit_dynamic_boolean";
import ItemEditDynamicDate from "./item_edit_dynamic_date";
import ItemEditDynamicDropdown from "./item_edit_dynamic_dropdown";
import ItemEditTextField from "./item_edit_textfield";

interface ItemEditDynamicFieldsProps {
  attribute: Attribute;
  defaultValue: string | number | boolean | Date;
  onValueChange: (newValue: string | number | boolean) => void;
  onErrorChange: (hasError: boolean) => void;
}

function ItemEditDynamicFields({
  attribute,
  defaultValue,
  onValueChange,
  onErrorChange,
}: ItemEditDynamicFieldsProps) {
  switch (attribute.dataType) {
    case "select":
      return (
        <ItemEditDynamicDropdown
          attribute={attribute}
          defaultValue={defaultValue as string}
          onValueChange={onValueChange}
          onErrorChange={(errorMessage) => onErrorChange?.(!!errorMessage)}
        />
      );
    case "string": {
      return (
        <ItemEditTextField<string>
          attribute={attribute}
          defaultValue={defaultValue as string}
          onValueChange={onValueChange}
          onErrorChange={(errorMessage) => onErrorChange?.(!!errorMessage)}
        />
      );
    }
    case "number":
      return (
        <ItemEditTextField<number>
          attribute={attribute}
          defaultValue={defaultValue as number}
          onValueChange={onValueChange}
          onErrorChange={(errorMessage) => onErrorChange?.(!!errorMessage)}
        />
      );
    case "boolean": {
      return (
        <ItemEditDynamicBoolean
          attribute={attribute}
          defaultValue={defaultValue as boolean}
          onValueChange={onValueChange}
        />
      );
    }
    case "date":
      return (
        <ItemEditDynamicDate
          attribute={attribute}
          defaultValue={defaultValue.toString()}
          onValueChange={onValueChange}
          onErrorChange={(errorMessage) => onErrorChange?.(!!errorMessage)}
        />
      );
  }
}

export default ItemEditDynamicFields;
