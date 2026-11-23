import { Avatar } from "@/src/components/custom_ui/avatar";
import showToast from "@/src/components/custom_ui/toast";
import { backendAxios } from "@/src/const/backendAccessConfiguration";
import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { pressableShadowStyle } from "@/src/theme/pressable";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { CommunityStats } from "@/src/types/entities/community";
import User from "@/src/types/entities/user";
import { apiErrorMessage } from "@/src/utils/market_api";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { navigate } from "expo-router/build/global-state/routing";
import { useTranslation } from "react-i18next";
import { Image, Pressable, Text, View } from "react-native";

export async function openProfile(userId: string, failedKey = "community:stats.profileFailed") {
  try {
    const user = (await backendAxios.get<User>(`${endpoints.users}/${userId}`)).data;
    useOtherUserStore.getState().setUser(user);
    navigate({ pathname: ROUTES.OTHERUSER, params: pageParams.otheruser(user.name) });
  } catch (error) {
    showToast("error", apiErrorMessage(error, failedKey));
  }
}

const cardStyle = { flex: 1, minHeight: 176, padding: spacing.md, gap: spacing.xs, borderWidth: borders.width, borderColor: colors.border } as const;

/** Collector of the week: the most active user this week, with a gold cup. Tapping opens their profile. */
export function CollectorOfTheWeek({ collector }: { collector: CommunityStats["topCollector"] }) {
  const { t } = useTranslation();
  const title = t("community:stats.highlights.collector");

  if (!collector) {
    return (
      <View style={[cardStyle, { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }]}>
        <MaterialCommunityIcons name="trophy-outline" size={40} color={colors.textMuted} />
        <Text style={[typography.label, { color: colors.text, textAlign: "center" }]}>{title}</Text>
        <Text style={[typography.meta, { color: colors.textMuted, textAlign: "center" }]}>{t("community:stats.highlights.noCollector")}</Text>
      </View>
    );
  }

  const actions = t("community:stats.highlights.actions", { count: collector.activityCount });
  return (
    <Pressable
      onPress={() => openProfile(collector.userId)}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${collector.name}, ${actions}`}
      accessibilityHint={t("community:stats.highlights.openProfile")}
      style={({ pressed }) => [cardStyle, { backgroundColor: colors.primary, alignItems: "center" }, pressableShadowStyle(pressed)]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xxs }}>
        <MaterialCommunityIcons name="trophy" size={20} color={colors.secondary} />
        <Text style={[typography.label, { color: colors.secondary, textAlign: "center" }]} numberOfLines={2}>
          {title}
        </Text>
      </View>
      <View>
        <Avatar uri={collector.avatar} size={56} />
        <View style={{ position: "absolute", right: -12, bottom: -8, backgroundColor: colors.secondary, borderWidth: borders.width, borderColor: colors.primary, padding: 2 }}>
          <MaterialCommunityIcons name="trophy" size={18} color={colors.primary} />
        </View>
      </View>
      <Text style={[typography.bodyStrong, { color: colors.onPrimary, textAlign: "center" }]} numberOfLines={1}>
        {collector.name}
      </Text>
      <Text style={[typography.caption, { color: colors.onPrimary, textAlign: "center" }]}>{actions}</Text>
    </Pressable>
  );
}

/** The item type with the most items added this week. */
export function TrendingType({ type }: { type: CommunityStats["trendingType"] }) {
  const { t } = useTranslation();
  const title = t("community:stats.highlights.trending");

  if (!type) {
    return (
      <View style={[cardStyle, { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }]}>
        <MaterialCommunityIcons name="fire" size={40} color={colors.textMuted} />
        <Text style={[typography.label, { color: colors.text, textAlign: "center" }]}>{title}</Text>
        <Text style={[typography.meta, { color: colors.textMuted, textAlign: "center" }]}>{t("community:stats.highlights.noTrend")}</Text>
      </View>
    );
  }

  const added = t("community:stats.highlights.added", { count: type.itemsAdded });
  return (
    <View accessible accessibilityLabel={`${title}: ${type.name}, ${added}`} style={[cardStyle, { backgroundColor: colors.surface, alignItems: "center" }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xxs }}>
        <MaterialCommunityIcons name="fire" size={20} color={colors.danger} />
        <Text style={[typography.label, { color: colors.text, textAlign: "center" }]} numberOfLines={2}>
          {title}
        </Text>
      </View>
      <View style={{ width: 56, height: 56, alignItems: "center", justifyContent: "center", backgroundColor: type.color, borderWidth: borders.width, borderColor: colors.border }}>
        {type.icon ? <Image source={{ uri: `${endpoints.icons}/${type.icon}` }} style={{ width: 40, height: 40 }} accessibilityIgnoresInvertColors /> : null}
      </View>
      <Text style={[typography.bodyStrong, { color: colors.text, textAlign: "center" }]} numberOfLines={1}>
        {type.name}
      </Text>
      <Text style={[typography.caption, { color: colors.textMuted, textAlign: "center" }]}>{added}</Text>
    </View>
  );
}
