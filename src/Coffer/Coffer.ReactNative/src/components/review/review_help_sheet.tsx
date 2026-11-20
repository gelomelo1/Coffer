import { colors, sizes, spacing, typography } from "@/src/theme/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Checkbox } from "../custom_ui/checkbox";
import CustomButton from "../custom_ui/custom_button";
import { Dialog } from "../custom_ui/dialog";

const SEEN_KEY = "reviewHelpSeen";

/** Opens the help once per device; afterwards only from the ⓘ button. */
export function useReviewHelp() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then((seen) => {
        if (seen !== "1") setOpen(true);
      })
      .catch(() => setOpen(true));
  }, []);
  return { open, show: () => setOpen(true), hide: () => setOpen(false) };
}

/** How adding works, in three steps. */
function ReviewHelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [dontShow, setDontShow] = useState(true);

  const close = () => {
    if (dontShow) void AsyncStorage.setItem(SEEN_KEY, "1").catch(() => {});
    onClose();
  };

  const step = (icon: React.ComponentProps<typeof MaterialIcons>["name"], title: string, text: string) => (
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      <MaterialIcons name={icon} size={sizes.iconMd} color={colors.secondary} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typography.bodyStrong, { color: colors.text }]}>{title}</Text>
        <Text style={[typography.body, { color: colors.text }]}>{text}</Text>
      </View>
    </View>
  );

  return (
    <Dialog visible={visible} onClose={close} title={t("items:review.helpTitle")} actions={<CustomButton title={t("items:review.helpOk")} onPress={close} />}>
      <View style={{ gap: spacing.md }}>
        {step("photo-camera", t("items:review.help1Title"), t("items:review.help1Text"))}
        {step("fact-check", t("items:review.help2Title"), t("items:review.help2Text"))}
        {step("undo", t("items:review.help3Title"), t("items:review.help3Text"))}
        <Checkbox checked={dontShow} onPress={() => setDontShow((d) => !d)} label={t("items:review.helpDontShow")} />
      </View>
    </Dialog>
  );
}

export default ReviewHelpSheet;
