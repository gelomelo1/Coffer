import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import { useCommentCount } from "@/src/hooks/comment_api";
import { colors, fonts, sizes, spacing } from "@/src/theme/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text } from "react-native";
import CommentSection from "./comment_section";

/** Comment button for a feed card: shows the count and opens the item's comments in a sheet. */
export function FeedCommentButton({ itemId, color = colors.text }: { itemId: string; color?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: count = 0 } = useCommentCount(itemId);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xxs,
          minHeight: sizes.touch,
          minWidth: sizes.touch,
          justifyContent: "center",
          opacity: pressed ? 0.6 : 1,
        })}
        accessibilityRole="button"
        accessibilityLabel={t("feed:card.comments")}
        accessibilityValue={{ text: String(count) }}
      >
        <MaterialIcons name="chat-bubble-outline" size={22} color={color} />
        <Text style={{ color, fontFamily: fonts.bold, fontSize: 16 }}>{count}</Text>
      </Pressable>
      {/* The sheet is keyboard-aware itself; the section scrolls so the composer stays reachable. */}
      <CustomOverlay isVisible={open} onClose={() => setOpen(false)} overlayTitle={t("comments:title")}>
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
          {open ? <CommentSection itemId={itemId} /> : null}
        </ScrollView>
      </CustomOverlay>
    </>
  );
}
