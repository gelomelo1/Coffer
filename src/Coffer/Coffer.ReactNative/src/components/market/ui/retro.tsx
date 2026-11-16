import CustomImage from "@/src/components/custom_ui/custom_image";
import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { MARKET_WARNING_TEXT, MARKET_WARNING_TITLE } from "@/src/const/market";
import { customTheme } from "@/src/theme/theme";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useState } from "react";
import { ImageStyle, StyleProp, TextStyle, TouchableOpacity, View, ViewStyle } from "react-native";

const c = customTheme.colors;

/** Square, 2px bordered card with the app's hard drop shadow. */
export function SectionCard({
  title,
  right,
  children,
  style,
  accent,
}: {
  title?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: string;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: c.background,
          borderWidth: 2,
          borderColor: accent ?? c.primary,
          boxShadow: `3px 3px ${accent ?? c.primary}`,
          padding: 10,
          marginBottom: 12,
          gap: 6,
        },
        style,
      ]}
    >
      {title ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <CustomText style={{ fontFamily: "VendSansBold", fontSize: 16, flexShrink: 1 }}>{title}</CustomText>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Toggle chip used for filters and option pickers. */
export function Chip({
  label,
  selected = false,
  onPress,
  disabled = false,
  icon,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderWidth: 2,
          borderColor: c.primary,
          backgroundColor: selected ? c.secondary : c.background,
          boxShadow: selected ? "none" : `2px 2px ${c.primary}`,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {icon}
      <CustomText style={{ fontSize: 14, fontFamily: selected ? "VendSansBold" : "VendSansRegular" }}>{label}</CustomText>
    </TouchableOpacity>
  );
}

export function ChipRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: "row", flexWrap: "wrap", gap: 8 }, style]}>{children}</View>;
}

export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <CustomText style={[{ fontFamily: "VendSansBold", fontSize: 15, marginTop: 6 }, style]}>{children}</CustomText>;
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <CustomText style={{ color: "red", fontSize: 13 }}>{children}</CustomText>;
}

/** Small colored tag ("SELL", "SOLD", …). */
export function Tag({ label, color = c.primary, textColor = c.background }: { label: string; color?: string; textColor?: string }) {
  return (
    <View style={{ backgroundColor: color, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start" }}>
      <CustomText style={{ color: textColor, fontSize: 12, fontFamily: "VendSansBold" }}>{label.toUpperCase()}</CustomText>
    </View>
  );
}

/** Payment/shipping risk warning required on the feed, listings and before deals. */
export function WarningBanner({ collapsible = false }: { collapsible?: boolean }) {
  const [open, setOpen] = useState(!collapsible);
  return (
    <TouchableOpacity
      activeOpacity={collapsible ? 0.7 : 1}
      onPress={() => collapsible && setOpen(!open)}
      style={{
        borderWidth: 2,
        borderColor: c.primary,
        borderLeftWidth: 8,
        borderLeftColor: "red",
        backgroundColor: c.background,
        padding: 8,
        marginBottom: 10,
        gap: 4,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <MaterialIcons name="warning" size={18} color="red" />
        <CustomText style={{ fontFamily: "VendSansBold", flex: 1 }}>{MARKET_WARNING_TITLE}</CustomText>
        {collapsible ? <MaterialIcons name={open ? "expand-less" : "expand-more"} size={20} color={c.primary} /> : null}
      </View>
      {open ? <CustomText style={{ fontSize: 14 }}>{MARKET_WARNING_TEXT}</CustomText> : null}
    </TouchableOpacity>
  );
}

/** 1–5 stars; interactive when onChange is given. */
export function StarRating({
  value,
  onChange,
  size = 18,
}: {
  value: number;
  onChange?: (stars: number) => void;
  size?: number;
}) {
  return (
    <View style={{ flexDirection: "row", gap: onChange ? 8 : 2 }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const full = value >= star;
        const half = !full && value >= star - 0.5;
        const icon = full ? "star" : half ? "star-half-o" : "star-o";
        const node = <FontAwesome name={icon} size={size} color={c.secondary} />;
        return onChange ? (
          <TouchableOpacity key={star} onPress={() => onChange(star)} accessibilityLabel={`${star} stars`} hitSlop={6}>
            {node}
          </TouchableOpacity>
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
      <View
        style={[
          style as StyleProp<ViewStyle>,
          { backgroundColor: c.primary, justifyContent: "center", alignItems: "center" },
        ]}
      >
        <MaterialIcons name="search" size={36} color={c.secondary} />
      </View>
    );
  }
  const base = deal ? endpoints.dealImage : endpoints.listingImage;
  return <CustomImage uri={`${base}/${fileName}`} style={style} enableFullScreenView={fullScreen} />;
}

export function EmptyState({ icon, title, text }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; title: string; text?: string }) {
  return (
    <View style={{ alignItems: "center", padding: 30, gap: 8 }}>
      <MaterialIcons name={icon} size={48} color={c.secondary} />
      <CustomText style={{ fontFamily: "VendSansBold", fontSize: 18, textAlign: "center" }}>{title}</CustomText>
      {text ? <CustomText style={{ textAlign: "center", fontSize: 14 }}>{text}</CustomText> : null}
    </View>
  );
}
