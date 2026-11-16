import { pressableShadowStyle } from "@/src/theme/pressable";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import CustomHTMLView from "./custom_html_view";
import CustomRichTextEditor from "./custom_rich_text_editor";
import SheetModal from "./sheet_modal";

/** True when the HTML has no visible text (e.g. "<p></p>"). */
export function isRichTextEmpty(html?: string | null) {
  return !html || html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length === 0;
}

interface RichTextEditorSheetProps {
  visible: boolean;
  title: string;
  initialContent: string;
  placeholder?: string;
  onChangeValue: (html: string) => void;
  /** Close without applying (back button / ✕). */
  onClose: () => void;
  /** Header action; defaults to onClose (live-editing fields). */
  onDone?: () => void;
  doneLabel?: string;
}

/** Full-screen editing sheet: the editor fills the body, toolbar rides on the keyboard, "Done" in the header. */
export function RichTextEditorSheet({ visible, title, initialContent, placeholder, onChangeValue, onClose, onDone, doneLabel }: RichTextEditorSheetProps) {
  const { t } = useTranslation();
  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title={title}
      bodyStyle={{ paddingTop: spacing.md }}
      headerRight={
        <Pressable
          onPress={onDone ?? onClose}
          accessibilityRole="button"
          style={({ pressed }) => [
            { minHeight: 40, paddingHorizontal: spacing.sm, justifyContent: "center", backgroundColor: colors.primary, borderWidth: borders.width, borderColor: colors.primary },
            pressableShadowStyle(pressed),
          ]}
        >
          <Text style={[typography.label, { color: colors.onPrimary }]}>{doneLabel ?? t("common:actions.done")}</Text>
        </Pressable>
      }
    >
      {visible ? <CustomRichTextEditor initialContent={initialContent} placeholder={placeholder} onChangeValue={onChangeValue} margin={spacing.md} autofocus /> : null}
    </SheetModal>
  );
}

interface RichTextFieldProps {
  label: string;
  value: string;
  onChangeValue: (html: string) => void;
  placeholder?: string;
  helperText?: string;
}

/** Form field for rich text: rendered preview in a bordered box; tap to edit in RichTextEditorSheet. */
export function RichTextField({ label, value, onChangeValue, placeholder, helperText }: RichTextFieldProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const empty = isRichTextEmpty(value);

  return (
    <View style={{ gap: spacing.xxs }}>
      <Text style={[typography.label, { color: colors.text }]}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t("common:richText.tapToEdit")}
        style={({ pressed }) => ({
          minHeight: 96,
          borderWidth: borders.width,
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
          paddingVertical: spacing.sm,
        })}
      >
        {empty ? (
          <Text style={[typography.body, { color: colors.textMuted, paddingHorizontal: spacing.sm }]} numberOfLines={4}>
            {placeholder ?? t("common:richText.placeholder")}
          </Text>
        ) : (
          <View pointerEvents="none">
            <CustomHTMLView content={value} maxLines={6} />
          </View>
        )}
        <Text style={[typography.label, { color: colors.text, textDecorationLine: "underline", paddingHorizontal: spacing.sm, marginTop: spacing.xs }]}>
          {t("common:actions.edit")}
        </Text>
      </Pressable>
      {helperText ? <Text style={[typography.caption, { color: colors.textMuted }]}>{helperText}</Text> : null}
      <RichTextEditorSheet
        visible={open}
        title={label}
        initialContent={value}
        placeholder={placeholder}
        onChangeValue={onChangeValue}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

export default RichTextField;
