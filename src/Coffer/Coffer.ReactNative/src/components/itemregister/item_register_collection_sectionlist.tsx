import { endpoints } from "@/src/const/endpoints";
import { useCollectionTypeStore } from "@/src/hooks/collection_type_store";
import { useUserStore } from "@/src/hooks/user_store";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { useTranslation } from "react-i18next";
import { Divider } from "../custom_ui/card";
import ListRow from "../custom_ui/list_row";
import SheetModal from "../custom_ui/sheet_modal";
import { EmptyState } from "../custom_ui/states";
import { ResultThumb } from "../collections/tabs/home/result_thumb";
import { Collection } from "@/src/types/entities/collection";
import { Image, SectionList, Text, View } from "react-native";

interface ItemRegisterCollectionSectionListProps {
  isItemRegisterCollectionSectionListOverlayOpen: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };

  selectedCollection: {
    value: Collection | null;
    set: React.Dispatch<React.SetStateAction<Collection | null>>;
  };

  collections: Collection[];
}

function ItemRegisterCollectionSectionList({
  isItemRegisterCollectionSectionListOverlayOpen,
  selectedCollection,
  collections,
}: ItemRegisterCollectionSectionListProps) {
  const { t } = useTranslation();
  const { collectionTypes } = useCollectionTypeStore();
  const { token } = useUserStore();

  const existingCollectionTypeIds = Array.from(
    new Set(collections.map((collection) => collection.collectionTypeId)),
  );

  const handleClose = () => {
    isItemRegisterCollectionSectionListOverlayOpen.set(false);
  };

  const handleCollectionPress = (collection: Collection) => {
    selectedCollection.set(collection);
    isItemRegisterCollectionSectionListOverlayOpen.set(false);
  };

  const sections = collectionTypes
    .filter((ct) => existingCollectionTypeIds.includes(ct.id))
    .map((ct) => {
      const items = collections.filter(
        (collection) => collection.collectionTypeId === ct.id,
      );
      return {
        id: ct.id,
        title: ct.name,
        icon: ct.icon,
        data: items,
      };
    });

  return (
    <SheetModal visible={isItemRegisterCollectionSectionListOverlayOpen.value} onClose={handleClose} title={t("items:register.chooseCollection")}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item, section }) => (
          <ListRow
            title={item.name}
            leading={
              <ResultThumb
                uri={item.image ? `${endpoints.collectionsCoverImage}/${item.image}` : `${endpoints.icons}/${section.icon}`}
                token={token}
              />
            }
            onPress={() => handleCollectionPress(item)}
          />
        )}
        ItemSeparatorComponent={Divider}
        renderSectionHeader={({ section }) => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.surfaceAlt, borderBottomWidth: borders.width, borderTopWidth: borders.width, borderColor: colors.border }}>
            <Image source={{ uri: `${endpoints.icons}/${section.icon}`, headers: { Authorization: `Bearer ${token}` }, cache: "reload" }} style={{ width: 24, height: 24 }} />
            <Text style={[typography.label, { color: colors.text }]}>{section.title}</Text>
          </View>
        )}
        stickySectionHeadersEnabled
        ListFooterComponent={
          sections.length > 0 ? (
            <Text style={[typography.meta, { color: colors.textMuted, textAlign: "center", padding: spacing.lg }]}>{t("feed:search.endOfResults")}</Text>
          ) : null
        }
        ListEmptyComponent={<EmptyState icon="inventory-2" title={t("items:register.noCollections")} text={t("collections:list.emptyText")} />}
      />
    </SheetModal>
  );
}

export default ItemRegisterCollectionSectionList;
