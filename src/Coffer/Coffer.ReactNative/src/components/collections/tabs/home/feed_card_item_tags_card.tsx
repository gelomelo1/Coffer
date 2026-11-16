import { Divider } from "@/src/components/custom_ui/card";
import ListRow from "@/src/components/custom_ui/list_row";
import SheetModal from "@/src/components/custom_ui/sheet_modal";
import { borders, colors, fonts, spacing, typography } from "@/src/theme/theme";
import ItemTagSearch from "@/src/types/entities/item_tags_search";
import User from "@/src/types/entities/user";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Text, View } from "react-native";
import FeedSearchItemCard from "./feed_seach_item_card";

interface FeedSearchItemTagCardProps {
  currentUser: User;
  itemTagsSearch: ItemTagSearch;
  closeOverlay: () => void;
}

/** A matching tag; opens the list of items carrying it. */
function FeedSearchItemTagCard({ currentUser, itemTagsSearch, closeOverlay }: FeedSearchItemTagCardProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const handleCloseItemOverlay = () => {
    closeOverlay();
    setIsOpen(false);
  };

  return (
    <>
      <ListRow
        title={itemTagsSearch.value}
        subtitle={t("feed:search.found", { count: itemTagsSearch.foundItems.length })}
        leading={
          <View style={{ width: 48, height: 48, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: colors.text }}>#</Text>
          </View>
        }
        onPress={() => setIsOpen(true)}
      />
      <SheetModal visible={isOpen} onClose={() => setIsOpen(false)} title={t("feed:search.tagResultsTitle", { tag: itemTagsSearch.value })}>
        <FlatList
          data={itemTagsSearch.foundItems}
          keyExtractor={(item) => item.item.id.toString()}
          renderItem={({ item }) => <FeedSearchItemCard currentUser={currentUser} itemSearch={item} closeOverlay={handleCloseItemOverlay} />}
          ItemSeparatorComponent={() => <Divider />}
          ListFooterComponent={
            <Text style={[typography.meta, { color: colors.textMuted, textAlign: "center", padding: spacing.lg }]}>{t("feed:search.endOfResults")}</Text>
          }
        />
      </SheetModal>
    </>
  );
}

export default FeedSearchItemTagCard;
