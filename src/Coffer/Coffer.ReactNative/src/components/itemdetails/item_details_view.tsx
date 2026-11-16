import CustomImage from "@/src/components/custom_ui/custom_image";
import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { borders, colors, fonts, spacing, typography } from "@/src/theme/theme";
import CollectionType from "@/src/types/entities/collectiontype";
import { ItemProvided } from "@/src/types/entities/item";
import ItemTag from "@/src/types/entities/item_tag";
import { getItemAttributeValue, getItemPrimaryAttributeValue } from "@/src/utils/data_access_utils";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import ItemDetailsDynamicAttributeDisplay from "./itemdetails_dynamic_attribute_display";

/** Item image on the collection-type color with the primary attribute (name) under it. */
export function ItemHero({ item, collectionType }: { item: ItemProvided; collectionType: CollectionType }) {
  const primary = getItemPrimaryAttributeValue(item.itemAttributes);
  return (
    <View style={{ borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surface }}>
      <View style={{ backgroundColor: collectionType.color, padding: spacing.lg, alignItems: "center", borderBottomWidth: borders.width, borderBottomColor: colors.border }}>
        <View style={{ width: "80%", maxWidth: 360, aspectRatio: 1, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.bg }}>
          <CustomImage
            uri={item.image ? `${endpoints.itemsCoverImage}/${item.image}` : `${endpoints.icons}/${collectionType.icon}`}
            style={{ width: "100%", height: "100%", resizeMode: "cover" }}
            enableFullScreenView
          />
        </View>
      </View>
      <View style={{ padding: spacing.md, gap: 2 }}>
        {primary?.itemAttribute.attribute.name ? (
          <Text style={[typography.label, { color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }]}>
            {primary.itemAttribute.attribute.name}
          </Text>
        ) : null}
        <Text accessibilityRole="header" style={[typography.headline, { color: colors.text }]}>
          {primary?.valueString ?? ""}
        </Text>
      </View>
    </View>
  );
}

/** One cell of the stats grid. */
function StatCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flexBasis: "47%", flexGrow: 1, minHeight: 72, padding: spacing.sm, borderWidth: borders.width, borderColor: colors.border, gap: 2 }}>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
      {children}
    </View>
  );
}

/** Rarity / likes / quantity / first acquired, as a wrapping 2×2 grid. */
export function ItemStats({ item, rarity, likes }: { item: ItemProvided; rarity: React.ReactNode; likes: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
      <StatCell label={t("items:details.rarity")}>{rarity}</StatCell>
      <StatCell label={t("items:details.likes")}>{likes}</StatCell>
      <StatCell label={t("items:details.quantity")}>
        <Text style={[typography.title, { color: colors.text }]}>{t("items:details.pieces", { count: item.quantity })}</Text>
      </StatCell>
      <StatCell label={t("items:details.firstAcquired")}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xxs }}>
          <MaterialIcons name="event" size={18} color={colors.text} />
          <Text style={[typography.bodyStrong, { color: colors.text }]}>{new Date(item.acquiredAt).toLocaleDateString(i18n.language)}</Text>
        </View>
      </StatCell>
    </View>
  );
}

/** Titled text block with an empty-state text and an optional explanation under it. */
export function ItemTextBlock({ title, text, emptyText, helper }: { title: string; text?: string | null; emptyText: string; helper?: string }) {
  return (
    <View style={{ gap: spacing.xxs }}>
      <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
        {title}
      </Text>
      {text ? (
        <CustomText foldable maxLines={6}>
          {text}
        </CustomText>
      ) : (
        <Text style={[typography.body, { color: colors.textMuted, fontFamily: fonts.italic }]}>{emptyText}</Text>
      )}
      {helper ? <Text style={[typography.caption, { color: colors.textMuted }]}>{helper}</Text> : null}
    </View>
  );
}

/** Every non-primary attribute as a labeled row. */
export function ItemAttributeList({ item, collectionType }: { item: ItemProvided; collectionType: CollectionType }) {
  const { t } = useTranslation();
  const primary = getItemPrimaryAttributeValue(item.itemAttributes);
  const rows = item.itemAttributes.filter((a) => a.id !== primary?.itemAttribute.id);
  if (rows.length === 0) return null;
  return (
    <View style={{ gap: spacing.xs }}>
      <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
        {t("items:details.attributes")}
      </Text>
      <View style={{ borderWidth: borders.width, borderColor: colors.border }}>
        {rows.map((itemAttribute) => (
          <ItemDetailsDynamicAttributeDisplay key={itemAttribute.id} attributeValue={getItemAttributeValue(itemAttribute)} collectionType={collectionType} />
        ))}
      </View>
    </View>
  );
}

/** Read-only tag labels. */
export function ItemTags({ tags }: { tags: ItemTag[] }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
        {t("items:details.tags")}
      </Text>
      {tags.length === 0 ? (
        <Text style={[typography.meta, { color: colors.textMuted }]}>{t("items:details.noTags")}</Text>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
          {tags.map((tag, index) => (
            <View key={index} style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surfaceAlt }}>
              <Text style={[typography.label, { color: colors.text }]}>#{tag.tag}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
