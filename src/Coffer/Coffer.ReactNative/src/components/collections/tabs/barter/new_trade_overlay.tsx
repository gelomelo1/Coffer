import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomIconButton from "@/src/components/custom_ui/custom_icon_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { Loading } from "@/src/components/custom_ui/loading";
import { emptyId } from "@/src/const/emptyId";
import { emptyTradeRequired } from "@/src/const/emptyTrade";
import { endpoints } from "@/src/const/endpoints";
import { languageFilter } from "@/src/const/filter";
import { querykeys } from "@/src/const/querykeys";
import { stringResource } from "@/src/const/resource";
import {
  useCreateData,
  useGetData,
  useUpdateData,
} from "@/src/hooks/data_hooks";
import { useNavigationModeStore } from "@/src/hooks/navigation_mode_store";
import { useTradeStore } from "@/src/hooks/trade_store";
import { customTheme } from "@/src/theme/theme";
import Attribute from "@/src/types/entities/attribute";
import { Collection } from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import { ItemProvided } from "@/src/types/entities/item";
import { Offer } from "@/src/types/entities/offer";
import { Trade, TradeRequired } from "@/src/types/entities/trade";
import TradeItem from "@/src/types/entities/trade_item";
import User from "@/src/types/entities/user";
import { QueryOptions } from "@/src/types/helpers/query_data";
import { chunkArray } from "@/src/utils/data_access_utils";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  SectionList,
  TouchableOpacity,
  View,
} from "react-native";
import { Overlay } from "react-native-elements";
import { SafeAreaView } from "react-native-safe-area-context";
import CollectionListFilterBottomSheet from "../mycollection/collection_item_list/collection_list_filter_bottomsheet";
import BarterItemSelectCard from "./barter_item_select_card";
import BarterItemSelectedCard from "./barter_item_selected_card";

interface NewTradeOverlayProps {
  isNewTradeOverlayVisible: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
  user: User;
  collection: Collection;
  collectionType: CollectionType;
  trades: Trade[];
  offers: Offer[];
  isTradesFetching: boolean;
  isOffersFetching: boolean;
  trade?: Trade;
}

