import { borders, colors, fonts, sizes, spacing } from "@/src/theme/theme";
import { EditorBridge, useBridgeState } from "@10play/tentap-editor";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

export const RICH_TOOLBAR_HEIGHT = 52;

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
type BridgeState = ReturnType<typeof useBridgeState>;

interface ToolAction {
  key: string;
  icon: IconName;
  label: string;
  active?: (s: BridgeState) => boolean;
  disabled?: (s: BridgeState) => boolean;
  run: () => void;
}

function ToolButton({ action, state }: { action: ToolAction; state: BridgeState }) {
  const active = action.active?.(state) ?? false;
  const disabled = action.disabled?.(state) ?? false;
  return (
    <Pressable
      onPress={action.run}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ selected: active, disabled }}
      style={({ pressed }) => ({
        width: sizes.touch,
        height: sizes.touch,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? colors.secondary : pressed ? colors.surfaceAlt : colors.bg,
        borderWidth: active ? borders.width : 0,
        borderColor: colors.primary,
        opacity: disabled ? 0.3 : 1,
      })}
    >
      <MaterialCommunityIcons name={action.icon} size={sizes.iconMd} color={colors.text} />
    </Pressable>
  );
}

/**
 * Coffer's formatting toolbar for the tentap editor: square 48dp buttons, gold active state, translated
 * accessibility labels, horizontal scroll on narrow phones, heading and link sub-bars.
 */
