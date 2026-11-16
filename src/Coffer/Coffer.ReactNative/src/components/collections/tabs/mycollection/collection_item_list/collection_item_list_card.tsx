import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { initItemStore } from "@/src/hooks/item_store";
import { useUserStore } from "@/src/hooks/user_store";
import { pressableShadowStyle } from "@/src/theme/pressable";
import { borders, colors, fonts, spacing, typography } from "@/src/theme/theme";
import CollectionType from "@/src/types/entities/collectiontype";
import { ItemProvided } from "@/src/types/entities/item";
import ItemsLayoutMode from "@/src/types/helpers/items_layout_mode";
import { getItemPrimaryAttributeValue } from "@/src/utils/data_access_utils";
import { navigate } from "expo-router/build/global-state/routing";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable, Text, View } from "react-native";

interface CollectionItemListCardProps {
  item: ItemProvided;
  collectionType: CollectionType;
  onCardPress?: () => void;
  layoutMode: ItemsLayoutMode;
}

/** Item tile in a collection grid: image on the type color, name, quantity and first acquisition date. */
function CollectionItemListCard({ item, collectionType, onCardPress, layoutMode }: CollectionItemListCardProps) {
  const { t, i18n } = useTranslation();
  const { token } = useUserStore();
  const primaryValue = getItemPrimaryAttributeValue(item.itemAttributes);
  const compact = layoutMode === "three";
  const name = primaryValue?.value ? (primaryValue.valueString ?? "") : "";

  const handleCardPress = () => {
    if (onCardPress) onCardPress();
    else {
      initItemStore(item);
      navigate({ pathname: ROUTES.ITEMDETAILS, params: pageParams.itemdetails });
    }
  };

  return (
    <Pressable
      onPress={handleCardPress}
      accessibilityRole="button"
      accessibilityLabel={t("collections:items.cardA11y", { name, count: item.quantity })}
      style={({ pressed }) => [
        { flex: 1, maxWidth: compact ? "33%" : "50%", backgroundColor: colors.surface, borderWidth: borders.width, borderColor: colors.border },
        pressableShadowStyle(pressed),
      ]}
    >
      <View style={{ backgroundColor: collectionType.color, aspectRatio: 1, padding: compact ? spacing.xxs : spacing.xs, borderBottomWidth: borders.width, borderBottomColor: colors.border }}>
        <Image
          source={{
            uri: item.image ? `${endpoints.itemsCoverImage}/${item.image}` : `${endpoints.icons}/${collectionType.icon}`,
            headers: { Authorization: `Bearer ${token}` },
            cache: "reload",
          }}
          style={{ width: "100%", height: "100%" }}
          resizeMode={item.image ? "cover" : "contain"}
        />
        <View style={{ position: "absolute", right: 0, bottom: 0, backgroundColor: colors.primary, paddingHorizontal: spacing.xs, paddingVertical: 2 }}>
          <Text style={{ color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 12 }}>{t("collections:items.quantity", { count: item.quantity })}</Text>
        </View>
      </View>
      <View style={{ padding: compact ? spacing.xs : spacing.sm, gap: 2 }}>
        {name ? (
          <Text numberOfLines={2} style={[compact ? typography.caption : typography.label, { color: colors.text, fontFamily: fonts.bold }]}>
            {name}
          </Text>
        ) : null}
        <Text numberOfLines={2} style={[typography.caption, { color: colors.textMuted }]}>
          {t("collections:items.firstAcquired", { date: new Date(item.acquiredAt).toLocaleDateString(i18n.language) })}
        </Text>
      </View>
    </Pressable>
  );
}

export default memo(CollectionItemListCard);
