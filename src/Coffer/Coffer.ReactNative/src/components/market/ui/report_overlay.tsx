import { reportRuleText } from "@/src/const/market";
import { useMarketMutation, useReportRules } from "@/src/hooks/market_api";
import { colors, typography } from "@/src/theme/theme";
import { ReportRule, ReportTargetType } from "@/src/types/entities/market";
import { marketApi } from "@/src/utils/market_api";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";
import { SectionHeader } from "@/src/components/custom_ui/card";
import { Chip, ChipRow, ErrorText } from "./retro";
import TextPromptOverlay from "./text_prompt_overlay";

/**
 * Report a listing, chat message, review, collection item or comment against one of the fixed content rules.
 * Coffer only checks rule breaks — it never decides who was right in a deal.
 */
function ReportOverlay({
  isVisible,
  onClose,
  targetType,
  targetId,
}: {
  isVisible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
}) {
  const { t } = useTranslation();
  const { data: rules = [] } = useReportRules();
  const [rule, setRule] = useState<ReportRule | null>(null);
  const report = useMarketMutation(
    (reason: string) => marketApi.createReport({ targetType, targetId, rule: rule!, reason }),
    t("market:report.sent"),
  );

  useEffect(() => {
    if (isVisible) setRule(null);
  }, [isVisible]);

  const applicable = rules.filter((r) => r.appliesTo.includes(targetType));
  const selected = applicable.find((r) => r.rule === rule);

  return (
    <TextPromptOverlay
      isVisible={isVisible}
      onClose={onClose}
      title={t(`market:report.title.${targetType}`)}
      explanation={t(`market:report.explanation.${targetType}`)}
      label={t("market:report.reasonLabel")}
      placeholder={t("market:report.reasonPlaceholder")}
      submitLabel={t("market:report.submit")}
      minLength={10}
      submitDisabled={!rule}
      maxLength={1000}
      loading={report.isPending}
      onSubmit={(reason) => report.mutate(reason, { onSuccess: onClose })}
    >
      <SectionHeader title={t("market:report.whichRule")} />
      <ChipRow>
        {applicable.map((r) => (
          <Chip key={r.rule} label={reportRuleText(r.rule, "label", r.label)} selected={rule === r.rule} onPress={() => setRule(r.rule)} />
        ))}
      </ChipRow>
      {selected ? (
        <Text style={[typography.meta, { color: colors.text }]}>{reportRuleText(selected.rule, "description", selected.description)}</Text>
      ) : (
        <ErrorText>{t("market:report.chooseRule")}</ErrorText>
      )}
    </TextPromptOverlay>
  );
}

export default ReportOverlay;
