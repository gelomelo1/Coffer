import { CommunityTile } from "@/src/components/community/community_tile";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { colors, spacing } from "@/src/theme/theme";
import { navigate } from "expo-router/build/global-state/routing";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

/** Community: News, Stats & facts, Shape What's Next — three tiles that fill the screen between header and tab bar. */
function Community() {
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md, paddingRight: spacing.md + 3, paddingBottom: spacing.md + 3, gap: spacing.sm + 3 }}>
      <CommunityTile
        icon="newspaper-variant-outline"
        title={t("community:tiles.news.title")}
        subtitle={t("community:tiles.news.subtitle")}
        background={colors.surface}
        foreground={colors.text}
        onPress={() => navigate({ pathname: ROUTES.COMMUNITY.NEWS, params: pageParams.communityPage("community:tiles.news.title") })}
      />
      <CommunityTile
        icon="chart-line"
        title={t("community:tiles.stats.title")}
        subtitle={t("community:tiles.stats.subtitle")}
        background={colors.primary}
        foreground={colors.onPrimary}
        onPress={() => navigate({ pathname: ROUTES.COMMUNITY.STATS, params: pageParams.communityPage("community:tiles.stats.title") })}
      />
      <CommunityTile
        icon="rocket-launch-outline"
        title={t("community:tiles.shape.title")}
        subtitle={t("community:tiles.shape.subtitle")}
        background={colors.secondary}
        foreground={colors.onSecondary}
        onPress={() => navigate({ pathname: ROUTES.COMMUNITY.SHAPE, params: pageParams.communityPage("community:tiles.shape.title") })}
      />
    </View>
  );
}

export default Community;
