import CustomText from "@/src/components/custom_ui/custom_text";
import { customTheme } from "@/src/theme/theme";
import { ItemProvided } from "@/src/types/entities/item";
import { QueryOptions } from "@/src/types/helpers/query_data";
import { getItemsQuantity } from "@/src/utils/data_access_utils";
import { View } from "react-native";

interface CollectionItemListNumbersProps {
  items: ItemProvided[];
  queryOptions: QueryOptions;
}

function CollectionItemListNumbers({
  items,
  queryOptions,
}: CollectionItemListNumbersProps) {
  return (
    <>
      <View
        style={{
          backgroundColor: customTheme.colors.primary,
          justifyContent: "space-between",
          flexDirection: "row",
          borderRadius: 20,
          paddingHorizontal: 10,
        }}
      >
        <CustomText
          style={{
            color: customTheme.colors.secondary,
            fontSize: 12,
            flex: 1,
            marginRight: 10,
          }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          <CustomText
            style={{
              color: customTheme.colors.secondary,
              fontFamily: "VendSansBold",
              fontSize: 14,
            }}
          >
            {items.length.toLocaleString()}
          </CustomText>
          {` types of items, totaling `}
          <CustomText
            style={{
              color: customTheme.colors.secondary,
              fontFamily: "VendSansBold",
              fontSize: 12,
            }}
          >
            {getItemsQuantity(items).toLocaleString()}
          </CustomText>
          {` pieces`}
        </CustomText>
        {queryOptions.filters ? (
          <CustomText
            style={{
              color: customTheme.colors.secondary,
              fontFamily: "VendSansBold",
              fontSize: 12,
            }}
          >
            Filters on
          </CustomText>
        ) : null}
      </View>
    </>
  );
}

export default CollectionItemListNumbers;
