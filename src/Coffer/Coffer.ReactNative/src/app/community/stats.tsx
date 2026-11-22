import { ComingSoon } from "@/src/components/community/coming_soon";
import { useTranslation } from "react-i18next";

/** Replaced by the real page in the next step. */
function Stats() {
  const { t } = useTranslation();
  return <ComingSoon icon="chart-line" title={t("community:tiles.stats.title")} text={t("community:tiles.stats.subtitle")} />;
}

export default Stats;
