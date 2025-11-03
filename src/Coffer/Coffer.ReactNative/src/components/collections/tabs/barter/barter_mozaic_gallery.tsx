import { endpoints } from "@/src/const/endpoints";
import { customTheme } from "@/src/theme/theme";
import CollectionType from "@/src/types/entities/collectiontype";
import OfferItem from "@/src/types/entities/offer_item";
import TradeItem from "@/src/types/entities/trade_item";
import { adjustColor } from "@/src/utils/frontend_utils";
import React, { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";

interface BarterMozaicGalleryProps {
  items: TradeItem[] | OfferItem[];
  collectionType: CollectionType;
}

const HEIGHT = 200;

const BarterMozaicGallery: React.FC<BarterMozaicGalleryProps> = ({
  items,
  collectionType,
}) => {
  const validItems = items.filter(
    (t) => t.item && (t.item.image || collectionType.icon)
  );

  const [visibleUris, setVisibleUris] = useState<string[]>([]);

  const imageUris = useMemo(() => {
    if (!validItems.length) return [];
    return validItems.map((item) =>
      item.item?.image
        ? `${endpoints.itemsCoverImage}/${item.item.image}`
        : `${endpoints.icons}/${collectionType.icon}`
    );
  }, [
    validItems.length,
    collectionType.icon,
    endpoints.itemsCoverImage,
    endpoints.icons,
  ]);

  const darkContrastColor = adjustColor(
    collectionType.color,
    customTheme.colorChangePercent.dark
  );

  // --- Cycle logic for >6 images ---
  useEffect(() => {
    if (imageUris.length === 0) return;

    let pool = [...imageUris];

    const updateImages = () => {
      const nextBatch: string[] = [];

      while (nextBatch.length < 6 && pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        nextBatch.push(pool.splice(idx, 1)[0]);
      }

      if (nextBatch.length < 6 && imageUris.length > 0) {
        const refillCount = 6 - nextBatch.length;
        const refill = [...imageUris]
          .sort(() => 0.5 - Math.random())
          .slice(0, refillCount);
        nextBatch.push(...refill);
      }

      setVisibleUris(nextBatch);
      if (pool.length === 0) pool = [...imageUris];
    };

    updateImages();
    const interval = setInterval(updateImages, 3000);
    return () => clearInterval(interval);
  }, [imageUris.join("|")]);

  const imagesToShow = imageUris.length <= 6 ? imageUris : visibleUris;
  const count = imagesToShow.length;

  if (count === 0) return <View style={{ width: "100%", height: HEIGHT }} />;

  const renderImage = (uri: string, key: number) => (
    <Image key={key} source={{ uri, cache: "reload" }} style={styles.image} />
  );

  const renderLayout = () => {
    switch (count) {
      case 1:
        return renderImage(imagesToShow[0], 0);

      case 2:
        return (
          <View style={styles.row}>
            {imagesToShow.map((uri, i) => (
              <View key={i} style={styles.flexEqual}>
                {renderImage(uri, i)}
              </View>
            ))}
          </View>
        );

      case 3:
        return (
          <View style={styles.row}>
            <View style={styles.col}>
              <View style={styles.flexEqual}>
                {renderImage(imagesToShow[0], 0)}
              </View>
              <View style={styles.flexEqual}>
                {renderImage(imagesToShow[1], 1)}
              </View>
            </View>
            <View style={styles.col}>{renderImage(imagesToShow[2], 2)}</View>
          </View>
        );

      case 4:
        return (
          <View style={styles.wrap}>
            {imagesToShow.map((uri, i) => (
              <View key={i} style={styles.quarterTile}>
                {renderImage(uri, i)}
              </View>
            ))}
          </View>
        );

      case 5:
        // 2 vertical + 2 vertical + 1 big
        return (
          <View style={styles.row}>
            <View style={styles.col}>
              <View style={styles.flexEqual}>
                {renderImage(imagesToShow[0], 0)}
              </View>
              <View style={styles.flexEqual}>
                {renderImage(imagesToShow[1], 1)}
              </View>
            </View>
            <View style={styles.col}>
              <View style={styles.flexEqual}>
                {renderImage(imagesToShow[2], 2)}
              </View>
              <View style={styles.flexEqual}>
                {renderImage(imagesToShow[3], 3)}
              </View>
            </View>
            <View style={styles.col}>{renderImage(imagesToShow[4], 4)}</View>
          </View>
        );

      case 6:
      default:
        // 2 rows × 3 columns
        return (
          <View style={styles.sixGrid}>
            {imagesToShow.slice(0, 6).map((uri, i) => (
              <View key={i} style={styles.sixTile}>
                {renderImage(uri, i)}
              </View>
            ))}
          </View>
        );
    }
  };

  return (
    <View
      style={[
        styles.container,
        { width: "100%", height: HEIGHT, borderColor: darkContrastColor },
      ]}
    >
      {renderLayout()}
    </View>
  );
};

export default BarterMozaicGallery;

const styles = StyleSheet.create({
  container: {
    backgroundColor: "black",
    borderWidth: 2,
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  row: {
    flexDirection: "row",
    width: "100%",
    height: "100%",
  },
  col: {
    flex: 1,
  },
  flexEqual: {
    flex: 1,
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
    height: "100%",
  },
  quarterTile: {
    width: "50%",
    height: "50%",
  },
  // --- New styles for 6 images (2x3 grid) ---
  sixGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
    height: "100%",
  },
  sixTile: {
    width: "33.3333%",
    height: "50%",
  },
});
