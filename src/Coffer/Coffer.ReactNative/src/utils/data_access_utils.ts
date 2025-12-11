import { FlagType, getAllCountries } from "react-native-country-picker-modal";
import {
  itemSortDefaultOptions,
  nestedAttributeFilterQuery,
} from "../const/filter";
import rarityVariants from "../const/rarity_variants";
import Attribute from "../types/entities/attribute";
import { Item, ItemProvided } from "../types/entities/item";
import ItemAttribute from "../types/entities/item_attribute";
import ItemOptions from "../types/entities/itemoptions";
import { Offer } from "../types/entities/offer";
import { Reaction } from "../types/entities/reaction";
import { Trade } from "../types/entities/trade";
import TradeReivewPack from "../types/entities/trade_review_pack";
import AttributeValue, {
  AttributeTypes,
} from "../types/helpers/attribute_data";
import { TradeStatus } from "../types/helpers/barter_status";
import { QuerySortData } from "../types/helpers/query_data";
import RarityValue from "../types/helpers/rarity_value";
import ReviewSide from "../types/helpers/review_side";

export function getItemAttributeValue(
  itemAttribute: ItemAttribute
): AttributeValue {
  let value: string | number | boolean | Date | null;
  let valueString = "";
  let valueKey: AttributeTypes;

  switch (itemAttribute.attribute.dataType) {
    case "string":
    case "select":
      value = itemAttribute.valueString ?? null;
      valueString = itemAttribute.valueString;
      valueKey = "valueString";
      break;
    case "number":
      value = itemAttribute.valueNumber ?? null;
      valueString = itemAttribute.valueNumber.toLocaleString();
      valueKey = "valueNumber";
      break;
    case "boolean":
      value = itemAttribute.valueBoolean ?? null;
      valueString = itemAttribute.valueBoolean ? "true" : "false";
      valueKey = "valueBoolean";
      break;
    case "date":
      value = itemAttribute.valueDate
        ? new Date(itemAttribute.valueDate)
        : null;
      valueString = new Date(itemAttribute.valueDate).toLocaleDateString();
      valueKey = "valueDate";
      break;
    default:
      value = null;
      valueKey = "";
  }

  return {
    itemAttribute: itemAttribute,
    value,
    valueString,
    valueKey,
  };
}

export function getAttributeValue(attribute: Attribute): AttributeTypes {
  switch (attribute.dataType) {
    case "string":
    case "select":
      return "valueString";
    case "number":
      return "valueNumber";
    case "boolean":
      return "valueBoolean";
    case "date":
      return "valueDate";
    default:
      return "";
  }
}

export function getItemPrimaryAttributeValue(
  itemAttributes: ItemAttribute[]
): AttributeValue | null {
  const primaryAttr = itemAttributes.find((attr) => attr.attribute.primary);
  return primaryAttr ? getItemAttributeValue(primaryAttr) : null;
}

export function parseSortKeysToQuerySortData(keys: string[]): QuerySortData[] {
  return keys.map((key) => {
    const [field, direction] = key.split("_");
    if (direction !== "asc" && direction !== "desc") {
      throw new Error(`Invalid direction in sort key: ${key}`);
    }
    return { field, direction };
  });
}

export function generateSortRecordDataForItem(
  attributes: Attribute[]
): { value: string; label: string }[] {
  const records = itemSortDefaultOptions.flatMap((option) => [
    {
      value: `${option}_asc`,
      label: `${lowerCamelCaseToNormalFormat(option)} ascending`,
    },
    {
      value: `${option}_desc`,
      label: `${lowerCamelCaseToNormalFormat(option)} descending`,
    },
  ]);

  const primaryAttribute = attributes.find((attribute) => attribute.primary);
  if (primaryAttribute) {
    const id = primaryAttribute.id;
    const name = primaryAttribute.name;
    const key = getAttributeValue(primaryAttribute);
    const nestedSortQuery = nestedAttributeFilterQuery(id, key);
    records.push(
      {
        value: `${nestedSortQuery}_asc`,
        label: `${lowerCamelCaseToNormalFormat(name)} ascending`,
      },
      {
        value: `${nestedSortQuery}_desc`,
        label: `${lowerCamelCaseToNormalFormat(name)} descending`,
      }
    );
  }

  return records;
}

