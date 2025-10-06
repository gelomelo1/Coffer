import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { nestedAttributeFilterQuery } from "@/src/const/filter";
import Attribute from "@/src/types/entities/attribute";
import { QueryFilterDataItem } from "@/src/types/helpers/attribute_data";
import { QueryFilterData } from "@/src/types/helpers/query_data";
import CollectionItemListBooleanFilter from "./collection_item_list_boolean_filter";
import CollectionItemListDateFilter from "./collection_item_list_date_filter";
import CollectionItemListDropdownFilter from "./collection_item_list_dropdown_filter";

interface CollectionItemListDynamicFilterProps {
  attribute: Attribute;
  isBottomSheetVisible: boolean;
  onQueryFilterDataChange: (
    filter: QueryFilterData,
    id?: string | number
  ) => void;
  draftQueryFilterData: QueryFilterDataItem[];
}

function CollectionItemListDynamicFilter({
  attribute,
  isBottomSheetVisible,
  onQueryFilterDataChange,
  draftQueryFilterData,
}: CollectionItemListDynamicFilterProps) {
  switch (attribute.dataType) {
    case "select":
      return (
        <CollectionItemListDropdownFilter
          attribute={attribute}
          isBottomSheetVisible={isBottomSheetVisible}
          onQueryFilterDataChange={onQueryFilterDataChange}
          draftQueryFilterData={
            draftQueryFilterData?.length > 0
              ? draftQueryFilterData[0]
              : undefined
          }
        />
      );
    case "string": {
      return (
        <CustomTextInput
          label={`${attribute.name} contains`}
          placeholder="Write keywords"
          defaultValue={(draftQueryFilterData[0]?.value.value as string) ?? ""}
          onChangeText={(newValue) =>
            onQueryFilterDataChange({
              filter: "Contains",
              field: nestedAttributeFilterQuery(attribute.id, "valueString"),
              value: newValue.toLocaleLowerCase(),
            })
          }
        />
      );
    }
    case "number":
      return (
        <CustomTextInput
          label={`${attribute.name} contains`}
          placeholder="Write a matching value"
          defaultValue={draftQueryFilterData[0]?.value.value.toString() ?? ""}
          onChangeText={(newValue) =>
            onQueryFilterDataChange({
              filter: "==",
              field: nestedAttributeFilterQuery(attribute.id, "valueNumber"),
              value: Number(newValue),
            })
          }
        />
      );
    case "boolean": {
      return (
        <CollectionItemListBooleanFilter
          attribute={attribute}
          isBottomSheetVisible={isBottomSheetVisible}
          onQueryFilterDataChange={onQueryFilterDataChange}
          draftQueryFilterData={
            draftQueryFilterData?.length > 0
              ? draftQueryFilterData[0]
              : undefined
          }
        />
      );
    }
    case "date":
      return (
        <CollectionItemListDateFilter
          attribute={attribute}
          isBottomSheetVisible={isBottomSheetVisible}
          onQueryFilterDataChange={onQueryFilterDataChange}
          draftQueryFilterData={draftQueryFilterData}
        />
      );
  }
}

export default CollectionItemListDynamicFilter;
