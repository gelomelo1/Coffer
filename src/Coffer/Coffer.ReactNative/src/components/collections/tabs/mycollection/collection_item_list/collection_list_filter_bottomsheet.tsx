import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomDropdown from "@/src/components/custom_ui/custom_dropdown";
import { SectionHeader } from "@/src/components/custom_ui/card";
import { Chip, ChipRow } from "@/src/components/custom_ui/chip";
import MonthRangeField from "@/src/components/custom_ui/month_range_field";
import SheetModal from "@/src/components/custom_ui/sheet_modal";
import {
  acquiredAtItemFilterKey,
  nestedTagFilterQuery,
  quantityItemFilterKey,
  tagItemFilterKey,
} from "@/src/const/filter";
import { colors, spacing } from "@/src/theme/theme";
import Attribute from "@/src/types/entities/attribute";
import { ItemProvided } from "@/src/types/entities/item";
import {
  AttributeDataTypes,
  QueryFilterDataItem,
} from "@/src/types/helpers/attribute_data";
import {
  QueryFilterData,
  QueryFilterNode,
  QueryOptions,
} from "@/src/types/helpers/query_data";
import {
  generateSortRecordDataForItem,
  parseSortKeysToQuerySortData,
} from "@/src/utils/data_access_utils";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import MonthPicker from "react-native-month-year-picker";
import CollectionItemListDynamicFilter from "./collection_item_list_dynamic_filter";
import CollectionListTagFilter from "./collection_list_tag_filter";

interface CollectionListFilterBottomSheetProps {
  isCollectionListFilterBottomSheetOpen: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
  items: ItemProvided[];
  attributes: Attribute[];
  setQueryOptions: React.Dispatch<React.SetStateAction<QueryOptions>>;
  itemTags: string[];
}

