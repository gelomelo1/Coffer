import rarityVariants from "@/src/const/rarity_variants";
import { customTheme } from "@/src/theme/theme";
import { View } from "react-native";
import { CheckBox, Overlay } from "react-native-elements";

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
    <Overlay
      isVisible={isFeedRaritySelectorVisible.value}
      onBackdropPress={() => isFeedRaritySelectorVisible.set(false)}
      overlayStyle={{
        backgroundColor: customTheme.colors.background,
      }}
    >
      <View
        style={{
          width: "100%",
          justifyContent: "center",
          alignItems: "flex-start", // ✅ align all boxes on the left
          gap: 10,
        }}
      >
        <CheckBox
          title="No Rate"
          containerStyle={{
            backgroundColor: "transparent",
            borderWidth: 0,
            width: "100%", // ✅ ensures consistent layout
            alignItems: "flex-start",
            paddingVertical: 0,
          }}
          textStyle={{ color: customTheme.colors.primary }}
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
              width: "100%", // ✅ full width for alignment
              alignItems: "flex-start", // ✅ aligns icon vertically with others
              paddingVertical: 0,
            }}
            textStyle={{ color: rarity.color }}
            checkedColor={rarity.color}
            uncheckedColor={rarity.color}
            checkedIcon="dot-circle-o"
            uncheckedIcon="circle-o"
            checked={selectedRarity === Number(key)}
            onPress={() => handleRaritySelect(Number(key))}
          />
        ))}
      </View>
    </Overlay>
  );
}

export default FeedRaritySelector;
