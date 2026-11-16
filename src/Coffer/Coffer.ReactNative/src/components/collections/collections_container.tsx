import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useUserStore } from "@/src/hooks/user_store";
import { pressableShadowStyle } from "@/src/theme/pressable";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import { navigate } from "expo-router/build/global-state/routing";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable, Text, useWindowDimensions, View } from "react-native";
import { Chip } from "../custom_ui/chip";

interface CollectionsContainerProps {
  collectionTypes: CollectionType[];
  collections: Collection[];
}

/** Columns for collection tiles: 2 on phones, 3 on wide screens. */
export function useTileColumns() {
  const { width } = useWindowDimensions();
  return width >= 600 ? 3 : 2;
}

/** The user's collections grouped by collection type, each group a grid of cover tiles. */
export default function CollectionsContainer({ collectionTypes, collections }: CollectionsContainerProps) {
  const { t } = useTranslation();
  const { setCollectionType, setCollection } = useCollectionStore();
  const { token } = useUserStore();
  const columns = useTileColumns();

  const [sorts, setSorts] = useState<Record<string, keyof Collection>>(
    Object.fromEntries(collectionTypes.map((collectionType) => [collectionType.id, "createdAt"])),
  );

  const toggleSort = (typeId: number) =>
    setSorts((prev) => ({ ...prev, [typeId]: prev[typeId] === "name" ? "createdAt" : "name" }));

  const open = (type: CollectionType, item: Collection) => {
    setCollectionType(type);
    setCollection(item);
    navigate({ pathname: ROUTES.MYCOLLECTION, params: pageParams.mycollection });
  };

  return (
    <View style={{ gap: spacing.xl }}>
      {collectionTypes.map((type) => {
        const matching = collections.filter((collection) => collection.collectionTypeId === type.id);
        if (matching.length === 0) return null;
        const byName = sorts[type.id] === "name";
        matching.sort(byName ? (a, b) => a.name.localeCompare(b.name) : (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

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
                <Text style={[typography.label, { color: colors.onPrimary }]}>{matching.length}</Text>
              </View>
              <View style={{ flex: 1 }} />
              <Chip
                label={byName ? t("collections:list.sortName") : t("collections:list.sortNewest")}
                accessibilityLabel={t("collections:list.sortToggle", { order: byName ? t("collections:list.sortName") : t("collections:list.sortNewest") })}
                onPress={() => toggleSort(type.id)}
              />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
              {matching.map((item) => (
                <CollectionTile key={item.id} item={item} type={type} token={token} columns={columns} onPress={() => open(type, item)} />
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
}: {
  item: Collection;
  type: CollectionType;
  token?: string | null;
  columns: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.name}
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
      </View>
      <Text numberOfLines={2} style={[typography.label, { color: colors.text, padding: spacing.sm, minHeight: 56 }]}>
        {item.name}
      </Text>
    </Pressable>
  );
}