function CollectionListFilterBottomSheet({
  isCollectionListFilterBottomSheetOpen,
  items,
  attributes,
  setQueryOptions,
  itemTags,
}: CollectionListFilterBottomSheetProps) {
  const { t } = useTranslation();
  const [isSortingDropdownOpen, setIsSortingDropdownOpen] = useState(false);

  const [selectedSortId, setSelectedSortId] = useState<string | null>(null);
  const [draftSortId, setDraftSortId] = useState<string | null>(null);

  const [selectedFilterDatas, setSelectedFilerDatas] = useState<
    QueryFilterDataItem[]
  >([]);
  const [draftFilterDatas, setDraftFilterDatas] = useState<
    QueryFilterDataItem[]
  >([]);

  const [isDuplicateSwitchOn, setIsDuplicateSwitchOn] = useState(false);

  const [acquiredAtBeforeDate, setAcquiredAtBeforeDate] = useState<Date | null>(
    null,
  );
  const [acquiredAtAfterDate, setAcquiredAtAfterDate] = useState<Date | null>(
    null,
  );
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerId, setDatePickerId] = useState<"before" | "after">(
    "before",
  );

  const getFilterData = (
    id: number | string,
  ): QueryFilterDataItem | undefined => {
    return selectedFilterDatas.find((item) => item.id === id);
  };

  const getFilterTree = () => {
    const filterTreeNodes: QueryFilterNode[] = draftFilterDatas
      .map((item) => item.filterTree)
      .filter((node): node is QueryFilterNode => node !== undefined);

    console.log("STRINGIFY!!!!!!!!!!!!!!!");
    console.log(JSON.stringify(filterTreeNodes[0]));

    const rootFilterTree: QueryFilterNode | undefined =
      filterTreeNodes.length === 0
        ? undefined
        : filterTreeNodes.length === 1
          ? filterTreeNodes[0] // just one node, no need for "AND"
          : { conjunction: "AND", filters: filterTreeNodes };

    return rootFilterTree;
  };

  useEffect(() => {
    if (isCollectionListFilterBottomSheetOpen.value) {
      setDraftSortId(selectedSortId);
      setDraftFilterDatas(selectedFilterDatas);
      console.log(getFilterData(quantityItemFilterKey)?.value?.value as number);
      setIsDuplicateSwitchOn(
        (getFilterData(quantityItemFilterKey)?.value?.value as number) === 1
          ? true
          : false,
      );
      setAcquiredAtBeforeDate(
        (getFilterData(`${acquiredAtItemFilterKey}_before`)?.value
          ?.value as Date) ?? null,
      );
      setAcquiredAtAfterDate(
        (getFilterData(`${acquiredAtItemFilterKey}_after`)?.value
          ?.value as Date) ?? null,
      );
      setIsDatePickerOpen(false);
    }
  }, [
    getFilterData,
    isCollectionListFilterBottomSheetOpen.value,
    selectedFilterDatas,
    selectedSortId,
  ]);

  const querySortData = draftSortId
    ? parseSortKeysToQuerySortData([draftSortId])
    : undefined;

  const handleChangeFilterData = (newItem: QueryFilterDataItem) => {
    setDraftFilterDatas((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === newItem.id);
      if (existingIndex === -1) {
        return [...prev, newItem];
      } else {
        const updated = [...prev];
        updated[existingIndex] = newItem;
        return updated;
      }
    });
  };

  const handleCloseBottomSheet = () => {
    setIsSortingDropdownOpen(false);
    isCollectionListFilterBottomSheetOpen.set(false);
  };

  const handleOnApply = () => {
    setSelectedSortId(draftSortId);
    setSelectedFilerDatas(draftFilterDatas);

    console.log(draftFilterDatas);

    setQueryOptions((prev) => ({
      ...prev,
      sort: querySortData,
      filters:
        draftFilterDatas.length > 0
          ? draftFilterDatas
              .map((item) => item.value)
              .filter((value): value is QueryFilterData => value !== undefined)
          : undefined,
      filterTree: getFilterTree(),
    }));

    handleCloseBottomSheet();
  };

  const resetFilters = () => {
    setSelectedSortId(null);
    setSelectedFilerDatas([]);

    setQueryOptions((prev) => ({
      ...prev,
      sort: undefined,
      filters: undefined,
      filterTree: undefined,
    }));

    handleCloseBottomSheet();
  };

  const handleDateChange = (newValue?: Date) => {
    if (newValue) {
      if (datePickerId === "before") setAcquiredAtBeforeDate(newValue);
      else setAcquiredAtAfterDate(newValue);
      handleChangeFilterData({
        id: `${acquiredAtItemFilterKey}_${datePickerId}`,
        value: {
          filter: datePickerId === "before" ? "<" : ">",
          field: acquiredAtItemFilterKey,
          value: newValue,
        },
      });
    }
    setIsDatePickerOpen(false);
  };

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

  return (
    <SheetModal
      visible={isCollectionListFilterBottomSheetOpen.value}
      onClose={handleCloseBottomSheet}
      title={t("collections:filter.title")}
      headerRight={<CustomButton title={t("common:actions.reset")} variant="ghost" size="sm" onPress={resetFilters} containerStyle={{ alignSelf: "center" }} />}
      footer={<CustomButton title={t("common:actions.apply")} onPress={handleOnApply} />}
    >
      <KeyboardAwareScrollView enableOnAndroid extraScrollHeight={120} enableResetScrollToCoords={false} keyboardShouldPersistTaps="handled">
        <View style={{ padding: spacing.md, paddingTop: 0, gap: spacing.md }}>
          <SectionHeader title={t("collections:filter.sortSection")} />
          <CustomDropdown
            open={isSortingDropdownOpen}
            label={t("collections:filter.sortBy")}
            value={draftSortId}
            setOpen={setIsSortingDropdownOpen}
            setValue={setDraftSortId}
            items={generateSortRecordDataForItem(attributes)}
          />

          <SectionHeader title={t("collections:filter.filterSection")} />
          <ChipRow>
            <Chip
              label={t("collections:filter.duplicates")}
              selected={isDuplicateSwitchOn}
              icon={<MaterialIcons name={isDuplicateSwitchOn ? "check-box" : "check-box-outline-blank"} size={18} color={colors.text} />}
              onPress={() => {
                const newValue = !isDuplicateSwitchOn;
                setIsDuplicateSwitchOn(newValue);
                handleChangeFilterData({
                  id: quantityItemFilterKey,
                  value: { filter: ">", field: quantityItemFilterKey, value: newValue ? 1 : 0 },
                });
              }}
            />
          </ChipRow>
          <CollectionListTagFilter
            defaultValue={(getFilterData(tagItemFilterKey)?.value?.value as string) ?? ""}
            setValue={(newValue) => {
              if (newValue.length === 0) {
                handleChangeFilterData({ id: tagItemFilterKey, value: undefined, filterTree: undefined });
              } else {
                handleChangeFilterData({
                  id: tagItemFilterKey,
                  value: { filter: "None", field: nestedTagFilterQuery(newValue), value: `#${newValue.join(" #")}` },
                });
              }
            }}
            items={itemTags}
          />
          <View style={{ gap: spacing.xs }}>
            <MonthRangeField
              label={t("collections:filter.firstAcquired")}
              after={acquiredAtAfterDate}
              before={acquiredAtBeforeDate}
              onPick={handleDatePickerInput}
            />
            {isDatePickerOpen ? <MonthPicker value={getDateValue()} onChange={(event, newDate) => handleDateChange(newDate)} /> : null}
          </View>
          {attributes
            .slice()
            .sort((a, b) => (a.primary && !b.primary ? -1 : !a.primary && b.primary ? 1 : 0))
            .map((attribute) => (
              <CollectionItemListDynamicFilter
                key={attribute.id}
                attribute={attribute}
                isBottomSheetVisible={isCollectionListFilterBottomSheetOpen.value}
                onQueryFilterDataChange={(filter, id, filterTree) => {
                  handleChangeFilterData({ id: id ?? attribute.id, value: filter, filterTree: filterTree });
                }}
                draftQueryFilterData={
                  attribute.dataType === AttributeDataTypes.Date
                    ? [getFilterData(`${attribute.id}_before`), getFilterData(`${attribute.id}_after`)].filter(
                        (f): f is QueryFilterDataItem => f !== undefined,
                      )
                    : [getFilterData(attribute.id)].filter((f): f is QueryFilterDataItem => f !== undefined)
                }
              />
            ))}
        </View>
      </KeyboardAwareScrollView>
    </SheetModal>
  );
}

export default CollectionListFilterBottomSheet;
