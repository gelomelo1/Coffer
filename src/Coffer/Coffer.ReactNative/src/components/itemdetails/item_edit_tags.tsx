import { languageFilter } from "@/src/const/filter";
import { stringResource } from "@/src/const/resource";
import ItemTag from "@/src/types/entities/item_tag";
import { useEffect, useState } from "react";
import CustomTextInput from "../custom_ui/custom_text_input";

interface ItemEditTagsProps {
  defaultValue: ItemTag[];
  onValueChange: (newValues: ItemTag[]) => void;
  onErrorChange: (hasError: boolean) => void;
  itemId?: string;
}

function ItemEditTags({
  defaultValue,
  onValueChange,
  onErrorChange,
  itemId = "",
}: ItemEditTagsProps) {
  const [internalText, setInternalText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const text = defaultValue.map((tag) => `#${tag.tag}`).join(" ");
    setInternalText(text);
  }, [defaultValue]);

  const formatText = (text: string) => {
    const tags = text
      .split(" ")
      .map((t) => t.trim().replace(/^#/, "").toLowerCase())
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

    const invalidTag = tagObjects.find(
      (tag) => languageFilter.isProfane(tag.tag) || tag.tag.length < 3,
    );

    if (invalidTag) {
      if (languageFilter.isProfane(invalidTag.tag)) {
        setErrorMessage(stringResource.profaneError);
      } else {
        setErrorMessage(stringResource.minCharacterRequiredError(3));
      }
      onErrorChange(true);
    } else {
      setErrorMessage("");
      onErrorChange(false);
    }

    onValueChange(tagObjects);
  };

  const handleChangeText = (text: string) => {
    setInternalText(text);

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

    if (text.endsWith(" ")) {
      const formatted = tags.map((t) => `#${t}`).join(" ") + " ";
      setInternalText(formatted);
    }

    const invalidTag = tagObjects.find(
      (tag) => languageFilter.isProfane(tag.tag) || tag.tag.length < 3,
    );

    if (invalidTag) {
      if (languageFilter.isProfane(invalidTag.tag)) {
        setErrorMessage(stringResource.profaneError);
      } else {
        setErrorMessage(stringResource.minCharacterRequiredError(3));
      }
      onErrorChange(true);
    } else {
      setErrorMessage("");
      onErrorChange(false);
    }
  };

  return (
    <CustomTextInput
      label="Tags"
      value={internalText}
      onChangeText={handleChangeText}
      onBlur={() => formatText(internalText)}
      multiline
      errorMessage={errorMessage}
    />
  );
}

export default ItemEditTags;
