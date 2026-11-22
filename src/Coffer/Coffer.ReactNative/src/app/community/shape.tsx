import { ComingSoon } from "@/src/components/community/coming_soon";
import { useTranslation } from "react-i18next";

function ShapeWhatsNext() {
  const { t } = useTranslation();
  return <ComingSoon icon="rocket-launch-outline" title={t("community:tiles.shape.title")} text={t("community:shape.comingSoon")} />;
}

export default ShapeWhatsNext;
