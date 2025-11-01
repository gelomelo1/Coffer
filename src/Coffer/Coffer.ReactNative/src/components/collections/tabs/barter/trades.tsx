import CustomText from "@/src/components/custom_ui/custom_text";
import { Loading } from "@/src/components/custom_ui/loading";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useGetData } from "@/src/hooks/data_hooks";
import { useNavigationModeStore } from "@/src/hooks/navigation_mode_store";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import Attribute from "@/src/types/entities/attribute";
import { Trade } from "@/src/types/entities/trade";
import { QueryOptions } from "@/src/types/helpers/query_data";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { FlatList, TouchableOpacity, View } from "react-native";
import TradeCard from "./trade_card";
import TradeListFilterBottomSheet from "./trade_list_filter_bottomsheet";

function Trades() {
  const [queryOptions, setQueryOptions] = useState<QueryOptions>({});
  const { collectionType } = useCollectionStore();
  const { navigationMode } = useNavigationModeStore();
  const { user } = useUserStore();

  const {
    data: tradesData = [],
    isFetching: isTradesFetching,
    refetch,
  } = useGetData<Trade>(
    `${endpoints.tradeSearch}/${user!.id}`,
    querykeys.tradesData,
    {
      filters: queryOptions.filters,
      sort: queryOptions.sort,
      page: queryOptions.page,
      pageSize: queryOptions.pageSize,
      filterConjunction: queryOptions.filterConjunction,
    }
  );

  const { data: attributes = [], isFetching: isAttributesFetching } =
    useGetData<Attribute>(
      endpoints.attributes,
      `${querykeys.attributesData}${collectionType.id}`,
      {
        filters: [
          {
            filter: "==",
            field: "collectionTypeId",
            value: collectionType.id,
          },
        ],
      }
    );

  const [
    isTradeListFilterBottomSheetOpen,
    setIsTradeListFilterBottomSheetOpen,
  ] = useState(false);

  useEffect(() => {
    refetch();
  }, [queryOptions, refetch]);

  return (
    <View style={{ width: "100%" }}>
      <FlatList
        data={isTradesFetching ? [] : tradesData}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{
          width: "100%",
          paddingBottom: navigationMode.navigationBarHeight + 50,
        }}
        renderItem={({ item }) => (
          <View style={{ marginHorizontal: 10 }}>
            <TradeCard
              trade={item}
              collectiontType={collectionType}
              isMyTrade={false}
            />
          </View>
        )}
        ListHeaderComponent={
          <>
            <View
              style={{
                width: "100%",
                paddingHorizontal: 10,
                backgroundColor: customTheme.colors.background,
                justifyContent: "space-between",
                alignItems: "center",
                flexDirection: "row",
              }}
            >
              <CustomText style={{ fontSize: 18, marginBottom: 5 }}>
                {`${tradesData.length} trades found`}
              </CustomText>

              <TouchableOpacity
                style={{
                  justifyContent: "center",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  marginLeft: 10,
                }}
                onPress={() => setIsTradeListFilterBottomSheetOpen(true)}
              >
                <CustomText style={{ fontSize: 20 }}>Filter</CustomText>
                <Ionicons
                  name="filter"
                  size={24}
                  color={customTheme.colors.primary}
                />
              </TouchableOpacity>
            </View>
            {isTradesFetching ? <Loading /> : null}
          </>
        }
        stickyHeaderIndices={[0]}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListFooterComponent={
          <CustomText
            style={{
              textAlign: "center",
              fontFamily: "VendSansItalic",
              marginTop: 20,
            }}
          >
            End of results
          </CustomText>
        }
      />
      <TradeListFilterBottomSheet
        isTradeListFilterBottomSheetOpen={{
          value: isTradeListFilterBottomSheetOpen,
          set: setIsTradeListFilterBottomSheetOpen,
        }}
        attributes={attributes}
        setQueryOptions={setQueryOptions}
      />
    </View>
  );
}

export default Trades;
