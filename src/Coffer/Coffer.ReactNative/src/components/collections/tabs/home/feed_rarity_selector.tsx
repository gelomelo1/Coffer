import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import rarityVariants from "@/src/const/rarity_variants";
import { customTheme } from "@/src/theme/theme";
import { View } from "react-native";
import { CheckBox } from "react-native-elements";

interface FeedRaritySelectorProps {
  isFeedRaritySelectorVisible: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
  selectedRarity: number | null | undefined;
  onRaritySelect: (rarity: number | null | undefined) => void;
}

function FeedRaritySelector({
  isFeedRaritySelectorVisible,
  selectedRarity,
  onRaritySelect,
}: FeedRaritySelectorProps) {
  const handleRaritySelect = (rarity: number | null | undefined) => {
    onRaritySelect(rarity);
    isFeedRaritySelectorVisible.set(false);
  };

  return (
    <CustomOverlay
      isVisible={isFeedRaritySelectorVisible.value}
      onClose={() => isFeedRaritySelectorVisible.set(false)}
      overlayTitle="Select a rairty value"
    >
      <View
        style={{
          width: "100%",
          justifyContent: "center",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <CheckBox
          title="No Rate"
          containerStyle={{
            backgroundColor: "transparent",
            borderWidth: 0,
            width: "100%",
            alignItems: "flex-start",
            paddingVertical: 0,
          }}
          size={32}
          textStyle={{ color: customTheme.colors.primary, fontSize: 32 }}
          checkedColor={customTheme.colors.primary}
          uncheckedColor={customTheme.colors.primary}
          checkedIcon="dot-circle-o"
          uncheckedIcon="circle-o"
          checked={selectedRarity === null || selectedRarity === undefined}
          onPress={() => handleRaritySelect(null)}
        />

        {Object.entries(rarityVariants).map(([key, rarity]) => (
          <CheckBox
            key={key}
            title={rarity.title}
            containerStyle={{
              backgroundColor: "transparent",
              borderWidth: 0,
              width: "100%",
              alignItems: "flex-start",
              paddingVertical: 0,
            }}
            size={32}
            textStyle={{ color: rarity.color, fontSize: 32 }}
            checkedColor={rarity.color}
            uncheckedColor={rarity.color}
            checkedIcon="dot-circle-o"
            uncheckedIcon="circle-o"
            checked={selectedRarity === Number(key)}
            onPress={() => handleRaritySelect(Number(key))}
          />
        ))}
      </View>
    </CustomOverlay>
  );
}

export default FeedRaritySelector;
