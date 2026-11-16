import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import { NavigationParams } from "@/src/types/helpers/navigation";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { goBack } from "expo-router/build/global-state/routing";
import React from "react";
import { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type HeaderVariant = "bar" | "plain";

interface AppHeaderProps {
  title: string;
  subtitle?: string | null;
  /** Element shown before the subtitle (e.g. collection type badge). */
  subtitleLeading?: React.ReactNode;
  variant?: HeaderVariant;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
}

/** Resolves header texts from route params: translated keys for app text, literals for user content. */
export function headerTexts(params: NavigationParams | undefined, t: TFunction) {
  return {
    title: params?.titleKey ? t(params.titleKey) : params?.title,
    screenTitle: params?.screenTitleKey ? t(params.screenTitleKey) : params?.screenTitle,
  };
}

/**
 * The app's single header. "bar" = gold bar for pushed screens (back button on the left), "plain" = cream bar for
 * top-level tabs. Title wraps to 2 lines rather than being cut; a 2px navy rule separates it from content.
 */
export function AppHeader({ title, subtitle, subtitleLeading, variant = "bar", showBack = true, onBack, right }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top,
        paddingLeft: Math.max(insets.left, showBack ? spacing.xxs : spacing.md),
        paddingRight: Math.max(insets.right, spacing.xxs),
        backgroundColor: variant === "bar" ? colors.secondary : colors.bg,
        borderBottomWidth: borders.width,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.xxs }}>
        {showBack ? <HeaderBackButton onPress={onBack} /> : null}
        <View style={{ flex: 1, paddingVertical: spacing.xs, gap: 2 }}>
          <Text accessibilityRole="header" numberOfLines={2} style={[typography.title, { color: colors.text }]}>
            {title}
          </Text>
          {subtitle ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
              {subtitleLeading}
              <Text numberOfLines={1} style={[typography.meta, { color: colors.text, flexShrink: 1 }]}>
                {subtitle}
              </Text>
            </View>
          ) : null}
        </View>
        {right ? <View style={{ flexDirection: "row", alignItems: "center" }}>{right}</View> : null}
      </View>
    </View>
  );
}

export function HeaderBackButton({ onPress }: { onPress?: () => void }) {
  const { t } = useTranslation();
  return (
    <HeaderIconButton icon="arrow-back" label={t("accessibility:back")} onPress={onPress ?? goBack} />
  );
}

export function HeaderIconButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: sizes.touch,
        height: sizes.touch,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? colors.borderMuted : "transparent",
      })}
    >
      <MaterialIcons name={icon} size={28} color={colors.text} />
    </Pressable>
  );
}
