import { ComingSoon } from "@/src/components/community/coming_soon";
import { useTranslation } from "react-i18next";

function News() {
  const { t } = useTranslation();
  return <ComingSoon icon="newspaper-variant-outline" title={t("community:tiles.news.title")} text={t("community:news.comingSoon")} />;
}

export default News;
