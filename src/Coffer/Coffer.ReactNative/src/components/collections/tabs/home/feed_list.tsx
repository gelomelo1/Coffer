import CustomDropdownMultiple from "@/src/components/custom_ui/custom_dropdown_multiple";
import { Loading } from "@/src/components/custom_ui/loading";
import { EmptyState, ErrorState } from "@/src/components/custom_ui/states";
import { asyncstoragekeys } from "@/src/const/async_storage_keys";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCollectionTypeStore } from "@/src/hooks/collection_type_store";
import { useGetData } from "@/src/hooks/data_hooks";
import { useUserStore } from "@/src/hooks/user_store";
import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import Feed from "@/src/types/entities/feed";
import { apiErrorText } from "@/src/utils/api_error_text";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { FlatList, Image, ImageBackground, Pressable, RefreshControl, Text, View } from "react-native";
import FeedCard from "./feed_card";
import FeedSearchOverlay from "./feed_search_overlay";

/** List rows: the sticky toolbar is the first data row so FlatList can pin it while the hero scrolls away. */
type FeedRow = { kind: "toolbar" } | { kind: "post"; feed: Feed };

function FeedHero({ count, loading }: { count?: number; loading: boolean }) {
  const { t } = useTranslation();
  return (
    <ImageBackground
      source={require("../../../../../assets/images/home_background.jpg")}
      resizeMode="cover"
      style={{ minHeight: 150, justifyContent: "flex-end", backgroundColor: colors.primary }}
      imageStyle={{ opacity: 0.35 }}
    >
      <View style={{ padding: spacing.md, gap: spacing.xs }}>
        <Text accessibilityRole="header" style={[typography.display, { color: colors.onPrimary }]}>
          <Trans i18nKey="feed:hero.title" components={{ 1: <Text style={{ color: colors.secondary }} /> }} />
        </Text>
        <Text style={[typography.label, { color: colors.onPrimary }]}>
          {loading || count === undefined ? " " : t("feed:hero.recentPosts", { count })}
        </Text>
      </View>
    </ImageBackground>
  );
}