function lowerCamelCaseToNormalFormat(input: string): string {
  if (!input) return "";

  const capitalized = input[0].toUpperCase() + input.slice(1);
  return capitalized.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function getOptions(optionsData: ItemOptions | undefined) {
  if (!optionsData) return [];
  const values = optionsData.optionIds.split(";");
  const labels = optionsData.optionLabels.split(";");

  const options = values.map((value, index) => ({
    value: value.trim(),
    label: labels[index].trim() ?? "",
  }));

  return options;
}

export function getItemsQuantity(items: Item[]) {
  let quantity = 0;
  items.forEach((item) => (quantity += item.quantity));
  return quantity;
}

export function updateItemAttributeValue(
  attr: ItemAttribute,
  newValue: any
): ItemAttribute {
  switch (attr.attribute.dataType) {
    case "string":
    case "select":
      return { ...attr, valueString: newValue as string };
    case "number":
      return { ...attr, valueNumber: newValue as number };
    case "boolean":
      return { ...attr, valueBoolean: newValue as boolean };
    case "date":
      return { ...attr, valueDate: newValue as string };
    default:
      return attr;
  }
}

export const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunked: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
};

export function getDefaultAttributeValue(
  attribute: Attribute
): string | number | boolean | null {
  switch (attribute.dataType) {
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "date":
      return new Date().toISOString();
    case "select":
      return "";
    default:
      return null;
  }
}

export async function getCountryByCode(countryCode: string) {
  const value = await getAllCountries(
    FlagType.FLAT,
    undefined,
    undefined,
    undefined,
    [countryCode as any],
    undefined,
    undefined,
    undefined
  );

  if (value.length === 0) return null;

  return value[0];
}

export function getReactionsLikeCount(reactions: Reaction[]) {
  let likeCount = 0;
  reactions.forEach((reactions) => {
    if (reactions.liked) likeCount += 1;
  });

  return likeCount;
}

export function getRarityVariantByValue(
  reactions: Reaction[]
): RarityValue | null {
  if (!reactions.length) return null;

  const validRarities = reactions
    .map((r) => r.rarity)
    .filter((r): r is number => r !== null);

  if (!validRarities.length) return null;

  const averageRarity =
    validRarities.reduce((sum, r) => sum + r, 0) / validRarities.length;

  const roundedRarity = Math.floor(averageRarity + 0.5);

  const clampedRarity = Math.min(Math.max(roundedRarity, 1), 4);

  return rarityVariants[clampedRarity];
}

export function getTradeStatus(offers: Offer[]): TradeStatus {
  for (const offer of offers) {
    if (offer.status === "traded") return "traded";
    if (offer.status === "accepted") return "offerAccepted";
    if (offer.status === "revertByCreator") return "offerRevertByCreator";
    if (offer.status === "revertByOfferer") return "offerRevertByOfferer";
  }

  return "open";
}

export function isItemAvailableForTrade(
  item: ItemProvided,
  trades: Trade[],
  offers: Offer[],
  excludeTrade?: Trade,
  excludeOffer?: Offer
) {
  if (item.quantity <= 1) return false;

  let itemsInTradeCount = 0;

  trades.forEach((trade) => {
    if (
      trade !== excludeTrade &&
      getTradeStatus(trade.offers) !== "traded" &&
      trade.tradeItems.find((tradeItem) => tradeItem.itemId === item.id)
    ) {
      itemsInTradeCount++;
    }
  });

  offers.forEach((offer) => {
    if (
      offer !== excludeOffer &&
      offer.status !== "traded" &&
      offer.offerItems.find((offerItem) => offerItem.itemId === item.id)
    ) {
      itemsInTradeCount++;
    }
  });

  return item.quantity - itemsInTradeCount > 1;
}

export function getTradeReviewsRating(
  type: "like" | "dislike",
  tradeReviews: TradeReivewPack[],
  userId: string
) {
  let count = 0;

  for (const pack of tradeReviews) {
    if (pack.trader?.revieweeId === userId) {
      const isLike = pack.trader.rating === true;
      if ((type === "like" && isLike) || (type === "dislike" && !isLike)) {
        count++;
      }
    }

    if (pack.offerer?.revieweeId === userId) {
      const isLike = pack.offerer.rating === true;
      if ((type === "like" && isLike) || (type === "dislike" && !isLike)) {
        count++;
      }
    }
  }

  return count;
}

export function getCurrentUserReview(
  tradeReviews: TradeReivewPack,
  userId: string
): ReviewSide | null {
  if (tradeReviews.trader?.reviewerId === userId) {
    return { side: "trader", review: tradeReviews.trader };
  }

  if (tradeReviews.offerer?.reviewerId === userId) {
    return { side: "offerer", review: tradeReviews.offerer };
  }

  return null;
}

export function getCurrentUserReviewer(
  tradeReviews: TradeReivewPack,
  userId: string
): ReviewSide | null {
  if (tradeReviews.offerer?.reviewerId !== userId && tradeReviews.offerer) {
    return { side: "offerer", review: tradeReviews.offerer };
  }

  if (tradeReviews.trader?.reviewerId !== userId && tradeReviews.trader) {
    return { side: "trader", review: tradeReviews.trader };
  }

  return null;
}
