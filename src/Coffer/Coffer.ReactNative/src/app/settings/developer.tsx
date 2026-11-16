import { ConfirmDialog } from "@/src/components/custom_ui/confirm_dialog";
import CustomButton from "@/src/components/custom_ui/custom_button";
import { Screen } from "@/src/components/custom_ui/screen";
import showToast from "@/src/components/custom_ui/toast";
import { colors, typography } from "@/src/theme/theme";
import { removeToken } from "@/src/utils/token_store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";

/** Developer tools: wipe local storage (token, cached settings). */
function Developer() {
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState(false);

  const handleClearStorage = async () => {
    await AsyncStorage.clear();
    await removeToken();
    setConfirm(false);
    showToast("success", t("settings:developer.cleared"));
  };

  return (
    <Screen scroll>
      <Text style={[typography.body, { color: colors.text }]}>{t("settings:developer.clearExplanation")}</Text>
      <CustomButton title={t("settings:developer.clear")} variant="danger" onPress={() => setConfirm(true)} />
      <ConfirmDialog
        isVisible={confirm}
        title={t("settings:developer.clearTitle")}
        message={t("settings:developer.clearExplanation")}
        confirmLabel={t("settings:developer.clear")}
        destructive
        onCancel={() => setConfirm(false)}
        onConfirm={handleClearStorage}
      />
    </Screen>
  );
}

export default Developer;
