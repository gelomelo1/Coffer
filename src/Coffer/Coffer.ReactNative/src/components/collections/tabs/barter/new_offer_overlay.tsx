import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomIconButton from "@/src/components/custom_ui/custom_icon_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { Loading } from "@/src/components/custom_ui/loading";
import { emptyId } from "@/src/const/emptyId";
import { emptyOfferRequired } from "@/src/const/emptyOffer";
import { endpoints } from "@/src/const/endpoints";
import { languageFilter } from "@/src/const/filter";
import { querykeys } from "@/src/const/querykeys";
import { stringResource } from "@/src/const/resource";
import {
  useCreateData,
  useGetData,
  useGetSingleData,
  useUpdateData,
} from "@/src/hooks/data_hooks";
import { useNavigationModeStore } from "@/src/hooks/navigation_mode_store";
import { useOfferStore } from "@/src/hooks/offer_store";
import { useTradeStore } from "@/src/hooks/trade_store";
import { customTheme } from "@/src/theme/theme";
import Attribute from "@/src/types/entities/attribute";
import { Collection } from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import { ItemProvided } from "@/src/types/entities/item";
import { Offer, OfferRequired } from "@/src/types/entities/offer";
import OfferItem from "@/src/types/entities/offer_item";
import { Trade } from "@/src/types/entities/trade";
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

interface NewOfferOverlayProps {
  isNewOfferOverlayVisible: {
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
  trade: Trade;
  offer?: Offer;
}

function NewOfferOverlay({
  isNewOfferOverlayVisible,
  user,
  collection,
  collectionType,
  trades,
  offers,
  isTradesFetching,
  isOffersFetching,
  trade,
  offer,
}: NewOfferOverlayProps) {
  const { setTrade } = useTradeStore();
  const { setOffer } = useOfferStore();
  const { navigationMode } = useNavigationModeStore();
  const [queryOptions, setQueryOptions] = useState<QueryOptions>({});
  const moneyDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [moneyRequestedError, setMoneyRequestedError] = useState<
    string | undefined
  >();

  const { mutateAsync: createOffer, isPending: isCreateOfferPending } =
    useCreateData<OfferRequired, Offer>(
      endpoints.offers,
      `${querykeys.myOffersData};${querykeys.tradesData}`
    );
  const { mutateAsync: updateOffer, isPending: isUpdateOfferPending } =
    useUpdateData<OfferRequired, Offer>(
      endpoints.offers,
      `${querykeys.myOffersData};${querykeys.tradesData}`
    );

  const { refetch: refetchTrade } = useGetSingleData<Trade>(
    endpoints.trades,
    querykeys.tradeData,
    trade.id,
    undefined,
    undefined,
    { enabled: false, queryKey: [querykeys.tradeData] }
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

  const allLoading =
    isItemsFetching ||
    isAttributesFetching ||
    isTradesFetching ||
    isOffersFetching;

  useEffect(() => {
    refetch();
  }, [queryOptions, refetch]);

  const [draftOffer, setDraftOffer] = useState(
    emptyOfferRequired(user.id, trade.id)
  );

  const availableItems = items.filter(
    (item) =>
      !draftOffer.offerItems.some((offerItems) => offerItems.itemId === item.id)
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
    if (isNewOfferOverlayVisible.value === true) {
      setSelectedBarterItemId(null);
      if (offer) {
        setDraftOffer({ ...offer, status: "pending" });
      } else {
        setDraftOffer(emptyOfferRequired(user.id, trade.id));
      }
    }
  }, [isNewOfferOverlayVisible.value]);

  const handleAddBarterItemToSelected = () => {
    if (selectedBarterItemId === null) return;

    const selectedItem = items.find((item) => item.id === selectedBarterItemId);

    setDraftOffer((prev) => ({
      ...prev,
      offerItems: [
        {
          id: emptyId,
          offerId: offer?.id ?? emptyId,
          itemId: selectedBarterItemId,
          item: selectedItem,
        },
        ...(prev.offerItems || []),
      ],
    }));

    setSelectedBarterItemId(null);
  };

  const handleRemoveBarterItemFromSelected = (item: OfferItem) => {
    if (item.itemId) {
      setDraftOffer((prev) => ({
        ...prev,
        offerItems: prev.offerItems.filter((o) => o.itemId !== item.itemId),
      }));
    } else {
      setDraftOffer((prev) => ({
        ...prev,
        offerItems: prev.offerItems.filter((o) => o.id !== item.id),
      }));
    }
  };

  const validateProfanity = (value?: string) =>
    languageFilter.isProfane(value ?? "")
      ? stringResource.profaneError
      : undefined;

  const handleInputChange = (value: string | undefined) => {
    setDraftOffer((prev) => ({ ...prev, moneyOffer: value }));

    const timerRef = moneyDebounceTimer;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      setMoneyRequestedError(validateProfanity(value));
    }, 1000);
  };

  const getInstantError = () => {
    const value = draftOffer.moneyOffer;
    return validateProfanity(value);
  };

  const isAddButtonDisabled =
    !!getInstantError() ||
    (draftOffer.offerItems.length === 0 &&
      (draftOffer.moneyOffer === undefined || draftOffer.moneyOffer === ""));

  const handleOverlayClose = () => {
    if (isTradesFetching || isOffersFetching) return;

    isNewOfferOverlayVisible.set(false);
  };

  const handleUploadTrade = async () => {
    console.log(JSON.stringify(draftOffer));
    try {
      if (offer) {
        const response = await updateOffer({ id: offer.id, value: draftOffer });
        console.log(JSON.stringify(response));
        setOffer(response);
      } else {
        await createOffer({ value: draftOffer });
      }

      const tradeResponse = (await refetchTrade()).data;
      if (tradeResponse) {
        setTrade(tradeResponse);
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
      isVisible={isNewOfferOverlayVisible.value}
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
                label="Money request (optional)"
                placeholder="Enter amount if money offer"
                value={draftOffer.moneyOffer?.toString() ?? ""}
                onChangeText={(val) => {
                  const value =
                    val === "" ? undefined : val.replace(/[^0-9]/g, "");
                  handleInputChange(value);
                }}
                keyboardType="numeric"
                onBlur={() => setMoneyRequestedError(getInstantError())}
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
              {draftOffer.offerItems.length === 0 ? (
                <CustomText
                  style={{ fontFamily: "VendSansItalic", textAlign: "center" }}
                >
                  No selected items
                </CustomText>
              ) : (
                <FlatList
                  horizontal
                  data={draftOffer.offerItems}
                  keyExtractor={(item, index) => index.toString()}
                  renderItem={({ item }) => (
                    <BarterItemSelectedCard
                      collectionType={collectionType}
                      item={item}
                      onRemoveButtonPressed={(item) =>
                        handleRemoveBarterItemFromSelected(item as OfferItem)
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
                  trade={undefined}
                  offer={offer}
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
          title={
            offer
              ? offer.status === "rejected"
                ? "Resend offer"
                : "Edit offer"
              : "Create new offer"
          }
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
          loading={isCreateOfferPending || isUpdateOfferPending}
          onPress={handleUploadTrade}
        />
      </SafeAreaView>
    </Overlay>
  );
}

export default NewOfferOverlay;
