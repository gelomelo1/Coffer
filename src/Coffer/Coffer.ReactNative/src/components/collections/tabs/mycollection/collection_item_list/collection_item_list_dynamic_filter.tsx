import CustomText from "@/src/components/custom_ui/custom_text";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { nestedAttributeFilterQuery } from "@/src/const/filter";
import ItemAttribute from "@/src/types/entities/item_attribute";
import { QueryFilterData } from "@/src/types/helpers/query_data";
import { View } from "react-native";
import CollectionItemListBooleanFilter from "./collection_item_list_boolean_filter";
import CollectionItemListDropdownFilter from "./collection_item_list_dropdown_filter";

interface CollectionItemListDynamicFilterProps {
  itemAttribute: ItemAttribute;
  isBottomSheetVisible: boolean;
  onQueryFilterDataChange: (filter: QueryFilterData) => void;
  draftQueryFilterData?: QueryFilterData;
}

function CollectionItemListDynamicFilter({
  itemAttribute,
  isBottomSheetVisible,
  onQueryFilterDataChange,
  draftQueryFilterData,
}: CollectionItemListDynamicFilterProps) {
  switch (itemAttribute.attribute.dataType) {
    case "select":
      return (
        <CollectionItemListDropdownFilter
          itemAttribute={itemAttribute}
          isBottomSheetVisible={isBottomSheetVisible}
          onQueryFilterDataChange={onQueryFilterDataChange}
          draftQueryFilterData={draftQueryFilterData}
        />
      );
    case "string": {
      return (
        <CustomTextInput
          label={`${itemAttribute.attribute.name} contains`}
          placeholder="Write keywords"
          defaultValue={(draftQueryFilterData?.value as string) ?? ""}
          onChangeText={(newValue) =>
            onQueryFilterDataChange({
              filter: "Contains",
              field: nestedAttributeFilterQuery(
                itemAttribute.attributeId,
                "valueString"
              ),
              value: newValue.toLocaleLowerCase(),
            })
          }
        />
      );
    }
    case "number":
      return (
        <CustomTextInput
          label={`${itemAttribute.attribute.name} contains`}
          placeholder="Write a matching value"
          defaultValue={draftQueryFilterData?.value.toString() ?? ""}
          onChangeText={(newValue) =>
            onQueryFilterDataChange({
              filter: "==",
              field: nestedAttributeFilterQuery(
                itemAttribute.attributeId,
                "valueNumber"
              ),
              value: Number(newValue),
            })
          }
        />
      );
    case "boolean": {
      return (
        <CollectionItemListBooleanFilter
          itemAttribute={itemAttribute}
          isBottomSheetVisible={isBottomSheetVisible}
          onQueryFilterDataChange={onQueryFilterDataChange}
          draftQueryFilterData={draftQueryFilterData}
        />
      );
    }
    case "date":
      return (
        <>
          <CustomText style={{ marginTop: 10 }}>
            {itemAttribute.attribute.name}
          </CustomText>
          <View
            style={{
              position: "relative",
              width: "100%",
              justifyContent: "space-between",
              flexDirection: "row",
            }}
          >
            <CustomTextInput
              label="After Date"
              editable={false}
              style={{ width: "48%" }}
            />
            <CustomTextInput
              label="Before Date"
              editable={false}
              style={{ width: "48%" }}
            />
          </View>
        </>
      );
  }
}

export default CollectionItemListDynamicFilter;
