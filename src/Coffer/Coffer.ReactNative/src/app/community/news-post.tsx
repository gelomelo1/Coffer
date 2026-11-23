import { MarkdownView } from "@/src/components/community/markdown_view";
import { NewsDateLine } from "@/src/components/community/news_card";
import { Loading } from "@/src/components/custom_ui/loading";
import { EmptyState, ErrorState } from "@/src/components/custom_ui/states";
import { useNewsPost } from "@/src/hooks/news";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { apiErrorText } from "@/src/utils/api_error_text";
import { apiErrorCode } from "@/src/utils/market_api";
import { newsImage } from "@/src/utils/news_api";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, RefreshControl, ScrollView, Text, View } from "react-native";

/** One news post: its banner, title, date (and "edited") and the markdown content. */
function NewsPostPage() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: post, isLoading, isError, error, refetch } = useNewsPost(id);
  const [refreshing, setRefreshing] = useState(false);

  if (isLoading) return <Loading />;
  if (isError || !post) {
    // A post that was unpublished or deleted (or a broken link) is simply not there any more.
    if (!isError || apiErrorCode(error) === "newsNotFound")
      return (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <EmptyState icon="newspaper" title={t("community:news.goneTitle")} text={t("community:news.goneText")} />
        </View>
      );
    return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;
  }

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: spacing.xxl * 2 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
    >
      {post.heroImage ? (
        <Image
          source={{ uri: newsImage(post.heroImage) }}
          style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.surfaceAlt, borderBottomWidth: borders.width, borderColor: colors.border }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <View style={{ padding: spacing.md, gap: spacing.md }}>
        <View style={{ gap: spacing.xs }}>
          <Text accessibilityRole="header" style={[typography.display, { color: colors.text }]}>
            {post.title}
          </Text>
          <NewsDateLine publishedAt={post.publishedAt} editedAt={post.editedAt} />
        </View>
        <View style={{ height: borders.width, backgroundColor: colors.border }} />
        <MarkdownView content={post.content} />
      </View>
    </ScrollView>
  );
}

export default NewsPostPage;
