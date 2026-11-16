import { colors, spacing, typography } from "@/src/theme/theme";
import { ItemProvided } from "@/src/types/entities/item";
import { QueryOptions } from "@/src/types/helpers/query_data";
import { getItemsQuantity } from "@/src/utils/data_access_utils";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

interface CollectionItemListNumbersProps {
  items: ItemProvided[];
  queryOptions: QueryOptions;
}

/** Navy strip with item kind and piece counts, and a marker when filters are active. */
function CollectionItemListNumbers({ items, queryOptions }: CollectionItemListNumbersProps) {
  const { t } = useTranslation();
  return (
    <View style={{ backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs }}>
      <Text style={[typography.meta, { color: colors.onPrimary, flex: 1 }]}>
        {[t("collections:items.kinds", { count: items.length }), t("collections:items.pieces", { count: getItemsQuantity(items) })].join(" · ") /* i18n-ignore: two independent counts */}
      </Text>
      {queryOptions.filters ? (
        <View style={{ backgroundColor: colors.secondary, paddingHorizontal: spacing.xs, paddingVertical: 2 }}>
          <Text style={[typography.label, { color: colors.onSecondary }]}>{t("collections:items.filtersOn")}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default CollectionItemListNumbers;
