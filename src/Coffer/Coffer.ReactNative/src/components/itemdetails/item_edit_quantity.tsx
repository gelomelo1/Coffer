import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import CustomIconButton from "../custom_ui/custom_icon_button";

interface ItemEditQuantityProps {
  defaultValue: number;
  onValueChange: (newValue: number) => void;
}

/** Quantity stepper (minimum 1). */
function ItemEditQuantity({ defaultValue, onValueChange }: ItemEditQuantityProps) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(defaultValue);

  useEffect(() => {
    setQuantity(defaultValue);
  }, [defaultValue]);

  const change = (delta: number) => {
    onValueChange(quantity + delta);
    setQuantity((prev) => prev + delta);
  };

  return (
    <View style={{ gap: spacing.xxs }}>
      <Text style={[typography.label, { color: colors.text }]}>{t("items:details.quantity")}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <CustomIconButton iconType="antdesign" iconName="minus" accessibilityLabel={t("items:edit.decrease")} onPress={() => change(-1)} disabled={quantity === 1} />
        <View
          accessible
          accessibilityLabel={t("items:details.pieces", { count: quantity })}
          style={{ flex: 1, minHeight: sizes.control, borderWidth: borders.width, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={[typography.title, { color: colors.text }]} numberOfLines={1}>
            {t("items:details.pieces", { count: quantity })}
          </Text>
        </View>
        <CustomIconButton iconType="antdesign" iconName="plus" accessibilityLabel={t("items:edit.increase")} onPress={() => change(1)} />
      </View>
    </View>
  );
}

export default ItemEditQuantity;
