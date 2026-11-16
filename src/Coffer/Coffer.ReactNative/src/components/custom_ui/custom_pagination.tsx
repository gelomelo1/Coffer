import { borders, colors, fonts, sizes, spacing } from "@/src/theme/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";

export interface CustomPaginationProps {
  totalItems: number;
  pageSize: number;
  currentPage?: number;
  onPageChange: (page: number) => void;
  pagesToDisplay?: number;
  containerStyle?: StyleProp<ViewStyle>;
  btnStyle?: StyleProp<ViewStyle> | ((page: number) => StyleProp<ViewStyle>);
  textStyle?: StyleProp<TextStyle> | ((page: number) => StyleProp<TextStyle>);
  activeBtnStyle?: StyleProp<ViewStyle>;
  activeTextStyle?: StyleProp<TextStyle>;
  pageChangeBtnStyle?: StyleProp<ViewStyle>;
  pageChangeTextStyle?: StyleProp<TextStyle>;
  allowOverPrev?: boolean;
  allowOverNext?: boolean;
  /** Optional status marker per page (icon + color), so state is not shown by color alone. */
  pageIcon?: (page: number) => { name: React.ComponentProps<typeof MaterialIcons>["name"]; color: string };
}

const CustomPagination: React.FC<CustomPaginationProps> = ({
  totalItems,
  pageSize,
  currentPage,
  onPageChange,
  pagesToDisplay = 3,
  containerStyle,
  btnStyle,
  textStyle,
  activeBtnStyle,
  activeTextStyle,
  pageChangeBtnStyle,
  pageChangeTextStyle,
  allowOverPrev = false,
  allowOverNext = false,
  pageIcon,
}) => {
  const { t } = useTranslation();
  const totalPages = Math.ceil(totalItems / pageSize);

  const getButtonStyle = (page: number) =>
    typeof btnStyle === "function" ? btnStyle(page) : btnStyle;

  const getTextStyle = (page: number) =>
    typeof textStyle === "function" ? textStyle(page) : textStyle;

  const getVisiblePages = (): (number | string)[] => {
    if (totalPages === 0) return [];
    const pages: (number | string)[] = [];
    const half = Math.floor(pagesToDisplay / 2);

    let start = currentPage ? Math.max(1, currentPage - half) : 1;
    let end = currentPage
      ? Math.min(totalPages, currentPage + half)
      : Math.min(totalPages, pagesToDisplay);

    if (end - start + 1 < pagesToDisplay) {
      if (start === 1) end = Math.min(totalPages, start + pagesToDisplay - 1);
      else if (end === totalPages)
        start = Math.max(1, end - pagesToDisplay + 1);
    }

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push("...");
    }

    for (let i = start; i <= end; i++) pages.push(i);

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push("...");
      pages.push(totalPages);
    }

    return pages;
  };

  const pages = getVisiblePages();

  const handlePrev = () => {
    if (!currentPage) return;
    if (currentPage > 1) onPageChange(currentPage - 1);
    else if (allowOverPrev) onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    if (!currentPage) return;
    if (currentPage < totalPages) onPageChange(currentPage + 1);
    else if (allowOverNext) onPageChange(currentPage + 1);
  };

  const prevDisabled = !currentPage || (!allowOverPrev && currentPage === 1);
  const nextDisabled = !currentPage || (!allowOverNext && currentPage === totalPages);

  const navButton = (dir: "prev" | "next", disabled: boolean, onPress: () => void) => (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={dir === "prev" ? t("common:pagination.previous") : t("common:pagination.next")}
      style={({ pressed }) => [styles.button, pageChangeBtnStyle, disabled && styles.disabledButton, pressed && styles.pressed]}
    >
      <MaterialIcons name={dir === "prev" ? "chevron-left" : "chevron-right"} size={sizes.iconMd} color={colors.text} />
    </Pressable>
  );

  return (
    <View style={[styles.container, containerStyle]}>
      {navButton("prev", prevDisabled, handlePrev)}
      {pages.map((p, index) =>
        p === "..." ? (
          <Text key={`dots-${index}`} style={[styles.ellipsis, styles.text]}>
            …
          </Text>
        ) : (
          <Pressable
            key={p}
            onPress={() => onPageChange(p as number)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={t("common:pagination.page", { page: p })}
            accessibilityState={{ selected: p === currentPage }}
            style={({ pressed }) => [styles.button, getButtonStyle(p as number), p === currentPage && styles.active, p === currentPage && activeBtnStyle, pressed && styles.pressed]}
          >
            <Text style={[styles.text, getTextStyle(p as number), p === currentPage && styles.activeText, p === currentPage && activeTextStyle]}>{p}</Text>
            {pageIcon ? <PageMarker {...pageIcon(p as number)} /> : null}
          </Pressable>
        ),
      )}
      {navButton("next", nextDisabled, handleNext)}
    </View>
  );
};

function PageMarker({ name, color }: { name: React.ComponentProps<typeof MaterialIcons>["name"]; color: string }) {
  return (
    <View style={{ position: "absolute", top: -6, right: -6, backgroundColor: color, borderWidth: 1, borderColor: colors.border }}>
      <MaterialIcons name={name} size={12} color={colors.onPrimary} />
    </View>
  );
}

export default CustomPagination;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  button: {
    minWidth: 40,
    minHeight: 40,
    paddingHorizontal: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: borders.width,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  active: { backgroundColor: colors.secondary },
  pressed: { backgroundColor: colors.surfaceAlt },
  text: { color: colors.text, fontSize: 14, fontFamily: fonts.regular },
  activeText: { fontFamily: fonts.bold },
  ellipsis: { marginHorizontal: spacing.xxs },
  disabledButton: { opacity: 0.4 },
});
