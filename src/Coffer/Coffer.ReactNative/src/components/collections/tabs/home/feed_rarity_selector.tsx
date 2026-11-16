import { SelectOptionRow } from "@/src/components/custom_ui/select_shared";
import SheetModal from "@/src/components/custom_ui/sheet_modal";
import rarityVariants from "@/src/const/rarity_variants";
import { colors } from "@/src/theme/theme";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

interface FeedRaritySelectorProps {
  isFeedRaritySelectorVisible: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
  selectedRarity: number | null | undefined;
  onRaritySelect: (rarity: number | null | undefined) => void;
}

function Swatch({ color }: { color: string }) {
  return <View style={{ width: 20, height: 20, backgroundColor: color, borderWidth: 2, borderColor: colors.border }} />;
}

/** Pick a rarity tier for an item (or clear the rating). */
function FeedRaritySelector({ isFeedRaritySelectorVisible, selectedRarity, onRaritySelect }: FeedRaritySelectorProps) {
  const { t } = useTranslation();
  const select = (rarity: number | null) => {
    onRaritySelect(rarity);
    isFeedRaritySelectorVisible.set(false);
  };

  return (
    <SheetModal
      visible={isFeedRaritySelectorVisible.value}
      onClose={() => isFeedRaritySelectorVisible.set(false)}
      title={t("feed:rarity.selectTitle")}
    >
      <ScrollView>
        <SelectOptionRow
          label={t("feed:rarity.noRating")}
          muted
          selected={selectedRarity === null || selectedRarity === undefined}
          onPress={() => select(null)}
        />
        {Object.entries(rarityVariants).map(([key, rarity]) => (
          <SelectOptionRow
            key={key}
            label={t(rarity.titleKey)}
            selected={selectedRarity === Number(key)}
            additionalElement={<Swatch color={rarity.color} />}
            onPress={() => select(Number(key))}
          />
        ))}
      </ScrollView>
    </SheetModal>
  );
}

export default FeedRaritySelector;