export function RichTextToolbar({ editor }: { editor: EditorBridge }) {
  const { t } = useTranslation();
  const state = useBridgeState(editor);
  const [mode, setMode] = useState<"main" | "heading" | "link">("main");
  const [link, setLink] = useState("");

  const openLinkBar = () => {
    if (Platform.OS === "android") {
      // Leaving the WebView loses the selection on Android; restore it on the next tick.
      const { from, to } = state.selection;
      setTimeout(() => editor.setSelection(from, to), 50);
    }
    setLink(state.activeLink ?? "");
    setMode("link");
  };

  const main: ToolAction[] = [
    { key: "bold", icon: "format-bold", label: t("common:richText.bold"), active: (s) => s.isBoldActive, disabled: (s) => !s.canToggleBold, run: () => editor.toggleBold() },
    { key: "italic", icon: "format-italic", label: t("common:richText.italic"), active: (s) => s.isItalicActive, disabled: (s) => !s.canToggleItalic, run: () => editor.toggleItalic() },
    { key: "underline", icon: "format-underline", label: t("common:richText.underline"), active: (s) => s.isUnderlineActive, disabled: (s) => !s.canToggleUnderline, run: () => editor.toggleUnderline() },
    { key: "strike", icon: "format-strikethrough", label: t("common:richText.strike"), active: (s) => s.isStrikeActive, disabled: (s) => !s.canToggleStrike, run: () => editor.toggleStrike() },
    { key: "heading", icon: "format-header-pound", label: t("common:richText.heading"), active: (s) => !!s.headingLevel, disabled: (s) => !s.canToggleHeading, run: () => setMode("heading") },
    { key: "link", icon: "link-variant", label: t("common:richText.link"), active: (s) => s.isLinkActive, disabled: (s) => !s.isLinkActive && !s.canSetLink, run: openLinkBar },
    { key: "bullet", icon: "format-list-bulleted", label: t("common:richText.bulletList"), active: (s) => s.isBulletListActive, disabled: (s) => !s.canToggleBulletList, run: () => editor.toggleBulletList() },
    { key: "ordered", icon: "format-list-numbered", label: t("common:richText.orderedList"), active: (s) => s.isOrderedListActive, disabled: (s) => !s.canToggleOrderedList, run: () => editor.toggleOrderedList() },
    { key: "task", icon: "format-list-checks", label: t("common:richText.taskList"), active: (s) => s.isTaskListActive, disabled: (s) => !s.canToggleTaskList, run: () => editor.toggleTaskList() },
    { key: "quote", icon: "format-quote-close", label: t("common:richText.quote"), active: (s) => s.isBlockquoteActive, disabled: (s) => !s.canToggleBlockquote, run: () => editor.toggleBlockquote() },
    { key: "code", icon: "code-tags", label: t("common:richText.code"), active: (s) => s.isCodeActive, disabled: (s) => !s.canToggleCode, run: () => editor.toggleCode() },
    {
      key: "indent",
      icon: "format-indent-increase",
      label: t("common:richText.indent"),
      disabled: (s) => !s.canSink && !s.canSinkTaskListItem,
      run: () => (state.canSink ? editor.sink() : editor.sinkTaskListItem()),
    },
    {
      key: "outdent",
      icon: "format-indent-decrease",
      label: t("common:richText.outdent"),
      disabled: (s) => !s.canLift && !s.canLiftTaskListItem,
      run: () => (state.canLift ? editor.lift() : editor.liftTaskListItem()),
    },
    { key: "undo", icon: "undo", label: t("common:richText.undo"), disabled: (s) => !s.canUndo, run: () => editor.undo() },
    { key: "redo", icon: "redo", label: t("common:richText.redo"), disabled: (s) => !s.canRedo, run: () => editor.redo() },
  ];

  const headings: ToolAction[] = [
    { key: "back", icon: "close", label: t("common:richText.closeHeadings"), run: () => setMode("main") },
    ...([1, 2, 3, 4, 5, 6] as const).map((level) => ({
      key: `h${level}`,
      icon: `format-header-${level}` as IconName,
      label: t("common:richText.headingLevel", { level }),
      active: (s: BridgeState) => s.headingLevel === level,
      run: () => editor.toggleHeading(level),
    })),
  ];

  const bar = {
    height: RICH_TOOLBAR_HEIGHT,
    backgroundColor: colors.bg,
    borderTopWidth: borders.width,
    borderTopColor: colors.border,
  } as const;

  if (mode === "link") {
    const finish = (value: string | null) => {
      editor.setLink(value && value.trim() ? value.trim() : null);
      editor.focus();
      // Android: keep the bar until the WebView has the focus back, otherwise the keyboard flickers.
      setTimeout(() => setMode("main"), Platform.OS === "android" ? 100 : 0);
    };
    return (
      <View style={[bar, { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.xs }]}>
        <MaterialCommunityIcons name="link-variant" size={sizes.iconMd} color={colors.text} />
        <TextInput
          value={link}
          onChangeText={setLink}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="done"
          onSubmitEditing={() => finish(link)}
          placeholder={t("common:richText.linkPlaceholder")}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t("common:richText.link")}
          style={{
            flex: 1,
            height: 40,
            paddingVertical: 0,
            borderWidth: borders.width,
            borderColor: colors.border,
            paddingHorizontal: spacing.xs,
            color: colors.text,
            fontFamily: fonts.regular,
            fontSize: 16,
          }}
        />
        {state.isLinkActive ? (
          <ToolButton state={state} action={{ key: "unlink", icon: "link-variant-off", label: t("common:richText.removeLink"), run: () => finish(null) }} />
        ) : null}
        <Pressable
          onPress={() => finish(link)}
          accessibilityRole="button"
          style={({ pressed }) => ({
            height: 40,
            paddingHorizontal: spacing.sm,
            justifyContent: "center",
            backgroundColor: colors.primary,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 14 }}>{t("common:actions.done")}</Text>
        </Pressable>
      </View>
    );
  }

  const actions = mode === "heading" ? headings : main;
  return (
    <View style={bar}>
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="always"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ alignItems: "center", paddingHorizontal: spacing.xxs, gap: spacing.xxs, height: RICH_TOOLBAR_HEIGHT - borders.width }}
      >
        {actions.map((a) => (
          <ToolButton key={a.key} action={a} state={state} />
        ))}
      </ScrollView>
    </View>
  );
}

export default RichTextToolbar;
