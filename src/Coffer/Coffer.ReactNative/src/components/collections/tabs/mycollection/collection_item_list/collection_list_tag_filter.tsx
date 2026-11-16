import CustomButton from "@/src/components/custom_ui/custom_button";
import { SelectLabel, selectFieldStyle, selectTextStyle } from "@/src/components/custom_ui/select_shared";
import SheetModal from "@/src/components/custom_ui/sheet_modal";
import { pressableShadowStyle } from "@/src/theme/pressable";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useTranslation } from "react-i18next";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

interface CollectionListTagFilterProps {
  defaultValue: string;
  setValue: (value: string[]) => void;
  items: string[];
}

function CollectionListTagFilter({
  defaultValue,
  setValue,
  items,
}: CollectionListTagFilterProps) {
  const { t } = useTranslation();
  const [internalText, setInternalText] = useState("");
  const [displayText, setDisplayText] = useState("");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [open, setOpen] = useState(false);

  const inputRef = useRef<any>(null);
  const isSelectingRef = useRef(false);

  useEffect(() => {
    setInternalText(defaultValue);
    setDisplayText(defaultValue);
  }, [defaultValue]);

  const formatText = (text: string) => {
    const tags = text
      .split(" ")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean);

    const formatted = tags.map((t) => `#${t}`).join(" ");

    if (formatted !== text) {
      setInternalText(formatted);
    }
  };

  const handleChangeText = (text: string) => {
    setInternalText(text);
  };

  const getCurrentWord = (text: string, cursor: number) => {
    let start = cursor;
    let end = cursor;

    while (start > 0 && text[start - 1] !== " ") start--;
    while (end < text.length && text[end] !== " ") end++;

    return text.slice(start, end).replace(/^#/, "");
  };

  const currentWord = getCurrentWord(internalText, selection.start);

  const filteredTags =
    currentWord.length === 0
      ? []
      : items.filter((item) =>
          item.toLowerCase().includes(currentWord.toLowerCase()),
        );

  const handleSelectTag = (tag: string) => {
    isSelectingRef.current = true;

    const cursor = selection.start;
    const text = internalText;

    let start = cursor;
    let end = cursor;

    while (start > 0 && text[start - 1] !== " ") start--;
    while (end < text.length && text[end] !== " ") end++;

    const before = text.slice(0, start);
    const after = text.slice(end);

    const newText = `${before}#${tag} ${after.trimStart()}`;

    setInternalText(newText);

    const newCursor = (before + `#${tag} `).length;

    setTimeout(() => {
      setSelection({ start: newCursor, end: newCursor });
      inputRef.current?.focus();
      isSelectingRef.current = false;
    }, 0);
  };

  const close = () => {
    setInternalText(displayText);
    setOpen(false);
  };

  const apply = () => {
    const data = internalText
      .split("#")
      .map((s) => s.trim())
      .filter(Boolean);
    setDisplayText(internalText);
    setValue(data);
    setOpen(false);
  };

  return (
    <View style={{ width: "100%" }}>
      <SelectLabel label={t("collections:filter.tags")} />
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("collections:filter.tags")}
        accessibilityValue={{ text: displayText }}
        style={({ pressed }) => [selectFieldStyle, { flexDirection: "row", alignItems: "center", gap: spacing.xs }, pressed && { backgroundColor: colors.surfaceAlt }]}
      >
        <Text style={[selectTextStyle, { flex: 1 }, !displayText && { color: colors.textMuted }]} numberOfLines={2}>
          {displayText || t("collections:filter.tagsPlaceholder")}
        </Text>
        <MaterialIcons name="edit" size={20} color={colors.text} />
      </Pressable>

      <SheetModal
        visible={open}
        onClose={close}
        title={t("collections:filter.tags")}
        footer={<CustomButton title={t("common:actions.apply")} onPress={apply} />}
      >
        <View style={{ padding: spacing.md, gap: spacing.md }}>
          <CustomTextInput
            ref={inputRef}
            value={internalText}
            onChangeText={handleChangeText}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            onBlur={() => {
              if (isSelectingRef.current) return;
              formatText(internalText);
            }}
            placeholder={t("collections:filter.tagsPlaceholder")}
            helperText={t("collections:filter.tagsHelper")}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          {filteredTags.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
              {filteredTags.map((item, i) => (
                <Pressable
                  key={i}
                  // onPressIn: pick the tag before the input's blur reformats the text
                  onPressIn={() => handleSelectTag(item)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    { minHeight: 40, justifyContent: "center", paddingHorizontal: spacing.sm, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.bg },
                    pressableShadowStyle(pressed),
                  ]}
                >
                  <Text style={[typography.label, { color: colors.text }]}>#{item}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </SheetModal>
    </View>
  );
}

export default CollectionListTagFilter;
