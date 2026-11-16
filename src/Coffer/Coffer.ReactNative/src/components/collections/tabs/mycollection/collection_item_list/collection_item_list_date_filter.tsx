import MonthRangeField from "@/src/components/custom_ui/month_range_field";
import { useTranslation } from "react-i18next";
import { nestedAttributeFilterQuery } from "@/src/const/filter";
import Attribute from "@/src/types/entities/attribute";
import {
  AttributeTypes,
  QueryFilterDataItem,
} from "@/src/types/helpers/attribute_data";
import { QueryFilterData } from "@/src/types/helpers/query_data";
import { useEffect, useState } from "react";
import { View } from "react-native";
import MonthPicker from "react-native-month-year-picker";

interface CollectionItemListDateFilterProps {
  attribute: Attribute;
  isBottomSheetVisible: boolean;
  onQueryFilterDataChange: (
    filter: QueryFilterData,
    id?: string | number,
  ) => void;
  draftQueryFilterData: QueryFilterDataItem[];
  filterQuery?: (
    id: number,
    attributeName: AttributeTypes,
    value: any,
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
    null,
  );
  const [acquiredAtAfterDate, setAcquiredAtAfterDate] = useState<Date | null>(
    null,
  );
  const { t } = useTranslation();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerId, setDatePickerId] = useState<"before" | "after">(
    "before",
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
        (f) => f.id === `${attribute.id}_after`,
      );
      const beforeItem = draftQueryFilterData.find(
        (f) => f.id === `${attribute.id}_before`,
      );
      setAcquiredAtAfterDate((afterItem?.value?.value as Date) ?? null);
      setAcquiredAtBeforeDate((beforeItem?.value?.value as Date) ?? null);
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
                }, 1, 0, 0, 0, DateTimeKind.Utc)`,
              ),
              value: "",
            }
          : {
              filter: datePickerId === "before" ? "<" : ">",
              field: nestedAttributeFilterQuery(attribute.id, "valueDate"),
              value: newValue,
            },
        `${attribute.id}_${datePickerId}`,
      );
    }
    setIsDatePickerOpen(false);
  };

  return (
    <View>
      <MonthRangeField
        label={t("collections:filter.dateOf", { name: attribute.name })}
        after={acquiredAtAfterDate}
        before={acquiredAtBeforeDate}
        onPick={handleDatePickerInput}
      />
      {isDatePickerOpen ? <MonthPicker value={getDateValue()} onChange={(event, newDate) => handleDateChange(newDate)} /> : null}
    </View>
  );
}

export default CollectionItemListDateFilter;
