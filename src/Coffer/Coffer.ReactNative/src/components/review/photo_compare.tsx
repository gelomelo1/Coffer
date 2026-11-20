import { endpoints } from "@/src/const/endpoints";
import { useUserStore } from "@/src/hooks/user_store";
import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import { ItemProvided } from "@/src/types/entities/item";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { pendingImageUrl } from "@/src/utils/pending_api";

interface PhotoCompareProps {
  pendingId: string;
  /** The selected existing item, or null when "+ New" is selected. */
  match: ItemProvided | null;
  matchName: string;
}

/** The cap from the photo next to the selected match, so "is this the same one?" is one look. Tap to enlarge. */
function PhotoCompare({ pendingId, match, matchName }: PhotoCompareProps) {
  const { t } = useTranslation();
  const { token } = useUserStore();
  const [enlarged, setEnlarged] = useState<string | null>(null);
  const headers = { Authorization: `Bearer ${token}` };
  const yours = pendingImageUrl(pendingId);
  const theirs = match ? `${endpoints.itemsCoverImage}/${match.image}` : null;

  const tile = (uri: string | null, caption: string, sub: string | null, label: string) => (
    <View style={{ flex: 1, gap: spacing.xs }}>
      <Pressable
        onPress={() => uri && setEnlarged(uri)}
        disabled={!uri}
        accessibilityRole="imagebutton"
        accessibilityLabel={label}
        accessibilityHint={uri ? t("items:review.enlargeHint") : undefined}
        style={{ aspectRatio: 1, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}
      >
        {uri ? (
          <Image source={{ uri, headers }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : (
          <View style={{ alignItems: "center", gap: spacing.xs, padding: spacing.sm }}>
            <MaterialIcons name="add-circle-outline" size={sizes.iconLg} color={colors.textMuted} />
            <Text style={[typography.meta, { color: colors.textMuted, textAlign: "center" }]}>{t("items:review.newItemTile")}</Text>
          </View>
        )}
      </Pressable>
      <Text style={[typography.label, { color: colors.text }]} numberOfLines={1}>
        {caption}
      </Text>
      {sub ? <Text style={[typography.caption, { color: colors.textMuted }]}>{sub}</Text> : null}
    </View>
  );

  return (
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      {tile(yours, t("items:review.yourPhoto"), null, t("items:review.yourPhoto"))}
      {tile(
        theirs,
        match ? matchName : t("items:review.newItem"),
        match ? t("items:review.youHave", { count: match.quantity }) : null,
        match ? `${matchName}, ${t("items:review.youHave", { count: match.quantity })}` : t("items:review.newItem"),
      )}
      <Modal visible={enlarged !== null} transparent animationType="fade" onRequestClose={() => setEnlarged(null)} statusBarTranslucent>
        <SafeAreaView style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)" }}>
          <Pressable
            onPress={() => setEnlarged(null)}
            accessibilityRole="button"
            accessibilityLabel={t("accessibility:close")}
            style={{ alignSelf: "flex-end", padding: spacing.md, minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" }}
          >
            <MaterialIcons name="close" size={sizes.iconMd} color="#ffffff" />
          </Pressable>
          {enlarged ? <Image source={{ uri: enlarged, headers }} style={{ flex: 1, margin: spacing.md }} resizeMode="contain" /> : null}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

export default PhotoCompare;
