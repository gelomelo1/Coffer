import CustomImage from "@/src/components/custom_ui/custom_image";
import { endpoints } from "@/src/const/endpoints";
import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ImageStyle, Pressable, StyleProp, Text, View, ViewStyle } from "react-native";

// Shared primitives live in custom_ui; re-exported so existing market imports keep working.
export { SectionCard } from "@/src/components/custom_ui/card";
export { Chip, ChipRow } from "@/src/components/custom_ui/chip";
export { EmptyState, ErrorText, Label } from "@/src/components/custom_ui/states";
export { Tag } from "@/src/components/custom_ui/tag";

/** Payment/shipping risk warning required on the feed, listings and before deals. */
export function WarningBanner({ collapsible = false }: { collapsible?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(!collapsible);
  const content = (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        <MaterialIcons name="warning" size={sizes.iconSm} color={colors.danger} />
        <Text style={[typography.bodyStrong, { color: colors.text, flex: 1 }]}>{t("market:warning.title")}</Text>
        {collapsible ? <MaterialIcons name={open ? "expand-less" : "expand-more"} size={sizes.iconMd} color={colors.text} /> : null}
      </View>
      {open ? <Text style={[typography.meta, { color: colors.text }]}>{t("market:warning.text")}</Text> : null}
    </>
  );
  const boxStyle: ViewStyle = {
    borderWidth: borders.width,
    borderColor: colors.primary,
    borderLeftWidth: 6,
    borderLeftColor: colors.danger,
    backgroundColor: colors.bg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xxs,
  };
  if (!collapsible) return <View style={boxStyle}>{content}</View>;
  return (
    <Pressable
      onPress={() => setOpen(!open)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={({ pressed }) => [boxStyle, pressed && { backgroundColor: colors.surfaceAlt }]}
    >
      {content}
    </Pressable>
  );
}

/** 1–5 stars; interactive when onChange is given (each star is a 48dp target). */
export function StarRating({ value, onChange, size = 18 }: { value: number; onChange?: (stars: number) => void; size?: number }) {
  const { t } = useTranslation();
  return (
    <View
      style={{ flexDirection: "row", gap: onChange ? spacing.xxs : 2 }}
      accessibilityLabel={onChange ? undefined : t("accessibility:stars", { count: value })}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const full = value >= star;
        const half = !full && value >= star - 0.5;
        const icon = full ? "star" : half ? "star-half-o" : "star-o";
        const node = <FontAwesome name={icon} size={size} color={colors.secondary} />;
        return onChange ? (
          <Pressable
            key={star}
            onPress={() => onChange(star)}
            accessibilityRole="button"
            accessibilityLabel={t("accessibility:stars", { count: star })}
            accessibilityState={{ selected: value === star }}
            style={{ minWidth: sizes.touch, minHeight: sizes.touch, alignItems: "center", justifyContent: "center" }}
          >
            {node}
          </Pressable>
        ) : (
          <View key={star}>{node}</View>
        );
      })}
    </View>
  );
}

export function ListingImageView({
  fileName,
  style,
  fullScreen = false,
  deal = false,
}: {
  fileName?: string | null;
  style: StyleProp<ImageStyle>;
  fullScreen?: boolean;
  deal?: boolean;
}) {
  if (!fileName) {
    return (
      <View style={[style as StyleProp<ViewStyle>, { backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" }]}>
        <MaterialIcons name="image-not-supported" size={36} color={colors.secondary} />
      </View>
    );
  }
  const base = deal ? endpoints.dealImage : endpoints.listingImage;
  return <CustomImage uri={`${base}/${fileName}`} style={style} enableFullScreenView={fullScreen} />;
}
