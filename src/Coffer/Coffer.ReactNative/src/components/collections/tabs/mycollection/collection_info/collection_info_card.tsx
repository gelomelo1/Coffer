import { SectionHeader } from "@/src/components/custom_ui/card";
import { ShareLinkButton } from "@/src/components/custom_ui/share_link_button";
import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomHTMLView from "@/src/components/custom_ui/custom_html_view";
import CustomImage from "@/src/components/custom_ui/custom_image";
import { isRichTextEmpty } from "@/src/components/custom_ui/rich_text_field";
import { endpoints } from "@/src/const/endpoints";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import CollectionDeleteForm from "./collection_delete_form";
import CollectionInfoEditForm from "./collection_info_edit_form";

/** Header of the user's own collection: cover, name, stats, edit / delete, description. */
function CollectionInfoCard() {
  const { t, i18n } = useTranslation();
  const { collection, collectionType } = useCollectionStore();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  if (!collection) return null;

  return (
    <>
      <View style={{ marginHorizontal: spacing.md, marginTop: spacing.md, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: "row", gap: spacing.md, padding: spacing.md, flexWrap: "wrap" }}>
          <View
            style={{
              width: 112,
              height: 112,
              borderWidth: borders.width,
              borderColor: colors.border,
              backgroundColor: collectionType?.color ?? colors.surfaceAlt,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {collection.image ? (
              <CustomImage
                uri={`${endpoints.collectionsCoverImage}/${collection.image}`}
                style={{ width: "100%", height: "100%", resizeMode: "cover" }}
                enableFullScreenView
              />
            ) : (
              <MaterialIcons name="image-not-supported" size={32} color={colors.text} accessibilityLabel={t("collections:edit.noCoverImage")} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 140, gap: spacing.xxs }}>
            <Text accessibilityRole="header" style={[typography.headline, { color: colors.text }]} numberOfLines={3}>
              {collection.name}
            </Text>
            <Text style={[typography.meta, { color: colors.textMuted }]}>
              {t("collections:info.created", { date: new Date(collection.createdAt).toLocaleDateString(i18n.language) })}
            </Text>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>{t("collections:info.followers", { count: collection.follows.length })}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, paddingTop: 0 }}>
          <CustomButton
            title={t("common:actions.edit")}
            variant="outline"
            size="sm"
            icon={<MaterialIcons name="edit" size={18} color={colors.text} />}
            onPress={() => setIsEditOpen(true)}
            containerStyle={{ flex: 1 }}
          />
          <CustomButton
            title={t("common:actions.delete")}
            variant="danger"
            size="sm"
            icon={<MaterialIcons name="delete-outline" size={18} color={colors.onPrimary} />}
            onPress={() => setIsDeleteOpen(true)}
            containerStyle={{ flex: 1 }}
          />
          <ShareLinkButton kind="collection" id={collection.id} />
        </View>
      </View>
      <View style={{ marginHorizontal: spacing.md }}>
        <SectionHeader title={t("collections:edit.description")} />
        {!isRichTextEmpty(collection.description) ? (
          <View style={{ marginHorizontal: -spacing.sm }}>
            <CustomHTMLView content={collection.description!} foldable />
          </View>
        ) : (
          <Text style={[typography.meta, { color: colors.textMuted }]}>{t("collections:info.noDescription")}</Text>
        )}
      </View>
      <CollectionDeleteForm isDeleteCollectionConfirmVisible={{ value: isDeleteOpen, set: setIsDeleteOpen }} />
      <CollectionInfoEditForm isCollectionInfoEditOverlayOpen={{ value: isEditOpen, set: setIsEditOpen }} />
    </>
  );
}

export default CollectionInfoCard;
