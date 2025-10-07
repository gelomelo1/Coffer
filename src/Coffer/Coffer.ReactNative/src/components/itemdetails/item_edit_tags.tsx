import ItemTag from "@/src/types/entities/item_tag";
import { useEffect, useState } from "react";
import CustomTextInput from "../custom_ui/custom_text_input";

interface ItemEditTagsProps {
  defaultValue: ItemTag[];
  onValueChange: (newValues: ItemTag[]) => void;
  itemId?: string;
}

function ItemEditTags({
  defaultValue,
  onValueChange,
  itemId = "",
}: ItemEditTagsProps) {
  const [internalText, setInternalText] = useState("");

  // Update internal text when defaultValue changes
  useEffect(() => {
    const text = defaultValue.map((tag) => `#${tag.tag}`).join(" ");
    setInternalText(text);
  }, [defaultValue]);

  // Format text into hashtags for display (keeps cursor stable)
  const formatText = (text: string) => {
    const tags = text
      .split(" ")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter((t) => t.length > 0);

    const formattedText = tags.map((t) => `#${t}`).join(" ");
    setInternalText(formattedText);

    const tagObjects: ItemTag[] = tags.map((t) => {
      const existing = defaultValue.find((dt) => dt.tag === t);
      return {
        id: existing ? existing.id : 0,
        itemId: existing ? existing.itemId : itemId,
        tag: t,
      };
    });

    onValueChange(tagObjects);
  };

  const handleChangeText = (text: string) => {
    setInternalText(text);

    // Split by space and remove empty strings for onValueChange
    const tags = text
      .split(" ")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter((t) => t.length > 0);

    const tagObjects: ItemTag[] = tags.map((t) => {
      const existing = defaultValue.find((dt) => dt.tag === t);
      return {
        id: existing ? existing.id : 0,
        itemId: existing ? existing.itemId : itemId,
        tag: t,
      };
    });

    onValueChange(tagObjects);

    // Only format hashtags if the last character is space
    // But do not remove the trailing space from internalText
    if (text.endsWith(" ")) {
      const formatted = tags.map((t) => `#${t}`).join(" ") + " ";
      setInternalText(formatted);
    }
  };

  return (
    <CustomTextInput
      label="Tags"
      value={internalText}
      onChangeText={handleChangeText}
      onBlur={() => formatText(internalText)} // format completely on blur
      style={{ height: 100 }}
      inputContainerStyle={{ height: 100 }}
      multiline
    />
  );
}

export default ItemEditTags;
