import CommentSection from "@/src/components/comments/comment_section";
import CustomButton from "@/src/components/custom_ui/custom_button";
import ItemDeleteForm from "@/src/components/itemdetails/item_delete_form";
import { ItemAttributeList, ItemHero, ItemStats, ItemTags, ItemTextBlock } from "@/src/components/itemdetails/item_details_view";
import ItemEditForm from "@/src/components/itemdetails/item_edit_form";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useItemStore } from "@/src/hooks/item_store";
import { colors, fonts, spacing, typography } from "@/src/theme/theme";
import { getRarityVariantByValue, getReactionsLikeCount } from "@/src/utils/data_access_utils";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

/** The user's own item: details, edit / delete, private note, comments. */
function ItemDetails() {
  const { t } = useTranslation();
  const { collectionType } = useCollectionStore();
  const { item } = useItemStore();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const rarity = getRarityVariantByValue(item.reactions);

  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xxl * 2 }}>
        <ItemHero item={item} collectionType={collectionType!} />
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <CustomButton
            title={t("common:actions.edit")}
            variant="outline"
            icon={<MaterialIcons name="edit" size={20} color={colors.text} />}
            onPress={() => setIsEditOpen(true)}
            containerStyle={{ flex: 1 }}
          />
          <CustomButton
            title={t("common:actions.delete")}
            variant="danger"
            icon={<MaterialIcons name="delete-outline" size={20} color={colors.onPrimary} />}
            onPress={() => setIsDeleteOpen(true)}
            containerStyle={{ flex: 1 }}
          />
        </View>
        <ItemStats
          item={item}
          rarity={
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xxs }}>
              {rarity ? <View style={{ width: 14, height: 14, backgroundColor: rarity.color, borderWidth: 1, borderColor: colors.border }} /> : null}
              <Text style={[typography.title, { color: colors.text }, !rarity && { fontFamily: fonts.italic }]}>
                {rarity ? t(rarity.titleKey) : t("feed:rarity.none")}
              </Text>
            </View>
          }
          likes={
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xxs }}>
              <FontAwesome name="heart" size={18} color={colors.danger} />
              <Text style={[typography.title, { color: colors.text }]}>{getReactionsLikeCount(item.reactions)}</Text>
            </View>
          }
        />
        <ItemTextBlock title={t("items:details.privateNote")} text={item.privateNote} emptyText={t("items:details.noPrivateNote")} helper={t("items:details.privateNoteHelp")} />
        <ItemTextBlock title={t("items:details.description")} text={item.description} emptyText={t("items:details.noDescriptionOwn")} helper={t("items:details.descriptionHelp")} />
        <ItemAttributeList item={item} collectionType={collectionType!} />
        <ItemTags tags={item.itemTags} />
        <CommentSection itemId={item.id} />
      </ScrollView>
      <ItemDeleteForm isDeleteItemConfirmVisible={{ value: isDeleteOpen, set: setIsDeleteOpen }} />
      <ItemEditForm isItemEditFormOverlayOpen={{ value: isEditOpen, set: setIsEditOpen }} />
    </>
  );
}

export default ItemDetails;