function FeedList() {
  const { t } = useTranslation();
  const { collectionTypes } = useCollectionTypeStore();
  const { token, user } = useUserStore();

  const [pendingRefetch, setPendingRefetch] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedCollectionTypeIds, setSelectedCollectionTypeIds] = useState<number[] | null>([]);
  const [isFeedSearchOverlayVisible, setIsFeedSearchOverlayVisible] = useState(false);
  const [initialSearchText, setInitialSearchText] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);

  const dropdownItems = collectionTypes.map((type) => ({
    label: type.name,
    value: type.id,
    additionalElement: (
      <Image
        source={{ uri: `${endpoints.icons}/${type.icon}`, headers: { Authorization: `Bearer ${token}` }, cache: "reload" }}
        style={{ width: 28, height: 28 }}
      />
    ),
  }));

  const { data: feedListData, isFetching, isError, error, refetch } = useGetData<Feed>(
    `${endpoints.feed}`,
    querykeys.feedListData,
    selectedCollectionTypeIds && selectedCollectionTypeIds.length > 0
      ? {
          filters: selectedCollectionTypeIds.map((id) => ({ filter: "==", field: "Collection.CollectionTypeId", value: id })),
          filterConjunction: "OR",
        }
      : undefined,
  );

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const stored = await AsyncStorage.getItem(asyncstoragekeys.feedCollectionTypeFilters);
        if (stored) {
          setPendingRefetch(true);
          setSelectedCollectionTypeIds(JSON.parse(stored) as number[]);
        } else {
          setSelectedCollectionTypeIds([]);
        }
      } catch (e) {
        console.error("Failed to load collection type filters", e);
        setSelectedCollectionTypeIds([]);
      }
    };
    loadFilters();
  }, []);

  const handleFilterSelect = async () => {
    await AsyncStorage.setItem(asyncstoragekeys.feedCollectionTypeFilters, JSON.stringify(selectedCollectionTypeIds));
    await refetch();
  };

  const handleSearchOverlayClose = (searchSelectedCollectionTypeIds: number[] | null) => {
    const current = selectedCollectionTypeIds ?? [];
    const next = searchSelectedCollectionTypeIds ?? [];
    if (current.length !== next.length || !current.every((id, index) => id === next[index])) {
      setSelectedCollectionTypeIds([...next]);
      setPendingRefetch(true);
    }
  };

  useEffect(() => {
    if (pendingRefetch) {
      refetch();
      setPendingRefetch(false);
    }
  }, [selectedCollectionTypeIds, pendingRefetch, refetch]);

  const handleOpenSearchOverlay = useCallback((initialText?: string) => {
    setInitialSearchText(initialText);
    setIsFeedSearchOverlayVisible(true);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const rows: FeedRow[] = [{ kind: "toolbar" }, ...(feedListData ?? []).map((feed) => ({ kind: "post" as const, feed }))];
  const selectedCount = selectedCollectionTypeIds?.length ?? 0;

  const renderToolbar = () => (
    <View
      style={{
        backgroundColor: colors.bg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        gap: spacing.sm,
        borderBottomWidth: borders.width,
        borderBottomColor: colors.border,
      }}
    >
      <Pressable
        onPress={() => handleOpenSearchOverlay()}
        accessibilityRole="search"
        accessibilityLabel={t("feed:searchPlaceholder")}
        style={({ pressed }) => ({
          minHeight: sizes.control,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          paddingHorizontal: spacing.sm,
          borderWidth: borders.width,
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
        })}
      >
        <MaterialIcons name="search" size={sizes.iconMd} color={colors.text} />
        <Text numberOfLines={1} style={[typography.body, { color: colors.textMuted, flex: 1 }]}>
          {t("feed:searchPlaceholder")}
        </Text>
      </Pressable>
      <CustomDropdownMultiple
        value={selectedCollectionTypeIds}
        open={open}
        setOpen={setOpen}
        setValue={setSelectedCollectionTypeIds}
        items={dropdownItems}
        placeholder={t("feed:filter.placeholder")}
        modalTitle={t("feed:filter.modalTitle")}
        multipleText={selectedCount > 0 ? t("feed:filter.selected", { count: selectedCount }) : undefined}
        onClose={handleFilterSelect}
      />
    </View>
  );

  return (
    <>
      <FlatList
        data={rows}
        keyExtractor={(row) => (row.kind === "toolbar" ? "toolbar" : row.feed.item.id)}
        stickyHeaderIndices={[1]}
        ListHeaderComponent={<FeedHero count={feedListData?.length} loading={isFetching} />}
        renderItem={({ item: row }) =>
          row.kind === "toolbar" ? (
            renderToolbar()
          ) : (
            <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.lg }}>
              <FeedCard
                user={user!}
                collectionType={collectionTypes.find((ct) => ct.id === row.feed.collection.collectionTypeId)!}
                feed={row.feed}
                onTagPress={handleOpenSearchOverlay}
              />
            </View>
          )
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
        ListFooterComponent={
          rows.length > 1 ? (
            <Text style={[typography.meta, { color: colors.textMuted, textAlign: "center", paddingVertical: spacing.xl }]}>{t("feed:caughtUp")}</Text>
          ) : isFetching ? (
            <Loading />
          ) : isError ? (
            <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
          ) : (
            <EmptyState icon="inbox" title={t("feed:empty.title")} text={t("feed:empty.text")} />
          )
        }
        contentContainerStyle={{ backgroundColor: colors.bg, paddingBottom: spacing.xxl * 2 }}
        style={{ backgroundColor: colors.bg }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={4}
        windowSize={7}
        removeClippedSubviews
      />
      <FeedSearchOverlay
        isFeedSearchOverlayVisible={{ value: isFeedSearchOverlayVisible, set: setIsFeedSearchOverlayVisible }}
        selectedCollectionTypeIds={selectedCollectionTypeIds}
        onClose={handleSearchOverlayClose}
        initialSearchText={initialSearchText}
      />
    </>
  );
}

export default FeedList;
