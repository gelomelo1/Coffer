import CustomText from "@/src/components/custom_ui/custom_text";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { nestedAttributeFilterQuery } from "@/src/const/filter";
import Attribute from "@/src/types/entities/attribute";
import {
  AttributeTypes,
  QueryFilterDataItem,
} from "@/src/types/helpers/attribute_data";
import { QueryFilterData } from "@/src/types/helpers/query_data";
import { useEffect, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import MonthPicker from "react-native-month-year-picker";

interface CollectionItemListDateFilterProps {
  attribute: Attribute;
  isBottomSheetVisible: boolean;
  onQueryFilterDataChange: (
    filter: QueryFilterData,
    id?: string | number
  ) => void;
  draftQueryFilterData: QueryFilterDataItem[];
  filterQuery?: (
    id: number,
    attributeName: AttributeTypes,
    value: any
  ) => string;
}

function CollectionItemListDateFilter({
  attribute,
  isBottomSheetVisible,
  onQueryFilterDataChange,
  draftQueryFilterData,
  filterQuery,
}: CollectionItemListDateFilterProps) {
  const [acquiredAtBeforeDate, setAcquiredAtBeforeDate] = useState<Date | null>(
    null
  );
  const [acquiredAtAfterDate, setAcquiredAtAfterDate] = useState<Date | null>(
    null
  );
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerId, setDatePickerId] = useState<"before" | "after">(
    "before"
  );

  const handleDatePickerInput = (id: "before" | "after") => {
    setDatePickerId(id);
    setIsDatePickerOpen(true);
  };

  const getDateValue = () => {
    return datePickerId === "before" && acquiredAtBeforeDate !== null
      ? acquiredAtBeforeDate
      : acquiredAtAfterDate !== null
      ? acquiredAtAfterDate
      : new Date();
  };

  useEffect(() => {
    if (isBottomSheetVisible) {
      setIsDatePickerOpen(false);
      const afterItem = draftQueryFilterData.find(
        (f) => f.id === `${attribute.id}_after`
      );
      const beforeItem = draftQueryFilterData.find(
        (f) => f.id === `${attribute.id}_before`
      );
      setAcquiredAtAfterDate((afterItem?.value.value as Date) ?? null);
      setAcquiredAtBeforeDate((beforeItem?.value.value as Date) ?? null);
    }
  }, [isBottomSheetVisible]);

  const handleDateChange = (newValue?: Date) => {
    if (newValue) {
      if (datePickerId === "before") setAcquiredAtBeforeDate(newValue);
      else setAcquiredAtAfterDate(newValue);
      onQueryFilterDataChange(
        filterQuery
          ? {
              filter: "None",
              field: filterQuery(
                attribute.id,
                "valueDate",
                `DateTime(${newValue.getFullYear()}, ${
                  newValue.getMonth() + 1
                }, 1, 0, 0, 0, DateTimeKind.Utc)`
              ),
              value: "",
            }
          : {
              filter: datePickerId === "before" ? "<" : ">",
              field: nestedAttributeFilterQuery(attribute.id, "valueDate"),
              value: newValue,
            },
        `${attribute.id}_${datePickerId}`
      );
    }
    setIsDatePickerOpen(false);
  };

  return (
    <>
      <CustomText style={{ marginTop: 10 }}>
        {`${attribute.name} date`}
      </CustomText>
      <View
        style={{
          position: "relative",
          width: "100%",
          justifyContent: "space-between",
          flexDirection: "row",
        }}
      >
        <TouchableOpacity
          style={{ width: "48%" }}
          onPress={() => handleDatePickerInput("after")}
        >
          <CustomTextInput
            label="After Date"
            editable={false}
            value={acquiredAtAfterDate?.toLocaleDateString() ?? ""}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={{ width: "48%" }}
          onPress={() => handleDatePickerInput("before")}
        >
          <CustomTextInput
            label="Before Date"
            editable={false}
            value={acquiredAtBeforeDate?.toLocaleDateString() ?? ""}
          />
        </TouchableOpacity>
        {isDatePickerOpen ? (
          <MonthPicker
            value={getDateValue()}
            onChange={(event, newDate) => handleDateChange(newDate)}
          />
        ) : null}
      </View>
    </>
  );
}

export default CollectionItemListDateFilter;
