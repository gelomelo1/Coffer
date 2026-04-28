import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomDropdown from "@/src/components/custom_ui/custom_dropdown";
import CustomText from "@/src/components/custom_ui/custom_text";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import {
  acquiredAtItemFilterKey,
  nestedTagFilterQuery,
  quantityItemFilterKey,
  tagItemFilterKey,
} from "@/src/const/filter";
import { customTheme } from "@/src/theme/theme";
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
import { TouchableOpacity, View } from "react-native";
import { Overlay, Switch } from "react-native-elements";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import MonthPicker from "react-native-month-year-picker";
import { SafeAreaView } from "react-native-safe-area-context";
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
    <Overlay
      isVisible={isCollectionListFilterBottomSheetOpen.value}
      onBackdropPress={handleCloseBottomSheet}
      overlayStyle={{
        backgroundColor: customTheme.colors.background,
        margin: 0,
        padding: 0,
      }}
      fullScreen
      animationType="slide"
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View>
          <View
            style={{
              position: "relative",
              backgroundColor: customTheme.colors.background,

              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottomWidth: 2,
              borderBottomColor: customTheme.colors.primary,
              paddingBottom: 10,
              paddingHorizontal: 10,
              zIndex: 1,
              boxShadow: `0px 2px 2px ${customTheme.colors.primary}`,
            }}
          >
            <CustomButton
              title={"Reset"}
              containerStyle={{
                width: 80,
                alignSelf: "flex-start",
                borderRadius: 40,
              }}
              buttonStyle={{
                borderRadius: 40,
                margin: 0,
                padding: 0,
              }}
              onPress={resetFilters}
            />
            <MaterialIcons
              name="clear"
              size={32}
              color={customTheme.colors.primary}
              onPress={handleCloseBottomSheet}
              style={{ alignSelf: "flex-end" }}
            />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          {
            <KeyboardAwareScrollView
              enableOnAndroid
              extraScrollHeight={250}
              enableResetScrollToCoords={false}
            >
              <View
                style={{
                  paddingHorizontal: 10,
                  justifyContent: "center",
                }}
              >
                <CustomText style={{ fontSize: 24, marginLeft: 20 }}>
                  Sort
                </CustomText>
                <CustomDropdown
                  open={isSortingDropdownOpen}
                  label={"Sort by"}
                  value={draftSortId}
                  setOpen={setIsSortingDropdownOpen}
                  setValue={setDraftSortId}
                  items={generateSortRecordDataForItem(attributes)}
                />
                <CustomText
                  style={{ fontSize: 24, marginLeft: 20, marginTop: 20 }}
                >
                  Filter
                </CustomText>
                <View style={{ marginBottom: 10 }}>
                  <View
                    style={{ justifyContent: "flex-end", flexDirection: "row" }}
                  >
                    <CustomText>Duplicate</CustomText>
                    <Switch
                      value={isDuplicateSwitchOn}
                      trackColor={{ true: customTheme.colors.secondary }}
                      thumbColor={customTheme.colors.primary}
                      onValueChange={(newValue) => {
                        setIsDuplicateSwitchOn(newValue);
                        handleChangeFilterData({
                          id: quantityItemFilterKey,
                          value: {
                            filter: ">",
                            field: quantityItemFilterKey,
                            value: newValue ? 1 : 0,
                          },
                        });
                      }}
                    />
                  </View>
                  <CollectionListTagFilter
                    defaultValue={
                      (getFilterData(tagItemFilterKey)?.value
                        ?.value as string) ?? ""
                    }
                    setValue={(newValue) => {
                      if (newValue.length === 0) {
                        handleChangeFilterData({
                          id: tagItemFilterKey,
                          value: undefined,
                          filterTree: undefined,
                        });
                      } else {
                        handleChangeFilterData({
                          id: tagItemFilterKey,
                          value: {
                            filter: "None",
                            field: nestedTagFilterQuery(newValue),
                            value: `#${newValue.join(" #")}`,
                          },
                        });
                      }
                    }}
                    items={itemTags}
                  />
                  <CustomText style={{ marginTop: 10 }}>
                    First piece acquisition date
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
                  {attributes
                    .slice()
                    .sort((a, b) => {
                      if (a.primary && !b.primary) return -1;
                      if (!a.primary && b.primary) return 1;
                      return 0;
                    })
                    .map((attribute) => (
                      <CollectionItemListDynamicFilter
                        key={attribute.id}
                        attribute={attribute}
                        isBottomSheetVisible={
                          isCollectionListFilterBottomSheetOpen.value
                        }
                        onQueryFilterDataChange={(filter, id, filterTree) => {
                          console.log(filterTree);
                          handleChangeFilterData({
                            id: id ?? attribute.id,
                            value: filter,
                            filterTree: filterTree,
                          });
                        }}
                        draftQueryFilterData={
                          attribute.dataType === AttributeDataTypes.Date
                            ? [
                                getFilterData(`${attribute.id}_before`),
                                getFilterData(`${attribute.id}_after`),
                              ].filter(
                                (f): f is QueryFilterDataItem =>
                                  f !== undefined,
                              )
                            : [getFilterData(attribute.id)].filter(
                                (f): f is QueryFilterDataItem =>
                                  f !== undefined,
                              )
                        }
                      />
                    ))}
                </View>
              </View>
            </KeyboardAwareScrollView>
          }
        </View>
        <View
          style={{
            height: 80,
            backgroundColor: customTheme.colors.background,
            borderTopWidth: 2,
            borderLeftWidth: 2,
            borderRightWidth: 2,
            borderBottomColor: customTheme.colors.primary,
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
            justifyContent: "center",
            alignItems: "center",
            boxShadow: `0px -2px 2px ${customTheme.colors.primary}`,
          }}
        >
          <CustomButton
            title={"Apply"}
            containerStyle={{ width: "90%", alignSelf: "center" }}
            onPress={handleOnApply}
          />
        </View>
      </SafeAreaView>
    </Overlay>
  );
}

export default CollectionListFilterBottomSheet;
