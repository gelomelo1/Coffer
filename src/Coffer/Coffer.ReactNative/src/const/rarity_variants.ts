import RarityValue from "../types/helpers/rarity_value";

const rarityVariants: Record<number, RarityValue> = {
  1: { title: "Common", color: "#B0BEC5" },
  2: { title: "Uncommon", color: "#8BC34A" },
  3: { title: "Rare", color: "#2196F3" },
  4: { title: "Relic", color: "#550000" },
};

export default rarityVariants;
