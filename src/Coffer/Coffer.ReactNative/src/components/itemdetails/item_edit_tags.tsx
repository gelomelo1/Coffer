import { languageFilter } from "@/src/const/filter";
import { stringResource } from "@/src/const/resource";
import { useTagCounts, useTagSuggestions } from "@/src/hooks/tag_stats";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import ItemTag from "@/src/types/entities/item_tag";
import { completeTag, currentTagToken, parseTags } from "@/src/utils/tag_input";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Chip, ChipRow } from "../custom_ui/chip";
import CustomTextInput from "../custom_ui/custom_text_input";

interface ItemEditTagsProps {
  defaultValue: ItemTag[];
  onValueChange: (newValues: ItemTag[]) => void;
  onErrorChange: (hasError: boolean) => void;
  itemId?: string;
}

const MIN_TAG_LENGTH = 3;

/**
 * Free-text tag field ("#austria #travel"). While a tag is typed, existing tags containing it are offered with how
 * many items use them (across the whole app); every entered tag shows its own count, or "new".
 */
function ItemEditTags({ defaultValue, onValueChange, onErrorChange, itemId = "" }: ItemEditTagsProps) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setText(defaultValue.map((tag) => `#${tag.tag}`).join(" "));
  }, [defaultValue]);

  const tags = parseTags(text);
  const token = currentTagToken(text);
  const { data: suggestions = [] } = useTagSuggestions(token);
  const { data: counts = [] } = useTagCounts(tags);
  const countOf = (tag: string) => counts.find((c) => c.tag === tag)?.itemCount;
  // Offer only tags that aren't in the field yet (the one being typed counts as not entered).
  const entered = new Set(tags.filter((tag) => tag !== token));
  const offered = token ? suggestions.filter((s) => !entered.has(s.tag) && s.tag !== token) : [];

  const apply = (next: string) => {
    setText(next);
    const list = parseTags(next);
    onValueChange(
      list.map((tag) => {
        const existing = defaultValue.find((dt) => dt.tag === tag);
        return { id: existing ? existing.id : 0, itemId: existing ? existing.itemId : itemId, tag };
      }),
    );
    const invalid = list.find((tag) => languageFilter.isProfane(tag) || tag.length < MIN_TAG_LENGTH);
    if (invalid) {
      setErrorMessage(languageFilter.isProfane(invalid) ? stringResource.profaneError : stringResource.minCharacterRequiredError(MIN_TAG_LENGTH));
      onErrorChange(true);
    } else {
      setErrorMessage("");
      onErrorChange(false);
    }
  };

  const handleChangeText = (value: string) => {
    // A space closes the tag: normalize what's been typed so far into "#tag #tag ".
    apply(value.endsWith(" ") ? parseTags(value).map((tag) => `#${tag}`).join(" ") + " " : value);
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <CustomTextInput
        label={t("items:details.tags")}
        placeholder={t("collections:filter.tagsPlaceholder")}
        helperText={t("items:edit.tagsHelper")}
        autoCapitalize="none"
        autoCorrect={false}
        value={text}
        onChangeText={handleChangeText}
        onBlur={() => apply(parseTags(text).map((tag) => `#${tag}`).join(" "))}
        multiline
        errorMessage={errorMessage}
      />

      {offered.length > 0 ? (
        <View style={{ gap: spacing.xxs }}>
          <Text style={[typography.label, { color: colors.text }]}>{t("items:tags.suggestions")}</Text>
          <ChipRow>
            {offered.map((s) => (
              <Chip
                key={s.tag}
                label={t("items:tags.chip", { tag: s.tag, count: s.itemCount })}
                accessibilityLabel={t("items:tags.chipA11y", { tag: s.tag, count: s.itemCount })}
                onPress={() => apply(completeTag(text, s.tag))}
              />
            ))}
          </ChipRow>
        </View>
      ) : null}

      {tags.length > 0 ? (
        <View style={{ gap: spacing.xxs }}>
          <Text style={[typography.label, { color: colors.text }]}>{t("items:tags.usage")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {tags.map((tag) => {
              const count = countOf(tag);
              const label =
                count === undefined
                  ? `#${tag}` // i18n-ignore
                  : count === 0
                    ? t("items:tags.new", { tag })
                    : t("items:tags.chip", { tag, count });
              return (
                <View
                  key={tag}
                  accessible
                  accessibilityLabel={count ? t("items:tags.chipA11y", { tag, count }) : label}
                  style={{
                    paddingHorizontal: spacing.xs,
                    paddingVertical: 2,
                    borderWidth: borders.hairline,
                    borderColor: count === 0 ? colors.secondary : colors.borderMuted,
                    backgroundColor: count === 0 ? colors.surfaceAlt : colors.surface,
                  }}
                >
                  <Text style={[typography.caption, { color: colors.text }]}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default ItemEditTags;
