import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import showToast from "@/src/components/custom_ui/toast";
import { useVote } from "@/src/hooks/contribution";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { PhaseView } from "@/src/types/entities/contribution";
import { apiErrorText } from "@/src/utils/api_error_text";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

const TEXT_MIN = 10;
const TEXT_MAX = 1000;

/** Voting: pick one of three candidates and say which attributes you'd like and why. Editable until the end. */
export function VotePanel({ phase }: { phase: PhaseView }) {
  const { t } = useTranslation();
  const vote = useVote();
  const candidates = phase.candidates ?? [];
  const [editing, setEditing] = useState(!phase.myVote);
  const [choice, setChoice] = useState<string | null>(phase.myVote?.candidateId ?? null);
  const [text, setText] = useState(phase.myVote?.text ?? "");
  const [error, setError] = useState<string | null>(null);

  const mine = candidates.find((c) => c.id === phase.myVote?.candidateId);
  if (phase.myVote && !editing) {
    return (
      <View style={{ gap: spacing.sm, padding: spacing.md, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <MaterialCommunityIcons name="check-circle" size={24} color={colors.success} />
          <Text style={[typography.title, { color: colors.text, flex: 1 }]}>{t("community:shape.vote.yourVote", { name: mine?.name ?? "" })}</Text>
        </View>
        <Text style={[typography.body, { color: colors.text }]}>{phase.myVote.text}</Text>
        <CustomButton title={t("community:shape.vote.edit")} variant="outline" onPress={() => setEditing(true)} />
      </View>
    );
  }

  const send = () => {
    if (!choice) return setError(t("community:shape.vote.pickFirst"));
    if (text.trim().length < TEXT_MIN) return setError(t("community:shape.vote.tooShort"));
    setError(null);
    vote.mutate(
      { phaseId: phase.id, candidateId: choice, text: text.trim() },
      {
        onSuccess: () => {
          setEditing(false);
          showToast("success", t("community:shape.vote.sent"));
        },
        onError: (e) => setError(apiErrorText(e)),
      },
    );
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={[typography.headline, { color: colors.text }]} accessibilityRole="header">
        {t("community:shape.vote.title")}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={t("community:shape.vote.candidatesA11y")} style={{ gap: spacing.sm }}>
        {candidates.map((c) => {
          const selected = c.id === choice;
          return (
            <Pressable
              key={c.id}
              onPress={() => setChoice(c.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={c.description ? `${c.name}. ${c.description}` : c.name}
              style={({ pressed }) => ({
                minHeight: 56, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm,
                borderWidth: selected ? borders.focus : borders.width, borderColor: selected ? colors.secondary : colors.border,
                backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
              })}
            >
              <MaterialCommunityIcons name={selected ? "radiobox-marked" : "radiobox-blank"} size={24} color={selected ? colors.secondary : colors.text} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>{c.name}</Text>
                {c.description ? <Text style={[typography.meta, { color: colors.textMuted }]}>{c.description}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <CustomTextInput
        label={t("community:shape.vote.question")}
        placeholder={t("community:shape.vote.placeholder")}
        value={text}
        onChangeText={(v) => setText(v.slice(0, TEXT_MAX))}
        multiline
        maxLength={TEXT_MAX}
        helperText={t("community:shape.vote.counter", { count: text.length })}
        errorMessage={error ?? undefined}
        inputStyle={{ minHeight: 120, textAlignVertical: "top" }}
        required
      />
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {phase.myVote ? (
          <CustomButton title={t("community:shape.vote.cancel")} variant="ghost" onPress={() => setEditing(false)} containerStyle={{ flex: 1 }} />
        ) : null}
        <CustomButton
          title={phase.myVote ? t("community:shape.vote.update") : t("community:shape.vote.send")}
          onPress={send}
          loading={vote.isPending}
          disabled={vote.isPending}
          containerStyle={{ flex: 2 }}
        />
      </View>
    </View>
  );
}
