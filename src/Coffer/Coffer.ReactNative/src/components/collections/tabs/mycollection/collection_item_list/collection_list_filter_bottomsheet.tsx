import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomDropdown from "@/src/components/custom_ui/custom_dropdown";
import CustomText from "@/src/components/custom_ui/custom_text";
import { customTheme } from "@/src/theme/theme";
import Item from "@/src/types/entities/item";
import { QueryOptions } from "@/src/types/helpers/query_data";
import {
  generateSortRecordDataForItem,
  parseSortKeysToQuerySortData,
} from "@/src/utils/data_access_utils";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { BottomSheet } from "react-native-elements";

interface CollectionListFilterBottomSheetProps {
  isCollectionListFilterBottomSheetOpen: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
  items: Item[];
  setQueryOptions: React.Dispatch<React.SetStateAction<QueryOptions>>;
}

function CollectionListFilterBottomSheet({
  isCollectionListFilterBottomSheetOpen,
  items,
  setQueryOptions,
}: CollectionListFilterBottomSheetProps) {
  const [isSortingDropdownOpen, setIsSortingDropdownOpen] = useState(false);

  const [selectedSortId, setSelectedSortId] = useState<string | null>(null);

  const [draftSortId, setDraftSortId] = useState<string | null>(null);

  useEffect(() => {
    if (isCollectionListFilterBottomSheetOpen.value) {
      setDraftSortId(selectedSortId);
    }
  }, [isCollectionListFilterBottomSheetOpen.value, selectedSortId]);

  const querySortData = draftSortId
    ? parseSortKeysToQuerySortData([draftSortId])
    : undefined;

  const handleCloseBottomSheet = () => {
    setIsSortingDropdownOpen(false);
    isCollectionListFilterBottomSheetOpen.set(false);
  };

  const handleOnApply = () => {
    setSelectedSortId(draftSortId);

    setQueryOptions((prev) => ({
      ...prev,
      sort: querySortData,
    }));

    handleCloseBottomSheet();
  };

  return (
    // @ts-ignore
    <BottomSheet isVisible={isCollectionListFilterBottomSheetOpen.value}>
      <View
        style={{
          width: "100%",
          height: 500,
          padding: 10,
          backgroundColor: customTheme.colors.background,
        }}
      >
        <MaterialIcons
          name="clear"
          size={32}
          color={customTheme.colors.primary}
          onPress={handleCloseBottomSheet}
          style={{ alignSelf: "flex-end" }}
        />
        <CustomText style={{ fontSize: 24, marginLeft: 20 }}>Sort</CustomText>
        <CustomDropdown
          open={isSortingDropdownOpen}
          label={"Sort by"}
          value={draftSortId} // use draft state here
          setOpen={setIsSortingDropdownOpen}
          setValue={setDraftSortId}
          items={items[0] ? generateSortRecordDataForItem(items[0]) : []}
        />
        <CustomText style={{ fontSize: 24, marginLeft: 20, marginTop: 20 }}>
          Filter
        </CustomText>
        <CustomButton title={"Apply"} onPress={handleOnApply} />
      </View>
    </BottomSheet>
  );
}

export default CollectionListFilterBottomSheet;
