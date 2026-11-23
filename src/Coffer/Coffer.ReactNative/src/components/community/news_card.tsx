import { pressableShadowStyle } from "@/src/theme/pressable";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { NewsCard as NewsCardData } from "@/src/types/entities/news";
import { newsImage } from "@/src/utils/news_api";
import { newsDate } from "@/src/utils/news_format";
import { openNewsPost } from "@/src/utils/open_app_link";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable, Text, View } from "react-native";

/** Today / yesterday / N days ago / the date, plus "edited" when the post changed after it was published. */
export function useNewsDate(publishedAt: string, editedAt: string | null) {
  const { t, i18n } = useTranslation();
  return newsDate(publishedAt, editedAt, new Date(), {
    today: t("community:news.today"),
    yesterday: t("community:news.yesterday"),
    daysAgo: (count) => t("community:news.daysAgo", { count }),
    date: (d) => d.toLocaleDateString(i18n.language, { year: "numeric", month: "short", day: "numeric" }),
  });
}

export function NewsDateLine({ publishedAt, editedAt }: { publishedAt: string; editedAt: string | null }) {
  const { t } = useTranslation();
  const { date, edited } = useNewsDate(publishedAt, editedAt);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xxs }}>
      <MaterialCommunityIcons name="calendar-blank-outline" size={16} color={colors.textMuted} />
      <Text style={[typography.meta, { color: colors.textMuted }]}>{edited ? t("community:news.dateEdited", { date }) : date}</Text>
    </View>
  );
}

/** A post in the News list: a band of its banner (or a plain band), the title and the date. Opens the post. */
function NewsCard({ post }: { post: NewsCardData }) {
  const { t } = useTranslation();
  const { date, edited } = useNewsDate(post.publishedAt, post.editedAt);

  return (
    <Pressable
      onPress={() => openNewsPost(post.id)}
      accessibilityRole="button"
      accessibilityLabel={`${post.title}. ${edited ? t("community:news.dateEdited", { date }) : date}`}
      accessibilityHint={t("community:news.openHint")}
      style={({ pressed }) => [
        { borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surface },
        pressableShadowStyle(pressed),
      ]}
    >
      {post.heroImage ? (
        <Image
          source={{ uri: newsImage(post.heroImage) }}
          style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.surfaceAlt, borderBottomWidth: borders.width, borderColor: colors.border }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View
          style={{
            height: 72,
            backgroundColor: colors.primary,
            borderBottomWidth: borders.width,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons name="newspaper-variant-outline" size={36} color={colors.onPrimary} />
        </View>
      )}
      <View style={{ padding: spacing.md, gap: spacing.xs }}>
        <Text style={[typography.title, { color: colors.text }]} numberOfLines={2}>
          {post.title}
        </Text>
        <NewsDateLine publishedAt={post.publishedAt} editedAt={post.editedAt} />
      </View>
    </Pressable>
  );
}

export default memo(NewsCard);
