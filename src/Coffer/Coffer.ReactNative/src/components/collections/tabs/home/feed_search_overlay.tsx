import CustomDropdownMultiple from "@/src/components/custom_ui/custom_dropdown_multiple";
import { Divider, SectionHeader } from "@/src/components/custom_ui/card";
import { Chip, ChipRow } from "@/src/components/custom_ui/chip";
import { EmptyState } from "@/src/components/custom_ui/states";
import { HeaderIconButton } from "@/src/components/layout/app_header";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { Loading } from "@/src/components/custom_ui/loading";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCollectionTypeStore } from "@/src/hooks/collection_type_store";
import { useGetData, useGetSingleData } from "@/src/hooks/data_hooks";
import { useUserStore } from "@/src/hooks/user_store";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import CollectionSearch from "@/src/types/entities/collection_search";
import ItemSearch from "@/src/types/entities/item_search";
import ItemTagSearch from "@/src/types/entities/item_tags_search";
import MixedSearch from "@/src/types/entities/mixed_search";
import User from "@/src/types/entities/user";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Image, Modal, SectionList, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import FeedSearchItemTagCard from "./feed_card_item_tags_card";
import FeedSearchItemCard from "./feed_seach_item_card";
import FeedSearchUserCard from "./feed_seach_user_card";
import FeedSearchCollectionCard from "./feed_search_collection_card";

import { asyncstoragekeys } from "@/src/const/async_storage_keys";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface FeedSearchOverlayProps {
  isFeedSearchOverlayVisible: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
  selectedCollectionTypeIds: number[] | null;
  onClose: (searchSelectedCollectionTypeIds: number[] | null) => void;
  initialSearchText?: string;
}

type FeedSectionItem =
  | { type: "user"; data: User }
  | { type: "collection"; data: CollectionSearch }
  | { type: "item"; data: ItemSearch };

interface FeedSection {
  title: string;
  data: FeedSectionItem[];
}

