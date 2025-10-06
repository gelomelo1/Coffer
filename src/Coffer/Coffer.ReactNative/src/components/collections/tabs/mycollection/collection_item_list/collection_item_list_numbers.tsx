import CustomText from "@/src/components/custom_ui/custom_text";
import { customTheme } from "@/src/theme/theme";
import Item from "@/src/types/entities/item";
import { QueryOptions } from "@/src/types/helpers/query_data";
import { getItemsQuantity } from "@/src/utils/data_access_utils";
import { useState } from "react";
import { TouchableOpacity, View } from "react-native";

interface CollectionItemListNumbersProps {
  items: Item[];
  queryOptions: QueryOptions;
}

function CollectionItemListNumbers({
  items,
  queryOptions,
}: CollectionItemListNumbersProps) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        style={{
          position: "absolute",
          bottom: 70,
          left: 20,
          right: 20,
          backgroundColor: customTheme.colors.primary,
          justifyContent: "space-between",
          flexDirection: "row",
          borderRadius: 20,
          paddingHorizontal: 10,
        }}
        onPress={() => setIsTooltipOpen(true)}
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
      </TouchableOpacity>
      {isTooltipOpen && (
        <>
          {/* Full-screen backdrop */}
          <TouchableOpacity
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "rgba(255,255,255,0.5)", // semi-transparent white
              zIndex: 999,
            }}
            onPress={() => setIsTooltipOpen(false)}
          />

          {/* Tooltip box */}
          <View
            style={{
              position: "absolute",
              bottom: 120, // above the bottom bar
              left: 10,
              right: 10,
              padding: 10,
              backgroundColor: customTheme.colors.primary,
              borderRadius: 8,
              zIndex: 1000,
            }}
          >
            {/* Tooltip content */}
            <CustomText
              style={{
                color: customTheme.colors.secondary,
                fontSize: 12,
                flex: 1,
              }}
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

            {/* Triangle arrow */}
            <View
              style={{
                position: "absolute",
                bottom: -8, // height of triangle
                left: 10, // distance from left
                width: 0,
                height: 0,
                borderLeftWidth: 6,
                borderRightWidth: 6,
                borderTopWidth: 8,
                borderLeftColor: "transparent",
                borderRightColor: "transparent",
                borderTopColor: customTheme.colors.primary,
              }}
            />
          </View>
        </>
      )}
    </>
  );
}

export default CollectionItemListNumbers;
