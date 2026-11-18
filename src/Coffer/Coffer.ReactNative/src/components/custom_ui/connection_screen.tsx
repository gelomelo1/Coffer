import CustomButton from "@/src/components/custom_ui/custom_button";
import { backendAxios } from "@/src/const/backendAccessConfiguration";
import { endpoints } from "@/src/const/endpoints";
import { useConnectionStore } from "@/src/hooks/connection_store";
import { colors, spacing, typography } from "@/src/theme/theme";
import { ConnectionProblem, isDeviceOffline } from "@/src/utils/connectivity";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, BackHandler, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** While the server is unavailable, ask it again this often. */
const SERVER_RETRY_MS = 10000;
const HEALTH_TIMEOUT_MS = 8000;

const ICONS = { offline: "wifi-off", server: "cloud-off" } as const;

/** Phone online → is Coffer's server answering? Any real answer (even an error status) means it is up. */
async function serverAnswers(): Promise<boolean> {
  try {
    await backendAxios.get(endpoints.health, { timeout: HEALTH_TIMEOUT_MS });
    return true;
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    return status != null && ![502, 503, 504].includes(status);
  }
}

/**
 * Covers the whole app when a request couldn't reach the backend: "No internet connection" when the phone is
 * offline, "Coffer is unavailable" when the phone is online but the server doesn't answer. It is drawn on top of the
 * app instead of navigating, so the user is back exactly where they were (half-typed text included) once it closes.
 * It closes by itself: when the phone is back online, or (server) when a periodic check gets an answer. The screens
 * underneath then reload their data; actions that failed (sending a message, saving) are not repeated automatically.
 */
function ConnectionScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { problem, setProblem } = useConnectionStore();
  const [checking, setChecking] = useState(false);
  const [stillFailing, setStillFailing] = useState(false);
  const checkingRef = useRef(false);

  const recheck = useCallback(
    async (manual: boolean) => {
      if (checkingRef.current) return;
      checkingRef.current = true;
      if (manual) setChecking(true);
      try {
        let next: ConnectionProblem | null;
        if (isDeviceOffline(await NetInfo.fetch())) next = "offline";
        else next = (await serverAnswers()) ? null : "server";
        setProblem(next);
        setStillFailing(manual && next != null);
        if (next == null) queryClient.refetchQueries({ type: "active" });
      } finally {
        checkingRef.current = false;
        if (manual) setChecking(false);
      }
    },
    [queryClient, setProblem],
  );

  // Back online → check the server too (the phone may be online while Coffer is down).
  useEffect(() => {
    if (problem !== "offline") return;
    return NetInfo.addEventListener((state) => {
      if (!isDeviceOffline(state)) recheck(false);
    });
  }, [problem, recheck]);

  // Server down → keep asking it, and switch to the offline page if the phone loses its connection meanwhile.
  useEffect(() => {
    if (problem !== "server") return;
    const timer = setInterval(() => recheck(false), SERVER_RETRY_MS);
    return () => clearInterval(timer);
  }, [problem, recheck]);

  // Screen readers hear what happened; the hardware back button would change the screen hidden underneath.
  useEffect(() => {
    if (!problem) return;
    setStillFailing(false);
    AccessibilityInfo.announceForAccessibility(t(`common:connection.${problem}.title`));
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [problem, t]);

  if (!problem) return null;

  return (
    <View style={{ position: "absolute", inset: 0, backgroundColor: colors.bg, zIndex: 1100 }} accessibilityViewIsModal>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: spacing.lg,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.lg,
          gap: spacing.lg,
        }}
      >
        <MaterialIcons name={ICONS[problem]} size={64} color={colors.text} style={{ alignSelf: "center" }} accessibilityElementsHidden importantForAccessibility="no" />
        <View style={{ gap: spacing.sm }}>
          <Text accessibilityRole="header" style={[typography.headline, { color: colors.text, textAlign: "center" }]}>
            {t(`common:connection.${problem}.title`)}
          </Text>
          <Text style={[typography.body, { color: colors.text, textAlign: "center" }]}>{t(`common:connection.${problem}.text`)}</Text>
        </View>
        <CustomButton title={t("common:connection.tryAgain")} loading={checking} onPress={() => recheck(true)} />
        {stillFailing ? (
          <Text accessibilityLiveRegion="polite" style={[typography.meta, { color: colors.text, textAlign: "center" }]}>
            {t(`common:connection.${problem}.still`)}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

export default ConnectionScreen;
