import CustomText from "@/src/components/custom_ui/custom_text";
import { useMarketMutation, useReportRules } from "@/src/hooks/market_api";
import { ReportRule, ReportTargetType } from "@/src/types/entities/market";
import { marketApi } from "@/src/utils/market_api";
import { useEffect, useState } from "react";
import { Chip, ChipRow, ErrorText, Label } from "./retro";
import TextPromptOverlay from "./text_prompt_overlay";

const targetNames: Record<ReportTargetType, string> = {
  listing: "listing",
  message: "message",
  review: "review",
};

/**
 * Report a listing, chat message or review against one of the fixed content rules.
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
  const { data: rules = [] } = useReportRules();
  const [rule, setRule] = useState<ReportRule | null>(null);
  const report = useMarketMutation(
    (reason: string) => marketApi.createReport({ targetType, targetId, rule: rule!, reason }),
    "Report sent — you'll see the outcome in Settings › Reports",
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
      title={`Report ${targetNames[targetType]}`}
      explanation={
        targetType === "review"
          ? "The review stops counting toward your rating while an admin checks it against the rules. Coffer does not decide who was right in the deal."
          : "An admin checks it against the marketplace rules. The author is told what was removed and why, but never who reported it."
      }
      placeholder="What exactly breaks the rule?"
      submitLabel="Send report"
      minLength={10}
      submitDisabled={!rule}
      maxLength={1000}
      loading={report.isPending}
      onSubmit={(reason) => report.mutate(reason, { onSuccess: onClose })}
    >
      <Label>Which rule does it break?</Label>
      <ChipRow>
        {applicable.map((r) => (
          <Chip key={r.rule} label={r.label} selected={rule === r.rule} onPress={() => setRule(r.rule)} />
        ))}
      </ChipRow>
      {selected ? <CustomText style={{ fontSize: 13 }}>{selected.description}</CustomText> : <ErrorText>Choose a rule.</ErrorText>}
    </TextPromptOverlay>
  );
}

export default ReportOverlay;