function FeedSearchOverlay({
  isFeedSearchOverlayVisible,
  selectedCollectionTypeIds,
  onClose,
  initialSearchText,
}: FeedSearchOverlayProps) {
  const { t } = useTranslation();
  const { token, user } = useUserStore();
  const { collectionTypes } = useCollectionTypeStore();

  const [searchText, setSearchText] = useState("");

  const [searchSelectedCollectionTypeIds, setSearchSelectedCollectionTypeIds] =
    useState<number[] | null>(selectedCollectionTypeIds);

  const { data: itemTagsSearchData = [], refetch: itemTagsSearchRefetch } =
    useGetData<ItemTagSearch>(
      searchSelectedCollectionTypeIds!.length > 0
        ? `${endpoints.feedSearchTag}?searchText=${encodeURIComponent(
            searchText,
          )}&collectionTypeIds=${searchSelectedCollectionTypeIds!.join(";")}`
        : `${endpoints.feedSearchTag}?searchText=${encodeURIComponent(
            searchText,
          )}`,
      querykeys.itemTagsSearchData,
      undefined,
      undefined,
      { enabled: false, queryKey: [querykeys.itemTagsSearchData] },
    );

  const { data: mixedSearchData, refetch: mixedSearchRefetch } =
    useGetSingleData<MixedSearch>(
      searchSelectedCollectionTypeIds!.length > 0
        ? `${endpoints.feedSearch}?searchText=${encodeURIComponent(
            searchText,
          )}&collectionTypeIds=${searchSelectedCollectionTypeIds!.join(";")}`
        : `${endpoints.feedSearch}?searchText=${encodeURIComponent(
            searchText,
          )}`,
      querykeys.mixedSearchData,
      undefined,
      undefined,
      undefined,
      { enabled: false, queryKey: [querykeys.mixedSearchData] },
      true,
    );

  const [open, setOpen] = useState(false);
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const inputRef = useRef<any>(null);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const dropdownItems = collectionTypes.map((type) => ({
    label: type.name,
    value: type.id,
    additionalElement: (
      <Image
        source={{
          uri: `${endpoints.icons}/${type.icon}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "reload",
        }}
        style={{
          width: 28,
          height: 28,
        }}
      />
    ),
  }));

  useEffect(() => {
    setSearchText("");
    setIsLoading(false);
    setIsTyping(true);
    if (isFeedSearchOverlayVisible.value) {
      setSearchSelectedCollectionTypeIds(selectedCollectionTypeIds);
      setSearchText(initialSearchText ?? "");
    }
    if (isFeedSearchOverlayVisible.value && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isFeedSearchOverlayVisible.value]);

  const handleCloseFeedSearch = () => {
    isFeedSearchOverlayVisible.set(false);
    onClose(searchSelectedCollectionTypeIds);
  };

  const handleFilterSelect = async () => {
    await AsyncStorage.setItem(
      asyncstoragekeys.feedCollectionTypeFilters,
      JSON.stringify(searchSelectedCollectionTypeIds),
    );

    if (hasValue) {
      if (hasTagValue) {
        await itemTagsSearchRefetch();
      } else {
        await mixedSearchRefetch();
      }
    }
  };

  const hasValue = searchText.length > 0;
  const hasSimpleValue = hasValue && searchText[0] !== "#";
  const hasTagValue = searchText.length > 1 && searchText[0] === "#";

  const shouldSearch =
    (hasTagValue && searchText.length >= 4) ||
    (hasSimpleValue && searchText.length >= 3);

  useEffect(() => {
    setIsLoading(false);
    setIsTyping(true);

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    if (!hasValue || !shouldSearch) {
      setIsTyping(false);
      return;
    }

    debounceTimeout.current = setTimeout(async () => {
      setIsTyping(false);
      setIsLoading(true);

      if (hasTagValue) {
        await itemTagsSearchRefetch();
      } else if (hasSimpleValue) {
        await mixedSearchRefetch();
      }

      setIsLoading(false);
    }, 1000);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [searchText]);

  const closeOnly = () => isFeedSearchOverlayVisible.set(false);
  const selectedCount = searchSelectedCollectionTypeIds?.length ?? 0;
  const scopes = ["all", "users", "collections", "items"] as const;

  const endOfResults = (
    <Text style={[typography.meta, { color: colors.textMuted, textAlign: "center", padding: spacing.lg }]}>{t("feed:search.endOfResults")}</Text>
  );
  const noResults = <EmptyState icon="search-off" title={t("feed:search.noResults")} text={t("feed:search.noResultsHint")} />;

  const renderMixedItem = (item: FeedSectionItem) => {
    switch (item.type) {
      case "user":
        return <FeedSearchUserCard user={item.data} />;
      case "collection":
        return <FeedSearchCollectionCard currentUser={user!} collectionSearch={item.data} closeOverlay={closeOnly} />;
      case "item":
        return <FeedSearchItemCard currentUser={user!} itemSearch={item.data} closeOverlay={closeOnly} />;
    }
  };

  const mixedSections: FeedSection[] = mixedSearchData
    ? [
        { title: t("feed:search.scopes.users"), data: mixedSearchData.foundUsers.map((u) => ({ type: "user" as const, data: u })) },
        { title: t("feed:search.scopes.collections"), data: mixedSearchData.foundCollections.map((c) => ({ type: "collection" as const, data: c })) },
        { title: t("feed:search.scopes.items"), data: mixedSearchData.foundItems.map((i) => ({ type: "item" as const, data: i })) },
      ]
    : [];
  const scopedData: FeedSectionItem[] = selectedTabIndex === 0 ? [] : (mixedSections[selectedTabIndex - 1]?.data ?? []);

  const listProps = { keyboardShouldPersistTaps: "handled" as const, keyboardDismissMode: "on-drag" as const };

  const renderResults = () => {
    if (!shouldSearch) {
      return <Text style={[typography.meta, { color: colors.textMuted, padding: spacing.md }]}>{t("feed:search.minChars")}</Text>;
    }
    if (isLoading) return <Loading />;
    if (isTyping) return null;

    if (hasTagValue) {
      if (itemTagsSearchData.length === 0) return noResults;
      return (
        <FlatList
          {...listProps}
          data={itemTagsSearchData}
          keyExtractor={(item, index) => `${item.value}-${index}`}
          renderItem={({ item }) => <FeedSearchItemTagCard currentUser={user!} itemTagsSearch={item} closeOverlay={closeOnly} />}
          ItemSeparatorComponent={Divider}
          ListHeaderComponent={
            <SectionHeader title={t("feed:search.found", { count: itemTagsSearchData.length })} style={{ marginTop: spacing.sm, paddingHorizontal: spacing.md }} />
          }
          ListFooterComponent={endOfResults}
        />
      );
    }

    if (!mixedSearchData) return noResults;

    if (selectedTabIndex === 0) {
      if (mixedSections.every((section) => section.data.length === 0)) return noResults;
      return (
        <SectionList<FeedSectionItem, FeedSection>
          {...listProps}
          sections={mixedSections.filter((section) => section.data.length > 0)}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          renderItem={({ item }) => renderMixedItem(item)}
          renderSectionHeader={({ section }) => (
            <View style={{ backgroundColor: colors.bg, paddingHorizontal: spacing.md }}>
              <SectionHeader title={t("feed:search.sectionCount", { title: section.title, count: section.data.length })} style={{ marginTop: spacing.md }} />
            </View>
          )}
          ItemSeparatorComponent={Divider}
          stickySectionHeadersEnabled
          ListFooterComponent={endOfResults}
        />
      );
    }

    if (scopedData.length === 0) return noResults;
    return (
      <FlatList
        {...listProps}
        data={scopedData}
        keyExtractor={(item, index) => `${item.type}-${index}`}
        renderItem={({ item }) => renderMixedItem(item)}
        ItemSeparatorComponent={Divider}
        ListHeaderComponent={
          <SectionHeader title={t("feed:search.found", { count: scopedData.length })} style={{ marginTop: spacing.sm, paddingHorizontal: spacing.md }} />
        }
        ListFooterComponent={endOfResults}
      />
    );
  };

  return (
    <Modal visible={isFeedSearchOverlayVisible.value} onRequestClose={handleCloseFeedSearch} animationType="slide" statusBarTranslucent navigationBarTranslucent>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ padding: spacing.md, gap: spacing.sm, borderBottomWidth: borders.width, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
              <CustomTextInput
                ref={inputRef}
                variant="search"
                value={searchText}
                onChangeText={setSearchText}
                onClear={() => setSearchText("")}
                placeholder={t("feed:searchPlaceholder")}
                autoCapitalize="none"
                autoCorrect={false}
                style={{ flex: 1 }}
              />
              <HeaderIconButton icon="close" label={t("accessibility:close")} onPress={handleCloseFeedSearch} />
            </View>
            <CustomDropdownMultiple
              value={searchSelectedCollectionTypeIds}
              open={open}
              setOpen={setOpen}
              setValue={setSearchSelectedCollectionTypeIds}
              items={dropdownItems}
              placeholder={t("feed:filter.placeholder")}
              modalTitle={t("feed:filter.modalTitle")}
              multipleText={selectedCount > 0 ? t("feed:filter.selected", { count: selectedCount }) : undefined}
              onClose={handleFilterSelect}
            />
            {shouldSearch && hasSimpleValue ? (
              <ChipRow>
                {scopes.map((scope, i) => (
                  <Chip key={scope} label={t(`feed:search.scopes.${scope}`)} selected={selectedTabIndex === i} onPress={() => setSelectedTabIndex(i)} />
                ))}
              </ChipRow>
            ) : null}
          </View>
          <View style={{ flex: 1 }}>{renderResults()}</View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

export default FeedSearchOverlay;
