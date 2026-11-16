import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { colors, spacing, typography } from "@/src/theme/theme";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text } from "react-native";

/** Reusable "write a text and confirm" overlay: reply, report, dispute, cancel reason. */
function TextPromptOverlay({
  isVisible,
  onClose,
  title,
  explanation,
  label,
  placeholder,
  submitLabel,
  minLength = 0,
  maxLength,
  loading = false,
  submitDisabled = false,
  onSubmit,
  children,
}: {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  explanation?: string;
  /** Visible field label (falls back to the placeholder for screen readers). */
  label?: string;
  placeholder?: string;
  submitLabel: string;
  minLength?: number;
  maxLength: number;
  loading?: boolean;
  /** Extra condition that keeps the submit button disabled (e.g. a required choice). */
  submitDisabled?: boolean;
  onSubmit: (text: string) => void;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  useEffect(() => {
    if (!isVisible) setText("");
  }, [isVisible]);

  const length = text.trim().length;
  const tooShort = length < minLength;

  return (
    <CustomOverlay
      isVisible={isVisible}
      onClose={onClose}
      overlayTitle={title}
      footerContent={
        <CustomButton
          title={submitLabel}
          disabled={tooShort || length > maxLength || loading || submitDisabled}
          loading={loading}
          onPress={() => onSubmit(text.trim())}
        />
      }
    >
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
        {explanation ? <Text style={[typography.body, { color: colors.text }]}>{explanation}</Text> : null}
        {children}
        <CustomTextInput
          label={label}
          placeholder={placeholder}
          accessibilityLabel={label ?? placeholder}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={maxLength}
          containerStyle={{ maxHeight: 240 }}
        />
        <Text style={[typography.caption, { color: tooShort && length > 0 ? colors.danger : colors.textMuted }]}>
          {minLength > 1
            ? t("market:prompt.countWithMin", { length, min: minLength, max: maxLength })
            : t("market:prompt.count", { length, max: maxLength })}
        </Text>
      </ScrollView>
    </CustomOverlay>
  );
}

export default TextPromptOverlay;
