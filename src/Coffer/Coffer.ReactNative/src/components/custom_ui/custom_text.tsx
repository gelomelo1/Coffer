import { colors, fonts, typography, TypographyVariant } from "@/src/theme/theme";
import { formatNumberShort } from "@/src/utils/data_access_utils";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TextProps, TextStyle, View } from "react-native";

export interface CustomTextProps extends TextProps {
  variant?: TypographyVariant;
  muted?: boolean;
  foldable?: boolean;
  maxLines?: number;
  concatNumber?: boolean;
}

/**
 * Applies the variant's type style. When the caller overrides fontSize without a lineHeight, the variant's
 * lineHeight is dropped so larger text never gets clipped.
 */
function resolveStyle(variant: TypographyVariant, muted: boolean, style: TextProps["style"]) {
  const override = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const base: TextStyle = { ...typography[variant], color: muted ? colors.textMuted : colors.text };
  if (override.fontSize != null && override.lineHeight == null) delete base.lineHeight;
  return [base, style];
}

const CustomText: React.FC<CustomTextProps> = ({
  style,
  children,
  variant = "body",
  muted = false,
  foldable = false,
  maxLines = 3,
  concatNumber = false,
  ...props
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textStyle = resolveStyle(variant, muted, style);

  let displayValue = children;
  if (concatNumber && !isNaN(Number(children))) {
    displayValue = formatNumberShort(Number(children));
  }

  if (!foldable) {
    return (
      <Text style={textStyle} {...props}>
        {displayValue}
      </Text>
    );
  }

  return (
    <View>
      {/* Offscreen copy, measured to know whether the text overflows maxLines */}
      <Text
        style={[textStyle, styles.offscreenText]}
        onTextLayout={(e) => {
          if (e.nativeEvent.lines.length > maxLines && !isOverflowing) setIsOverflowing(true);
        }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {children}
      </Text>

      <Text style={textStyle} numberOfLines={!isOpen ? maxLines : undefined} ellipsizeMode="tail" {...props}>
        {children}
      </Text>

      {!isOpen && isOverflowing && (
        <Text
          style={[textStyle, { fontFamily: fonts.bold, marginTop: 4 }]}
          onPress={() => setIsOpen(true)}
          accessibilityRole="button"
          suppressHighlighting
        >
          {t("common:actions.readMore")}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  offscreenText: {
    position: "absolute",
    opacity: 0,
    left: 0,
    top: 0,
    width: "100%",
  },
});

export default CustomText;
