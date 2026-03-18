import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import {
  nestedTradeItemAttributeFilterQuery,
  quantityItemFilterKey,
  titleTradeFilterKey,
  tradeUsernameFilterQuery,
} from "@/src/const/filter";
import { customTheme } from "@/src/theme/theme";
import Attribute from "@/src/types/entities/attribute";
import {
  AttributeDataTypes,
  QueryFilterDataItem,
} from "@/src/types/helpers/attribute_data";
import { QueryOptions } from "@/src/types/helpers/query_data";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { BottomSheet } from "react-native-elements";
import CollectionItemListDynamicFilter from "../mycollection/collection_item_list/collection_item_list_dynamic_filter";

interface TradeListFilterBottomSheetProps {
  isTradeListFilterBottomSheetOpen: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
  attributes: Attribute[];
  setQueryOptions: React.Dispatch<React.SetStateAction<QueryOptions>>;
}

function TradeListFilterBottomSheet({
  isTradeListFilterBottomSheetOpen,
  attributes,
  setQueryOptions,
}: TradeListFilterBottomSheetProps) {
  const [selectedFilterDatas, setSelectedFilerDatas] = useState<
    QueryFilterDataItem[]
  >([]);
  const [draftFilterDatas, setDraftFilterDatas] = useState<
    QueryFilterDataItem[]
  >([]);

  const getFilterData = (
    id: number | string,
  ): QueryFilterDataItem | undefined => {
    return selectedFilterDatas.find((item) => item.id === id);
  };

  useEffect(() => {
    if (isTradeListFilterBottomSheetOpen.value) {
      setDraftFilterDatas(selectedFilterDatas);
      console.log(getFilterData(quantityItemFilterKey)?.value.value as number);
    }
  }, [
    getFilterData,
    isTradeListFilterBottomSheetOpen.value,
    selectedFilterDatas,
  ]);

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
    isTradeListFilterBottomSheetOpen.set(false);
  };

  const handleOnApply = () => {
    setSelectedFilerDatas(draftFilterDatas);

    setQueryOptions((prev) => ({
      ...prev,
      filters:
        draftFilterDatas.length > 0
          ? draftFilterDatas.map(
              (selectedFilterDatasItem) => selectedFilterDatasItem.value,
            )
          : undefined,
    }));

    handleCloseBottomSheet();
  };

  const resetFilters = () => {
    setSelectedFilerDatas([]);

    setQueryOptions((prev) => ({
      ...prev,
      sort: undefined,
      filters: undefined,
    }));

    handleCloseBottomSheet();
  };

  const userFilterKey = "user";

  return (
    // @ts-ignore
    <BottomSheet isVisible={isTradeListFilterBottomSheetOpen.value}>
      <ScrollView
        style={{
          width: "100%",
          padding: 10,
          backgroundColor: customTheme.colors.background,
        }}
      >
        <View style={{ justifyContent: "space-between", flexDirection: "row" }}>
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
        <View>
          <CustomTextInput
            label="Trade title contains"
            placeholder="Write any word"
            defaultValue={
              (getFilterData(titleTradeFilterKey)?.value.value as string) ?? ""
            }
            onChangeText={(newValue) =>
              handleChangeFilterData({
                id: titleTradeFilterKey,
                value: {
                  filter: "Contains",
                  field: titleTradeFilterKey,
                  value: newValue,
                  isCaseInSensitive: true,
                },
              })
            }
          />
          <CustomTextInput
            label="Trader user"
            placeholder="Write any username"
            defaultValue={
              (getFilterData(userFilterKey)?.value.value as string) ?? ""
            }
            onChangeText={(newValue) =>
              handleChangeFilterData({
                id: userFilterKey,
                value: {
                  filter: "None",
                  field: tradeUsernameFilterQuery(newValue),
                  value: newValue,
                },
              })
            }
          />
          {attributes
            .filter((a) => a.primary)
            .map((attribute) => (
              <CollectionItemListDynamicFilter
                key={attribute.id}
                attribute={attribute}
                isBottomSheetVisible={isTradeListFilterBottomSheetOpen.value}
                onQueryFilterDataChange={(filter, id) =>
                  handleChangeFilterData({
                    id: id ?? attribute.id,
                    value: filter,
                  })
                }
                draftQueryFilterData={
                  attribute.dataType === AttributeDataTypes.Date
                    ? [
                        getFilterData(`${attribute.id}_before`),
                        getFilterData(`${attribute.id}_after`),
                      ].filter((f): f is QueryFilterDataItem => f !== undefined)
                    : [getFilterData(attribute.id)].filter(
                        (f): f is QueryFilterDataItem => f !== undefined,
                      )
                }
                filterQuery={(id, attributeName, value) =>
                  nestedTradeItemAttributeFilterQuery(id, attributeName, value)
                }
              />
            ))}
        </View>
        <CustomButton
          title={"Apply"}
          onPress={handleOnApply}
          containerStyle={{ marginTop: 10 }}
        />
      </ScrollView>
    </BottomSheet>
  );
}

export default TradeListFilterBottomSheet;
