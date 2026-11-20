import { usePendingSummary } from "@/src/hooks/pending";
import { Tag } from "@/src/components/custom_ui/tag";
import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useUserStore } from "@/src/hooks/user_store";
import { pressableShadowStyle } from "@/src/theme/pressable";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import { navigate } from "expo-router/build/global-state/routing";
import React from "react";
import { groupInOrder } from "@/src/utils/paging";
import { useTranslation } from "react-i18next";
import { Image, Pressable, Text, useWindowDimensions, View } from "react-native";
import { Chip } from "../custom_ui/chip";

/** Per collection type: "name" (A–Z) or "createdAt" (newest first). The backend sorts, the app only toggles. */
export type CollectionSorts = Record<number, "name" | "createdAt">;

interface CollectionsContainerProps {
  collectionTypes: CollectionType[];
  /** Loaded so far, ordered by collection type (more pages load as the user scrolls). */
  collections: Collection[];
  /** Total per collection type id, for the group headers. */
  groupCounts: Record<string, number>;
  sorts: CollectionSorts;
  onToggleSort: (typeId: number) => void;
}

/** Columns for collection tiles: 2 on phones, 3 on wide screens. */
export function useTileColumns() {
  const { width } = useWindowDimensions();
  return width >= 600 ? 3 : 2;
}

/** The user's collections grouped by collection type, each group a grid of cover tiles. */
export default function CollectionsContainer({ collectionTypes, collections, groupCounts, sorts, onToggleSort }: CollectionsContainerProps) {
  const { t } = useTranslation();
  const { setCollectionType, setCollection } = useCollectionStore();
  const { token } = useUserStore();
  const columns = useTileColumns();
  // Caps waiting for review, per collection (own collections only).
  const { data: summary = [] } = usePendingSummary();
  const waiting = (id: string) => summary.find((s) => s.collectionId === id)?.count ?? 0;


  const open = (type: CollectionType, item: Collection) => {
    setCollectionType(type);
    setCollection(item);
    navigate({ pathname: ROUTES.MYCOLLECTION, params: pageParams.mycollection });
  };

  return (
    <View style={{ gap: spacing.xl }}>
      {groupInOrder(collections, (collection) => collection.collectionTypeId).map(({ id, items: matching }) => {
        const type = collectionTypes.find((ct) => ct.id === id);
        if (!type) return null;
        const byName = sorts[type.id] === "name";

        return (
          <View key={type.id} style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
              <View style={{ width: 32, height: 32, backgroundColor: type.color, borderWidth: borders.width, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
                <Image source={{ uri: `${endpoints.icons}/${type.icon}` }} style={{ width: 22, height: 22 }} />
              </View>
              <Text accessibilityRole="header" style={[typography.title, { color: colors.text, flexShrink: 1 }]}>
                {type.name}
              </Text>
              <View style={{ paddingHorizontal: spacing.xs, paddingVertical: 2, backgroundColor: colors.primary }}>
                <Text style={[typography.label, { color: colors.onPrimary }]}>{groupCounts[String(type.id)] ?? matching.length}</Text>
              </View>
              <View style={{ flex: 1 }} />
              <Chip
                label={byName ? t("collections:list.sortName") : t("collections:list.sortNewest")}
                accessibilityLabel={t("collections:list.sortToggle", { order: byName ? t("collections:list.sortName") : t("collections:list.sortNewest") })}
                onPress={() => onToggleSort(type.id)}
              />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
              {matching.map((item) => (
                <CollectionTile key={item.id} item={item} type={type} token={token} columns={columns} waiting={waiting(item.id)} onPress={() => open(type, item)} />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Pressable cover tile: square image on the type color, name below (2 lines). */
export function CollectionTile({
  item,
  type,
  token,
  columns,
  onPress,
  waiting = 0,
}: {
  item: Collection;
  type: CollectionType;
  token?: string | null;
  columns: number;
  onPress: () => void;
  /** Caps waiting for review in this collection (shown as a tag on the cover). */
  waiting?: number;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={waiting > 0 ? `${item.name}, ${t("collections:waiting.tag", { count: waiting })}` : item.name}
      style={({ pressed }) => [
        {
          // (100% - gaps) / columns, expressed as a flex basis so it adapts to any width
          flexBasis: `${100 / columns - 6}%`,
          flexGrow: 1,
          maxWidth: `${100 / columns - 2}%`,
          backgroundColor: colors.surface,
          borderWidth: borders.width,
          borderColor: colors.border,
        },
        pressableShadowStyle(pressed),
      ]}
    >
      <View style={{ backgroundColor: type.color, aspectRatio: 1, padding: spacing.sm, borderBottomWidth: borders.width, borderBottomColor: colors.border }}>
        <Image
          source={{
            uri: item.image ? `${endpoints.collectionsCoverImage}/${item.image}` : `${endpoints.icons}/${type.icon}`,
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            cache: "reload",
          }}
          style={{ width: "100%", height: "100%" }}
          resizeMode={item.image ? "cover" : "contain"}
        />
        {waiting > 0 ? (
          <View style={{ position: "absolute", top: spacing.xs, left: spacing.xs }}>
            <Tag label={t("collections:waiting.tag", { count: waiting })} color={colors.secondary} />
          </View>
        ) : null}
      </View>
      <Text numberOfLines={2} style={[typography.label, { color: colors.text, padding: spacing.sm, minHeight: 56 }]}>
        {item.name}
      </Text>
    </Pressable>
  );
}
