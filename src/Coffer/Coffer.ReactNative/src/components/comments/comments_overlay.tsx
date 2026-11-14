import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import { useCommentCount } from "@/src/hooks/comment_api";
import { customTheme } from "@/src/theme/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from "react-native";
import CustomText from "../custom_ui/custom_text";
import CommentSection from "./comment_section";

/** Comment button for a feed card: shows the count and opens the item's comments in a sheet. */
export function FeedCommentButton({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false);
  const { data: count = 0 } = useCommentCount(itemId);

  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }} hitSlop={8}>
        <MaterialIcons name="chat-bubble-outline" size={20} color={customTheme.colors.secondary} />
        <CustomText style={{ color: customTheme.colors.secondary }}>{count}</CustomText>
      </TouchableOpacity>
      <CustomOverlay isVisible={open} onClose={() => setOpen(false)} overlayTitle="Comments">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={{ padding: 12 }} keyboardShouldPersistTaps="handled">
            {open ? <CommentSection itemId={itemId} /> : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </CustomOverlay>
    </>
  );
}
