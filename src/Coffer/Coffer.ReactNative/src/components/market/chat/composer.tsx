import { SectionHeader } from "@/src/components/custom_ui/card";
import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { useMarketMutation } from "@/src/hooks/market_api";
import { pressableShadowStyle } from "@/src/theme/pressable";
import { borders, colors, fonts, sizes, spacing, typography } from "@/src/theme/theme";
import { PostMessageInput } from "@/src/types/entities/market";
import i18n from "@/src/i18n";
import { formatPrice, marketApi, parsePriceToCents } from "@/src/utils/market_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Chip, ChipRow, ErrorText } from "../ui/retro";

const MAX_MESSAGE = 2000;

/** Message input + "Price offer" and "Propose meetup" actions. `bottomInset` keeps it above the gesture bar. */
function Composer({ conversationId, allowOffers, bottomInset = 0 }: { conversationId: string; allowOffers: boolean; bottomInset?: number }) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [offerOpen, setOfferOpen] = useState(false);
  const [meetupOpen, setMeetupOpen] = useState(false);
  const send = useMarketMutation((input: PostMessageInput) => marketApi.postMessage(conversationId, input));

  const canSend = !!text.trim() && !send.isPending;
  const sendText = () => {
    const body = text.trim();
    if (!body) return;
    send.mutate({ kind: "text", body }, { onSuccess: () => setText("") });
  };

  return (
    <View
      style={{
        borderTopWidth: borders.width,
        borderColor: colors.border,
        backgroundColor: colors.bg,
        paddingHorizontal: spacing.sm,
        paddingTop: spacing.xs,
        paddingBottom: spacing.xs + bottomInset,
        gap: spacing.xs,
      }}
    >
      {/* One scrollable row: wrapping would stack the chips on narrow screens and eat the message area. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.xs, paddingRight: spacing.xs, paddingBottom: 4 }}>
        {allowOffers ? (
          <Chip
            label={t("market:chat.priceOffer")}
            icon={<MaterialIcons name="euro" size={18} color={colors.text} />}
            onPress={() => setOfferOpen(true)}
          />
        ) : null}
        <Chip
          label={t("market:chat.proposeMeetup")}
          icon={<MaterialIcons name="event" size={18} color={colors.text} />}
          onPress={() => setMeetupOpen(true)}
        />
      </ScrollView>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.xs }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t("market:chat.placeholder")}
          accessibilityLabel={t("market:chat.messageLabel")}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={MAX_MESSAGE}
          style={{
            flex: 1,
            minHeight: sizes.control,
            maxHeight: 120,
            borderWidth: borders.width,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
            fontFamily: fonts.regular,
            fontSize: 16,
            lineHeight: 22,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.sm - 2,
            textAlignVertical: "center",
          }}
        />
        <Pressable
          onPress={sendText}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={t("market:chat.send")}
          accessibilityState={{ disabled: !canSend, busy: send.isPending }}
          style={({ pressed }) => [
            {
              width: sizes.control,
              height: sizes.control,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: canSend ? colors.primary : colors.surfaceAlt,
              borderWidth: borders.width,
              borderColor: colors.border,
            },
            pressableShadowStyle(pressed, !canSend),
          ]}
        >
          <MaterialIcons name="send" size={sizes.iconMd} color={canSend ? colors.onPrimary : colors.textMuted} />
        </Pressable>
      </View>

      <OfferOverlay
        isVisible={offerOpen}
        onClose={() => setOfferOpen(false)}
        loading={send.isPending}
        onSubmit={(amountCents, note) =>
          send.mutate({ kind: "price_offer", amountCents, body: note || null }, { onSuccess: () => setOfferOpen(false) })
        }
      />
      <MeetupOverlay
        isVisible={meetupOpen}
        onClose={() => setMeetupOpen(false)}
        loading={send.isPending}
        onSubmit={(at, place) => send.mutate({ kind: "meetup_proposal", at, place }, { onSuccess: () => setMeetupOpen(false) })}
      />
    </View>
  );
}

function OfferOverlay({
  isVisible,
  onClose,
  onSubmit,
  loading,
}: {
  isVisible: boolean;
  onClose: () => void;
  onSubmit: (amountCents: number, note: string) => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (isVisible) {
      setAmount("");
      setNote("");
    }
  }, [isVisible]);
  const cents = parsePriceToCents(amount);

  return (
    <CustomOverlay
      isVisible={isVisible}
      onClose={onClose}
      overlayTitle={t("market:chat.offerTitle")}
      footerContent={
        <CustomButton
          title={cents ? t("market:chat.offerSubmitAmount", { price: formatPrice(cents) }) : t("market:chat.offerSubmit")}
          disabled={!cents || loading}
          loading={loading}
          onPress={() => cents && onSubmit(cents, note.trim())}
        />
      }
    >
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.body, { color: colors.text }]}>{t("market:chat.offerExplanation")}</Text>
        <CustomTextInput
          label={t("market:chat.amount")}
          required
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          placeholder="0" // i18n-ignore
        />
        <CustomTextInput label={t("market:chat.noteOptional")} value={note} onChangeText={setNote} maxLength={500} />
      </ScrollView>
    </CustomOverlay>
  );
}

function dayLabel(date: Date, offset: number) {
  if (offset === 0) return i18n.t("market:chat.today");
  if (offset === 1) return i18n.t("market:chat.tomorrow");
  return date.toLocaleDateString(i18n.language, { weekday: "short", day: "numeric", month: "short" });
}

/** Day chips + HH:MM: avoids a native date picker dependency. */
function MeetupOverlay({
  isVisible,
  onClose,
  onSubmit,
  loading,
}: {
  isVisible: boolean;
  onClose: () => void;
  onSubmit: (atIso: string, place: string) => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const days = useMemo(() => {
    const list: { label: string; date: Date }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + i);
      list.push({ label: dayLabel(d, i), date: d });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);
  const [dayIndex, setDayIndex] = useState(1);
  const [time, setTime] = useState("17:00");
  const [place, setPlace] = useState("");
  useEffect(() => {
    if (isVisible) {
      setDayIndex(1);
      setTime("17:00");
      setPlace("");
    }
  }, [isVisible]);

  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
  let at: Date | null = null;
  if (match) {
    at = new Date(days[dayIndex].date);
    at.setHours(Number(match[1]), Number(match[2]));
  }
  const error = !match
    ? t("market:chat.errorTime")
    : at && at.getTime() <= Date.now()
      ? t("market:chat.errorPast")
      : !place.trim()
        ? t("market:chat.errorPlace")
        : null;

  return (
    <CustomOverlay
      isVisible={isVisible}
      onClose={onClose}
      overlayTitle={t("market:chat.meetupTitle")}
      footerContent={
        <CustomButton
          title={t("market:chat.meetupSubmit")}
          disabled={!!error || loading}
          loading={loading}
          onPress={() => at && onSubmit(at.toISOString(), place.trim())}
        />
      }
    >
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.body, { color: colors.text }]}>{t("market:chat.meetupExplanation")}</Text>
        <SectionHeader title={t("market:chat.day")} />
        <ChipRow>
          {days.map((d, i) => (
            <Chip key={i} label={d.label} selected={dayIndex === i} onPress={() => setDayIndex(i)} />
          ))}
        </ChipRow>
        <CustomTextInput
          label={t("market:chat.time")}
          helperText={t("market:chat.timeHelp")}
          value={time}
          onChangeText={setTime}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
        />
        <CustomTextInput
          label={t("market:chat.place")}
          required
          value={place}
          onChangeText={setPlace}
          placeholder={t("market:chat.placePlaceholder")}
          maxLength={120}
        />
        <ErrorText>{error}</ErrorText>
      </ScrollView>
    </CustomOverlay>
  );
}

export default Composer;