function NewTradeOverlay({
  isNewTradeOverlayVisible,
  user,
  collection,
  collectionType,
  trades,
  offers,
  isTradesFetching,
  isOffersFetching,
  trade,
}: NewTradeOverlayProps) {
  const { setTrade } = useTradeStore();
  const { navigationMode } = useNavigationModeStore();
  const [queryOptions, setQueryOptions] = useState<QueryOptions>({});
  const contactDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const wantDescriptionDebounceTimer = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const moneyDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [titleError, setTitleError] = useState<string | undefined>();
  const [descriptionError, setDescriptionError] = useState<
    string | undefined
  >();
  const [wantDescriptionError, setWantDescriptionError] = useState<
    string | undefined
  >();
  const [moneyRequestedError, setMoneyRequestedError] = useState<
    string | undefined
  >();

  const { mutateAsync: createTrade, isPending: isCreateTradePending } =
    useCreateData<TradeRequired, Trade>(
      endpoints.trades,
      querykeys.myTradesData,
    );
  const { mutateAsync: updateTrade, isPending: isUpdateTradePending } =
    useUpdateData<TradeRequired, Trade>(
      endpoints.trades,
      querykeys.myTradesData,
    );

  const {
    data: items = [],
    isFetching: isItemsFetching,
    refetch,
  } = useGetData<ItemProvided>(
    endpoints.items,
    `${querykeys.itemsData}${collection.id}`,
    {
      filters: [
        {
          filter: "Match",
          field: "collectionId",
          value: collection.id,
        },
        ...(queryOptions.filters ?? []),
      ],
      sort: queryOptions.sort,
      page: queryOptions.page,
      pageSize: queryOptions.pageSize,
      filterConjunction: queryOptions.filterConjunction,
    },
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
      },
    );

  const allLoading =
    isItemsFetching ||
    isAttributesFetching ||
    isTradesFetching ||
    isOffersFetching;

  useEffect(() => {
    refetch();
  }, [queryOptions, refetch]);

  const [draftTrade, setDraftTrade] = useState(emptyTradeRequired(user.id));

  const availableItems = items.filter(
    (item) =>
      !draftTrade.tradeItems.some(
        (tradeItems) => tradeItems.itemId === item.id,
      ),
  );

  const chunkedItems = chunkArray(availableItems, 3);

  const sections = [
    { data: chunkedItems.length > 0 && !allLoading ? chunkedItems : [[]] },
  ];

  const [isStickyShadow, setIsStickyShadow] = useState(false);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;

    setIsStickyShadow(offsetY > 620);
  };

  const [
    isCollectionListFilterBottomSheetOpen,
    setIsCollectionListFilterBottomSheetOpen,
  ] = useState(false);

  const [selectedBarterItemId, setSelectedBarterItemId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (isNewTradeOverlayVisible.value === true) {
      setSelectedBarterItemId(null);
      if (trade) {
        setDraftTrade(trade);
      } else {
        setDraftTrade(emptyTradeRequired(user.id));
      }
    }
  }, [isNewTradeOverlayVisible.value]);

  const handleAddBarterItemToSelected = () => {
    if (selectedBarterItemId === null) return;

    const selectedItem = items.find((item) => item.id === selectedBarterItemId);

    setDraftTrade((prev) => ({
      ...prev,
      tradeItems: [
        {
          id: emptyId,
          tradeId: trade?.id ?? emptyId,
          itemId: selectedBarterItemId,
          item: selectedItem,
        },
        ...(prev.tradeItems || []),
      ],
    }));

    setSelectedBarterItemId(null);
  };

  const handleRemoveBarterItemFromSelected = (item: TradeItem) => {
    if (item.itemId) {
      setDraftTrade((prev) => ({
        ...prev,
        tradeItems: prev.tradeItems.filter((t) => t.itemId !== item.itemId),
      }));
    } else {
      setDraftTrade((prev) => ({
        ...prev,
        tradeItems: prev.tradeItems.filter((t) => t.id !== item.id),
      }));
    }
  };

  const validateProfanity = (value?: string) =>
    languageFilter.isProfane(value ?? "")
      ? stringResource.profaneError
      : undefined;

  const validateRequired = (value?: string) =>
    !value ? stringResource.requiredError : undefined;

  const handleInputChange = (
    field: "title" | "description" | "wantDescription" | "moneyRequested",
    value: string | undefined,
  ) => {
    setDraftTrade((prev) => ({ ...prev, [field]: value }));

    const timerRef =
      field === "title"
        ? contactDebounceTimer
        : field === "description"
          ? wantDescriptionDebounceTimer
          : field === "wantDescription"
            ? wantDescriptionDebounceTimer
            : moneyDebounceTimer;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      switch (field) {
        case "title":
          setTitleError(validateRequired(value) || validateProfanity(value));
          break;
        case "description":
          setDescriptionError(
            validateRequired(value) || validateProfanity(value),
          );
          break;
        case "wantDescription":
          setWantDescriptionError(validateProfanity(value));
          break;
        case "moneyRequested":
          setMoneyRequestedError(validateProfanity(value));
          break;
      }
    }, 1000);
  };

  const getInstantError = (
    field: "title" | "description" | "wantDescription" | "moneyRequested",
  ) => {
    const value = draftTrade[field];
    switch (field) {
      case "title":
        return validateRequired(value) || validateProfanity(value);
      case "description":
        return validateRequired(value) || validateProfanity(value);
      case "wantDescription":
        return validateProfanity(value);
      case "moneyRequested":
        return validateProfanity(value);
    }
  };

  const isAddButtonDisabled =
    !!getInstantError("title") ||
    !!getInstantError("description") ||
    !!getInstantError("wantDescription") ||
    !!getInstantError("moneyRequested") ||
    draftTrade.tradeItems.length === 0;

  const handleOverlayClose = () => {
    if (isTradesFetching || isOffersFetching) return;

    isNewTradeOverlayVisible.set(false);
  };

  const handleUploadTrade = async () => {
    console.log(JSON.stringify(draftTrade));
    try {
      if (trade) {
        const response = await updateTrade({ id: trade.id, value: draftTrade });
        console.log(JSON.stringify(response));
        setTrade(response);
      } else {
        await createTrade({ value: draftTrade });
      }
    } catch (e) {
      console.error(e);
    }
    handleOverlayClose();
  };

  return (
    <Overlay
      fullScreen
      overlayStyle={{
        backgroundColor: customTheme.colors.background,
        padding: 0,
        margin: 0,
      }}
      isVisible={isNewTradeOverlayVisible.value}
      onBackdropPress={handleOverlayClose}
    >
      <SafeAreaView>
        <SectionList
          sections={sections}
          keyExtractor={(item, index) =>
            item.map((i) => i.id).join("_") ?? index.toString()
          }
          onScroll={onScroll}
          scrollEventThrottle={16}
          ListHeaderComponent={
            <View style={{ marginHorizontal: 10 }}>
              <CustomTextInput
                label="Trade title"
                placeholder="Enter a short meaningful title"
                value={draftTrade.title}
                onChangeText={(val) => handleInputChange("title", val)}
                onBlur={() => setTitleError(getInstantError("title"))}
                errorMessage={titleError}
                style={{ marginBottom: 20 }}
              />
              <CustomTextInput
                label="Trade description"
                placeholder="Enter a description including exchange details"
                multiline
                value={draftTrade.description}
                onChangeText={(val) => handleInputChange("description", val)}
                onBlur={() =>
                  setDescriptionError(getInstantError("description"))
                }
                errorMessage={descriptionError}
                inputStyle={{ height: 160 }}
                containerStyle={{ height: 160 }}
                style={{ marginBottom: 45 }}
              />
              <CustomTextInput
                label="Request description (optional)"
                placeholder="Describe what you want in exchange"
                multiline
                value={draftTrade.wantDescription}
                onChangeText={(val) => {
                  const value = val === "" ? undefined : val;
                  handleInputChange("wantDescription", value);
                }}
                onBlur={() =>
                  setWantDescriptionError(getInstantError("wantDescription"))
                }
                errorMessage={wantDescriptionError}
                inputStyle={{ height: 160 }}
                containerStyle={{ height: 160 }}
                style={{ marginBottom: 45 }}
              />
              <CustomTextInput
                label="Money request (optional)"
                placeholder="Enter amount if money trade"
                value={draftTrade.moneyRequested}
                onChangeText={(val) => {
                  const value =
                    val === "" ? undefined : val.replace(/[^0-9]/g, "");
                  handleInputChange("moneyRequested", value);
                }}
                keyboardType="numeric"
                onBlur={() =>
                  setMoneyRequestedError(getInstantError("moneyRequested"))
                }
                errorMessage={moneyRequestedError}
                rightIcon={
                  <FontAwesome
                    name="euro"
                    size={24}
                    color={customTheme.colors.primary}
                  />
                }
                style={{ marginBottom: 50 }}
              />
            </View>
          }
          renderSectionHeader={() => (
            <View
              style={{
                backgroundColor: customTheme.colors.background,
                boxShadow: isStickyShadow
                  ? ` 0 4px 4px -4px ${customTheme.colors.disabledOverlay}`
                  : "none",
                paddingHorizontal: 10,
              }}
            >
              <CustomText style={{ fontFamily: "VendSansBold", fontSize: 18 }}>
                Selected items for trade
              </CustomText>
              {draftTrade.tradeItems.length === 0 ? (
                <CustomText
                  style={{ fontFamily: "VendSansItalic", textAlign: "center" }}
                >
                  No selected items
                </CustomText>
              ) : (
                <FlatList
                  horizontal
                  data={draftTrade.tradeItems}
                  keyExtractor={(item, index) => index.toString()}
                  renderItem={({ item }) => (
                    <BarterItemSelectedCard
                      collectionType={collectionType}
                      item={item}
                      onRemoveButtonPressed={(item) =>
                        handleRemoveBarterItemFromSelected(item as TradeItem)
                      }
                    />
                  )}
                  contentContainerStyle={{ gap: 10 }}
                  style={{ marginBottom: 10 }}
                />
              )}

              <View
                style={{
                  justifyContent: "space-between",
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <CustomIconButton
                  iconName={"arrow-up"}
                  iconType={"antdesign"}
                  title={"Add"}
                  onPress={handleAddBarterItemToSelected}
                />
                <TouchableOpacity
                  style={{
                    justifyContent: "center",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    marginLeft: 10,
                  }}
                  onPress={() => setIsCollectionListFilterBottomSheetOpen(true)}
                >
                  <CustomText style={{ fontSize: 20 }}>Filter</CustomText>
                  <Ionicons
                    name="filter"
                    size={24}
                    color={customTheme.colors.primary}
                  />
                </TouchableOpacity>
              </View>
              <CollectionListFilterBottomSheet
                isCollectionListFilterBottomSheetOpen={{
                  value: isCollectionListFilterBottomSheetOpen,
                  set: setIsCollectionListFilterBottomSheetOpen,
                }}
                items={items}
                attributes={attributes}
                setQueryOptions={setQueryOptions}
              />
              {allLoading && <Loading />}

              {!allLoading && items.length === 0 ? (
                <>
                  <View
                    style={{
                      justifyContent: "center",
                      alignItems: "center",
                      marginHorizontal: 10,
                      marginTop: 20,
                    }}
                  >
                    <CustomText
                      style={{ fontFamily: "VendSansBold", fontSize: 20 }}
                    >
                      No item found
                    </CustomText>
                  </View>
                </>
              ) : null}
            </View>
          )}
          renderItem={({ item }) => (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                gap: 10,
                marginHorizontal: 20,
              }}
            >
              {item.map((i) => (
                <BarterItemSelectCard
                  key={i.id}
                  collectionType={collectionType}
                  item={i}
                  selectedBarterItemId={{
                    value: selectedBarterItemId,
                    set: setSelectedBarterItemId,
                  }}
                  trades={trades}
                  offers={offers}
                  trade={trade}
                />
              ))}
            </View>
          )}
          stickySectionHeadersEnabled
          ListFooterComponent={
            <CustomText
              style={{
                textAlign: "center",
                fontFamily: "VendSansItalic",
                marginTop: 20,
              }}
            >
              End of list
            </CustomText>
          }
          contentContainerStyle={{
            paddingTop: 20,
            paddingBottom: 80,
          }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
        <CustomButton
          title={trade ? "Edit trade" : "Create new trade"}
          containerStyle={{
            position: "absolute",
            bottom: navigationMode.navigationBarHeight + 10,
            left: 10,
            right: 10,
          }}
          icon={
            <Ionicons
              name="create"
              size={32}
              color={customTheme.colors.secondary}
            />
          }
          disabled={isAddButtonDisabled}
          loading={isCreateTradePending || isUpdateTradePending}
          onPress={handleUploadTrade}
        />
      </SafeAreaView>
    </Overlay>
  );
}

export default NewTradeOverlay;
