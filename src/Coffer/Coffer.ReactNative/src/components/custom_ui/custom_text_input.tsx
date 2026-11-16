import { borders, colors, fonts, sizes, spacing, typography } from "@/src/theme/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { Ref, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleProp, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from "react-native";

export interface CustomTextInputProps extends Omit<TextInputProps, "style"> {
  label?: string;
  errorMessage?: string;
  helperText?: string;
  disabled?: boolean;
  /** Value shown as information, not as an editable field. `editable={false}` renders the same way. */
  readOnly?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: "default" | "search";
  /** Search variant: shows a clear button while there is text. */
  onClear?: () => void;
  required?: boolean;
  /** Outer wrapper (margins, flex). */
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  /** The bordered field box. */
  inputContainerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
  ref?: Ref<TextInput>;
}

/**
 * Retro text field: label above, 48dp square bordered box, gold focus border, danger error state with message
 * below, distinct read-only and disabled looks, multiline growth up to a max height.
 */
function CustomTextInput({
    label,
    errorMessage,
    helperText,
    disabled = false,
    readOnly,
    leftIcon,
    rightIcon,
    variant = "default",
    onClear,
    required = false,
    style,
    containerStyle,
    inputContainerStyle,
    inputStyle,
    labelStyle,
    editable,
    multiline = false,
    onFocus,
    onBlur,
    placeholderTextColor,
    keyboardType = "default",
    ref,
    ...rest
}: CustomTextInputProps) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const isReadOnly = readOnly ?? editable === false;
  const canEdit = !disabled && !isReadOnly;
  const hasError = !!errorMessage;
  const isSearch = variant === "search";
  const showClear = isSearch && canEdit && !!onClear && !!rest.value;

  const borderColor = hasError ? colors.danger : focused ? colors.secondary : colors.border;
  const borderWidth = isReadOnly ? 0 : focused || hasError ? borders.focus : borders.width;
  // Keep the text in place when the border thickens (no layout jump on focus).
  const padH = spacing.sm + (borders.focus - borderWidth);

  return (
    <View style={[{ width: "100%", gap: spacing.xxs, opacity: disabled ? 0.5 : 1 }, style, containerStyle]}>
      {label ? (
        <Text style={[typography.label, { color: colors.text }, labelStyle]}>
          {label}
          {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
      ) : null}

      <View
        style={[
          {
            flexDirection: "row",
            alignItems: multiline ? "flex-start" : "center",
            gap: spacing.xs,
            minHeight: multiline ? 96 : sizes.control,
            paddingHorizontal: padH,
            paddingVertical: multiline ? spacing.xs + (borders.focus - borderWidth) : 0,
            borderWidth,
            borderColor,
            borderRadius: 0,
            backgroundColor: isReadOnly ? colors.surfaceAlt : colors.surface,
          },
          inputContainerStyle,
        ]}
      >
        {isSearch && !leftIcon ? <MaterialIcons name="search" size={sizes.iconMd} color={colors.text} /> : leftIcon}
        <TextInput
          ref={ref}
          {...rest}
          editable={canEdit}
          multiline={multiline}
          keyboardType={keyboardType}
          returnKeyType={rest.returnKeyType ?? (isSearch ? "search" : undefined)}
          placeholderTextColor={placeholderTextColor ?? colors.textMuted}
          selectionColor={colors.secondary}
          cursorColor={colors.primary}
          accessibilityLabel={rest.accessibilityLabel ?? label ?? rest.placeholder}
          accessibilityState={{ disabled: !canEdit }}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            {
              flex: 1,
              color: colors.text,
              fontFamily: fonts.regular,
              fontSize: 16,
              lineHeight: multiline ? 22 : undefined,
              paddingVertical: multiline ? 0 : spacing.xs,
              minHeight: multiline ? 80 : sizes.control - 2 * borders.focus,
              maxHeight: multiline ? 200 : undefined,
              textAlignVertical: multiline ? "top" : "center",
            },
            inputStyle,
          ]}
        />
        {showClear ? (
          <Pressable
            onPress={onClear}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("accessibility:clearText")}
          >
            <MaterialIcons name="close" size={sizes.iconMd} color={colors.text} />
          </Pressable>
        ) : null}
        {rightIcon}
      </View>

      {hasError ? (
        <Text accessibilityLiveRegion="polite" style={[typography.meta, { color: colors.danger }]}>
          {errorMessage}
        </Text>
      ) : helperText ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>{helperText}</Text>
      ) : null}
    </View>
  );
}

export default CustomTextInput;
