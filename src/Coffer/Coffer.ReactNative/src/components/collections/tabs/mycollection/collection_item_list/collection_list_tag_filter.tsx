import CustomIconButton from "@/src/components/custom_ui/custom_icon_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { customTheme } from "@/src/theme/theme";
import { useEffect, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Overlay } from "react-native-elements";
import { SafeAreaView } from "react-native-safe-area-context";

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

  return (
    <View style={{ width: "100%" }}>
      <TouchableOpacity onPress={() => setOpen(true)}>
        <CustomTextInput
          value={displayText}
          editable={false}
          label="Tags contains"
          placeholder="Write any tags keyword"
        />
      </TouchableOpacity>

      <Overlay
        fullScreen
        isVisible={open}
        onBackdropPress={() => setOpen(false)}
        overlayStyle={{
          backgroundColor: customTheme.colors.secondary,
          margin: 0,
          padding: 0,
        }}
      >
        <SafeAreaView>
          <View style={{ padding: 10 }}>
            <Text
              onPress={() => {
                setInternalText(displayText);
                setOpen(false);
              }}
              style={{
                color: customTheme.colors.primary,
                fontSize: 24,
                textAlign: "right",
              }}
            >
              ✕
            </Text>

            <View
              style={{
                flexDirection: "row",
                gap: 10,
                marginTop: 10,
              }}
            >
              <CustomTextInput
                ref={inputRef}
                value={internalText}
                onChangeText={handleChangeText}
                onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                onBlur={() => {
                  if (isSelectingRef.current) return;
                  formatText(internalText);
                }}
                placeholder="Write any tags keyword"
                autoFocus
                style={{ flex: 1 }}
              />

              <CustomIconButton
                iconName="check"
                iconType="entypo"
                color={customTheme.colors.primary}
                reverseColor={customTheme.colors.secondary}
                size={16}
                onPress={() => {
                  const data = internalText
                    .split("#")
                    .map((s) => s.trim())
                    .filter(Boolean);

                  setDisplayText(internalText);
                  setValue(data);
                  setOpen(false);
                }}
                style={{ marginBottom: 20 }}
              />
            </View>
          </View>

          {filteredTags.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                paddingHorizontal: 10,
              }}
            >
              {filteredTags.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  onPressIn={() => handleSelectTag(item)}
                >
                  <CustomText style={{ fontFamily: "VendSansBold" }}>
                    #{item}
                  </CustomText>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </SafeAreaView>
      </Overlay>
    </View>
  );
}

export default CollectionListTagFilter;
