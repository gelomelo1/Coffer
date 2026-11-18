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
import { usePagedQuery } from "@/src/hooks/paged_query";
import ListFooterLoading from "@/src/components/custom_ui/list_footer";
import { backendAxios } from "@/src/const/backendAccessConfiguration";
import { PAGE_SIZE, Paged } from "@/src/utils/paging";
import { useQuery } from "@tanstack/react-query";
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
  /** Index of the tab that lists only this kind. */
  tab: number;
  /** All matches of this kind (the section shows the first page). */
  total: number;
  title: string;
  data: FeedSectionItem[];
}

/** The users / collections / items tabs and their backend routes (api/Feed/Search/<route>). */
const SCOPED = [
  { type: "user", route: "Users" },
  { type: "collection", route: "Collections" },
  { type: "item", route: "Items" },
] as const;

const tagGroupId = (group: ItemTagSearch) => group.value;
const sectionItemId = (entry: FeedSectionItem) =>
  entry.type === "user" ? entry.data.id : entry.type === "collection" ? entry.data.collection.id : entry.data.item.id;

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

  // The search text, committed after a short typing pause; it is part of every search's query key.
  const [committed, setCommitted] = useState("");
  const isTagSearch = committed.length > 1 && committed[0] === "#";
  const typeIds = searchSelectedCollectionTypeIds ?? [];
  const searchParams = `searchText=${encodeURIComponent(committed)}${typeIds.length > 0 ? `&collectionTypeIds=${typeIds.join(";")}` : ""}`;

  // "#tag" search: tag groups, 20 at a time.
  const tagSearch = usePagedQuery<ItemTagSearch>(
    [querykeys.itemTagsSearchData, committed, typeIds],
    async (page) => (await backendAxios.get<Paged<ItemTagSearch>>(`${endpoints.feedSearchTag}?${searchParams}&page=${page}&pageSize=${PAGE_SIZE}`)).data,
    tagGroupId,
    { enabled: committed.length > 0 && isTagSearch },
  );

  // "All" tab: the first page of users, collections and items, with each kind's total.
  const mixed = useQuery({
    queryKey: [querykeys.mixedSearchData, committed, typeIds],
    queryFn: async () => (await backendAxios.get<MixedSearch>(`${endpoints.feedSearch}?${searchParams}`)).data,
    enabled: committed.length > 0 && !isTagSearch,
    refetchOnWindowFocus: false,
  });
  const mixedSearchData = mixed.data;

  const [open, setOpen] = useState(false);
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const scope = SCOPED[selectedTabIndex - 1];
  // Plain values: the compiler reads a closure's property accesses during render, and scope is undefined on "All".
  const scopeRoute = scope?.route;
  const scopeType = scope?.type;

  // A single kind (users / collections / items): 20 at a time as the user scrolls.
  const scoped = usePagedQuery<FeedSectionItem>(
    ["feedSearchScoped", scopeType ?? "", committed, typeIds],
    async (page) => {
      const res = (await backendAxios.get<Paged<FeedSectionItem["data"]>>(`${endpoints.feedSearch}/${scopeRoute}?${searchParams}&page=${page}&pageSize=${PAGE_SIZE}`)).data;
      return { ...res, items: res.items.map((data) => ({ type: scopeType!, data }) as FeedSectionItem) };
    },
    sectionItemId,
    { enabled: committed.length > 0 && !isTagSearch && !!scopeRoute },
  );
  const inputRef = useRef<any>(null);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    setIsTyping(true);
    setCommitted("");
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
    // The collection types are part of the search queries' keys, so the results reload by themselves.
  };

  const hasValue = searchText.length > 0;
  const hasSimpleValue = hasValue && searchText[0] !== "#";
  const hasTagValue = searchText.length > 1 && searchText[0] === "#";

  const shouldSearch =
    (hasTagValue && searchText.length >= 4) ||
    (hasSimpleValue && searchText.length >= 3);

  useEffect(() => {
    setIsTyping(true);

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    if (!hasValue || !shouldSearch) {
      setIsTyping(false);
      return;
    }

    debounceTimeout.current = setTimeout(() => {
      setIsTyping(false);
      setCommitted(searchText);
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
        { tab: 1, total: mixedSearchData.foundUsersTotal, title: t("feed:search.scopes.users"), data: mixedSearchData.foundUsers.map((u) => ({ type: "user" as const, data: u })) },
        {
          tab: 2,
          total: mixedSearchData.foundCollectionsTotal,
          title: t("feed:search.scopes.collections"),
          data: mixedSearchData.foundCollections.map((c) => ({ type: "collection" as const, data: c })),
        },
        { tab: 3, total: mixedSearchData.foundItemsTotal, title: t("feed:search.scopes.items"), data: mixedSearchData.foundItems.map((i) => ({ type: "item" as const, data: i })) },
      ]
    : [];
  const scopedData = scoped.items;
  const searching = isTagSearch ? tagSearch.isLoading : selectedTabIndex === 0 ? mixed.isLoading : scoped.isLoading;
  const pageFooter = (query: { hasNextPage: boolean; isFetchingNextPage: boolean }) =>
    query.hasNextPage || query.isFetchingNextPage ? <ListFooterLoading loading /> : endOfResults;

  const listProps = { keyboardShouldPersistTaps: "handled" as const, keyboardDismissMode: "on-drag" as const };

  const renderResults = () => {
    if (!shouldSearch) {
      return <Text style={[typography.meta, { color: colors.textMuted, padding: spacing.md }]}>{t("feed:search.minChars")}</Text>;
    }
    if (searching) return <Loading />;
    if (isTyping) return null;

    if (hasTagValue) {
      if (tagSearch.items.length === 0) return noResults;
      return (
        <FlatList
          {...listProps}
          data={tagSearch.items}
          onEndReached={tagSearch.loadMore}
          onEndReachedThreshold={0.4}
          keyExtractor={(item, index) => `${item.value}-${index}`}
          renderItem={({ item }) => <FeedSearchItemTagCard currentUser={user!} itemTagsSearch={item} closeOverlay={closeOnly} />}
          ItemSeparatorComponent={Divider}
          ListHeaderComponent={
            <SectionHeader title={t("feed:search.found", { count: tagSearch.total })} style={{ marginTop: spacing.sm, paddingHorizontal: spacing.md }} />
          }
          ListFooterComponent={pageFooter(tagSearch)}
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
              <SectionHeader title={t("feed:search.sectionCount", { title: section.title, count: section.total })} style={{ marginTop: spacing.md }} />
            </View>
          )}
          renderSectionFooter={({ section }) =>
            section.total > section.data.length ? (
              <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
                <Chip label={t("feed:search.showAll", { count: section.total })} onPress={() => setSelectedTabIndex(section.tab)} />
              </View>
            ) : null
          }
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
        onEndReached={scoped.loadMore}
        onEndReachedThreshold={0.4}
        keyExtractor={(item, index) => `${item.type}-${index}`}
        renderItem={({ item }) => renderMixedItem(item)}
        ItemSeparatorComponent={Divider}
        ListHeaderComponent={
          <SectionHeader title={t("feed:search.found", { count: scoped.total })} style={{ marginTop: spacing.sm, paddingHorizontal: spacing.md }} />
        }
        ListFooterComponent={pageFooter(scoped)}
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
