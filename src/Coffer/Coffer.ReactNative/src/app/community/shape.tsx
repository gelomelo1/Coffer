import { CountdownCard } from "@/src/components/community/contribution/countdown_card";
import { OffPanel } from "@/src/components/community/contribution/off_panel";
import { PhotoPhasePanel } from "@/src/components/community/contribution/photo_phase_panel";
import { VotePanel } from "@/src/components/community/contribution/vote_panel";
import { Loading } from "@/src/components/custom_ui/loading";
import { ErrorState } from "@/src/components/custom_ui/states";
import { useContribution } from "@/src/hooks/contribution";
import { colors, spacing } from "@/src/theme/theme";
import { apiErrorText } from "@/src/utils/api_error_text";
import { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView } from "react-native";

/** Shape What's Next: no round (why + the last result), a vote, or a photo round — with its countdown. */
function ShapeWhatsNext() {
  const { data, isLoading, isError, error, refetch } = useContribution();
  const [refreshing, setRefreshing] = useState(false);
  const onEnded = useCallback(() => void refetch(), [refetch]);

  if (isLoading) return <Loading />;
  if (isError || !data) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };
  const phase = data.enabled ? data.phase : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xxl * 2 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        {phase ? (
          <>
            <CountdownCard key={phase.id + phase.endsAt} openedAt={phase.openedAt} endsAt={phase.endsAt} serverNow={data.serverNow} onEnded={onEnded} />
            {phase.kind === "vote" ? <VotePanel key={phase.id + (phase.myVote?.candidateId ?? "")} phase={phase} /> : <PhotoPhasePanel phase={phase} />}
          </>
        ) : (
          <OffPanel state={data} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default ShapeWhatsNext;
