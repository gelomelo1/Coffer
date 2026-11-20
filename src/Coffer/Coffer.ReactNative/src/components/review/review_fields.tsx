import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import Attribute from "@/src/types/entities/attribute";
import ItemTag from "@/src/types/entities/item_tag";
import { getDefaultAttributeValue } from "@/src/utils/data_access_utils";
import { orderFields } from "@/src/utils/required_fields";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import CustomTextInput from "../custom_ui/custom_text_input";
import ItemEditDynamicFields from "../itemdetails/item_edit_dynamic_fields";
import ItemEditTags from "../itemdetails/item_edit_tags";

export interface ReviewDraft {
  values: Record<number, string | number | boolean>;
  tags: ItemTag[];
  privateNote: string;
  description: string;
}

interface ReviewFieldsProps {
  attributes: Attribute[];
  draft: ReviewDraft;
  onDraft: (update: (prev: ReviewDraft) => ReviewDraft) => void;
  quantity: number;
  onQuantity: (q: number) => void;
  /** Only the quantity is needed when adding to an existing item. */
  quantityOnly: boolean;
  onErrorChange: (fieldKey: string, hasError: boolean) => void;
  /** Where each field sits in the scroll view, so "Still needed: Brand" can jump to it. */
  onFieldLayout: (attributeId: number, y: number) => void;
}

/** Required fields first (primary on top) and the quantity; everything optional folded away until wanted. */
function ReviewFields({ attributes, draft, onDraft, quantity, onQuantity, quantityOnly, onErrorChange, onFieldLayout }: ReviewFieldsProps) {
  const { t } = useTranslation();
  const [optionalOpen, setOptionalOpen] = useState(false);
  const { required, optional } = orderFields(attributes);

  const field = (attribute: Attribute) => (
    <View key={attribute.id} onLayout={(e) => onFieldLayout(attribute.id, e.nativeEvent.layout.y)}>
      <ItemEditDynamicFields
        attribute={attribute}
        defaultValue={draft.values[attribute.id] ?? (getDefaultAttributeValue(attribute) as string | number | boolean)}
        onValueChange={(value) => onDraft((prev) => ({ ...prev, values: { ...prev.values, [attribute.id]: value } }))}
        onErrorChange={(hasError) => onErrorChange(String(attribute.id), hasError)}
      />
    </View>
  );

  const stepper = (
    <View style={{ gap: spacing.xs }}>
      <Text style={[typography.label, { color: colors.text }]}>{t("items:review.quantity")} *</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        {[
          { icon: "remove" as const, label: t("items:review.less"), next: quantity - 1, disabled: quantity <= 1 },
          { icon: "add" as const, label: t("items:review.more"), next: quantity + 1, disabled: false },
        ].map((b, i) => (
          <View key={b.icon} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            {i === 1 ? (
              <Text style={[typography.title, { color: colors.text, minWidth: 40, textAlign: "center" }]} accessibilityLiveRegion="polite">
                {quantity}
              </Text>
            ) : null}
            <Pressable
              onPress={() => onQuantity(b.next)}
              disabled={b.disabled}
              accessibilityRole="button"
              accessibilityLabel={b.label}
              accessibilityState={{ disabled: b.disabled }}
              style={{ width: 48, height: 48, borderWidth: borders.width, borderColor: colors.border, alignItems: "center", justifyContent: "center", opacity: b.disabled ? 0.4 : 1, backgroundColor: colors.surface }}
            >
              <MaterialIcons name={b.icon} size={sizes.iconMd} color={colors.text} />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );

  if (quantityOnly) return stepper;

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={[typography.label, { color: colors.textMuted }]}>{t("items:review.required")}</Text>
      {required.map(field)}
      {stepper}

      <Pressable
        onPress={() => setOptionalOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: optionalOpen }}
        style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.xs, borderTopWidth: borders.hairline, borderTopColor: colors.borderMuted, paddingTop: spacing.sm }}
      >
        <MaterialIcons name={optionalOpen ? "expand-less" : "expand-more"} size={sizes.iconMd} color={colors.text} />
        <View style={{ flex: 1 }}>
          <Text style={[typography.label, { color: colors.text }]}>{t("items:review.optional")}</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
            {[...optional.map((a) => a.name), t("items:review.tags"), t("items:details.privateNote"), t("items:details.description")].join(" · ") /* i18n-ignore */}
          </Text>
        </View>
      </Pressable>

      {optionalOpen ? (
        <View style={{ gap: spacing.md }}>
          {optional.map(field)}
          <ItemEditTags
            defaultValue={draft.tags}
            onValueChange={(tags) => onDraft((prev) => ({ ...prev, tags }))}
            onErrorChange={(hasError) => onErrorChange("tags", hasError)}
          />
          <CustomTextInput
            label={t("items:details.privateNote")}
            helperText={t("items:details.privateNoteHelp")}
            defaultValue={draft.privateNote}
            onChangeText={(privateNote) => onDraft((prev) => ({ ...prev, privateNote }))}
            multiline
          />
          <CustomTextInput
            label={t("items:details.description")}
            helperText={t("items:details.descriptionHelp")}
            defaultValue={draft.description}
            onChangeText={(description) => onDraft((prev) => ({ ...prev, description }))}
            multiline
          />
        </View>
      ) : null}
    </View>
  );
}

export default ReviewFields;
