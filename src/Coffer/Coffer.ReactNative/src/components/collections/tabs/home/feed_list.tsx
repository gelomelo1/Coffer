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
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { homeChromeProgress, setHomeChromeProgress, settleHomeChrome, showHomeChrome, useHomeChromeLocked } from "@/src/hooks/home_chrome";
import { useNavigationModeStore } from "@/src/hooks/navigation_mode_store";
import { snapOffset, trackOffset } from "@/src/utils/hide_on_scroll";
import { parseParams } from "@/src/utils/navigation_utils";
import { useRoute } from "@react-navigation/native";
import { useFocusEffect } from "expo-router";
import { Animated, FlatList, Image, ImageBackground, NativeScrollEvent, NativeSyntheticEvent, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_CONTENT_HEIGHT, TabsHeader } from "../layout/collection_tabs_custom_layout";
import FeedCard from "./feed_card";
import FeedSearchOverlay from "./feed_search_overlay";


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

  // Facebook-style chrome: header + toolbar float over the list and slide up with the finger; the tab bar and the
  // "+" slide down in step (they read the same homeChromeProgress). Offsets are px of the top layer hidden.
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const { navigationMode } = useNavigationModeStore();
  const tabBarHeight = navigationMode.navigationBarHeight + TAB_BAR_CONTENT_HEIGHT;
  const locked = useHomeChromeLocked();
  const [layerHeight, setLayerHeight] = useState(0);
  const hideDistance = Math.max(1, layerHeight - insets.top);
  const offset = useRef(0);
  const lastY = useRef(0);
  const direction = useRef<-1 | 0 | 1>(0);
  const momentum = useRef(false);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revealChrome = useCallback(() => {
    offset.current = 0;
    showHomeChrome();
  }, []);

  // Leaving Home (tab switch, pushed screen) always restores the bars; so does turning a screen reader on.
  useFocusEffect(useCallback(() => revealChrome, [revealChrome]));
  useEffect(() => {
    if (locked) revealChrome();
  }, [locked, revealChrome]);
  useEffect(
    () => () => {
      if (snapTimer.current) clearTimeout(snapTimer.current);
    },
    [],
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - lastY.current;
    if (Math.abs(dy) >= 1) direction.current = dy > 0 ? 1 : -1;
    if (!locked && layerHeight > 0) {
      offset.current = trackOffset(offset.current, lastY.current, y, hideDistance);
      setHomeChromeProgress(offset.current / hideDistance);
    }
    lastY.current = y;
  };

  const snap = () => {
    if (locked || layerHeight === 0) return;
    offset.current = snapOffset(offset.current, lastY.current, hideDistance, direction.current);
    settleHomeChrome(offset.current === 0 ? 0 : 1);
  };

  // A drag without a fling settles right away; a fling settles when its momentum ends.
  const onScrollEndDrag = () => {
    momentum.current = false;
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => {
      if (!momentum.current) snap();
    }, 60);
  };
  const onMomentumScrollBegin = () => {
    momentum.current = true;
  };
  const onMomentumScrollEnd = () => {
    momentum.current = false;
    snap();
  };

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
    revealChrome();
    setInitialSearchText(initialText);
    setIsFeedSearchOverlayVisible(true);
  }, [revealChrome]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const rows: Feed[] = feedListData ?? [];
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
        setOpen={(value) => {
          if (value === true) revealChrome();
          setOpen(value);
        }}
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
        keyExtractor={(feed) => feed.item.id}
        ListHeaderComponent={<FeedHero count={feedListData?.length} loading={isFetching} />}
        renderItem={({ item: feed }) => (
          <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.lg }}>
            <FeedCard
              user={user!}
              collectionType={collectionTypes.find((ct) => ct.id === feed.collection.collectionTypeId)!}
              feed={feed}
              onTagPress={handleOpenSearchOverlay}
            />
          </View>
        )}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollBegin={onMomentumScrollBegin}
        onMomentumScrollEnd={onMomentumScrollEnd}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} progressViewOffset={layerHeight} />
        }
        ListFooterComponent={
          rows.length > 0 ? (
            <Text style={[typography.meta, { color: colors.textMuted, textAlign: "center", paddingVertical: spacing.xl }]}>{t("feed:caughtUp")}</Text>
          ) : isFetching ? (
            <Loading />
          ) : isError ? (
            <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
          ) : (
            <EmptyState icon="inbox" title={t("feed:empty.title")} text={t("feed:empty.text")} />
          )
        }
        contentContainerStyle={{ backgroundColor: colors.bg, paddingTop: layerHeight, paddingBottom: tabBarHeight + spacing.xxl }}
        scrollIndicatorInsets={{ top: layerHeight, bottom: tabBarHeight }}
        style={{ backgroundColor: colors.bg }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={4}
        windowSize={7}
        removeClippedSubviews
      />

      {/* Floating top chrome: header + search/filter toolbar slide up together; the status-bar band stays. */}
      <Animated.View
        onLayout={(e) => setLayerHeight(Math.round(e.nativeEvent.layout.height))}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1,
          transform: [{ translateY: homeChromeProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -hideDistance] }) }],
        }}
      >
        <TabsHeader params={parseParams(route)} />
        {renderToolbar()}
      </Animated.View>
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: colors.bg, zIndex: 2 }} />

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
