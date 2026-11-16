import RarityValue from "../types/helpers/rarity_value";

/** Rarity tiers. `color` is the tier swatch (shown next to navy text — several tiers are too light for text). */
const rarityVariants: Record<number, RarityValue> = {
  1: { titleKey: "feed:rarity.common", color: "#B0BEC5" },
  2: { titleKey: "feed:rarity.uncommon", color: "#8BC34A" },
  3: { titleKey: "feed:rarity.rare", color: "#2196F3" },
  4: { titleKey: "feed:rarity.relic", color: "#550000" },
};

export default rarityVariants;
