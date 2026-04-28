import Attribute from "@/src/types/entities/attribute";
import { AttributeDataTypes } from "@/src/types/helpers/attribute_data";
import ItemEditDynamicAutocomplete from "./item_edit_dynamic_autocomplete";
import ItemEditDynamicBoolean from "./item_edit_dynamic_boolean";
import ItemEditDynamicDate from "./item_edit_dynamic_date";
import ItemEditDynamicDropdown from "./item_edit_dynamic_dropdown";
import ItemEditMultiDynamicDropdown from "./item_edit_dynamic_multidropdown";
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
    case AttributeDataTypes.Select:
      return (
        <ItemEditDynamicDropdown
          attribute={attribute}
          defaultValue={defaultValue as string}
          onValueChange={onValueChange}
          onErrorChange={(errorMessage) => onErrorChange?.(!!errorMessage)}
        />
      );
    case AttributeDataTypes.Multi_Select:
      return (
        <ItemEditMultiDynamicDropdown
          attribute={attribute}
          defaultValue={defaultValue as string}
          onValueChange={onValueChange}
          onErrorChange={(errorMessage) => onErrorChange?.(!!errorMessage)}
        />
      );
    case AttributeDataTypes.Autocomplete:
      return (
        <ItemEditDynamicAutocomplete
          attribute={attribute}
          defaultValue={defaultValue as string}
          onValueChange={onValueChange}
          onErrorChange={(errorMessage) => onErrorChange?.(!!errorMessage)}
        />
      );
    case AttributeDataTypes.String: {
      return (
        <ItemEditTextField<string>
          attribute={attribute}
          defaultValue={defaultValue as string}
          onValueChange={onValueChange}
          onErrorChange={(errorMessage) => onErrorChange?.(!!errorMessage)}
        />
      );
    }
    case AttributeDataTypes.Number:
      return (
        <ItemEditTextField<number>
          attribute={attribute}
          defaultValue={defaultValue as number}
          onValueChange={onValueChange}
          onErrorChange={(errorMessage) => onErrorChange?.(!!errorMessage)}
        />
      );
    case AttributeDataTypes.Boolean: {
      return (
        <ItemEditDynamicBoolean
          attribute={attribute}
          defaultValue={defaultValue as boolean}
          onValueChange={onValueChange}
        />
      );
    }
    case AttributeDataTypes.Date:
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
