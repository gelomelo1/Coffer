import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import CustomText from "@/src/components/custom_ui/custom_text";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { useMarketMutation } from "@/src/hooks/market_api";
import { customTheme } from "@/src/theme/theme";
import { PostMessageInput } from "@/src/types/entities/market";
import { formatPrice, marketApi, parsePriceToCents } from "@/src/utils/market_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { Chip, ChipRow, ErrorText, Label } from "../ui/retro";

const c = customTheme.colors;

/** Message input + "€ Offer" and "Meetup" actions. */
function Composer({ conversationId, allowOffers }: { conversationId: string; allowOffers: boolean }) {
  const [text, setText] = useState("");
  const [offerOpen, setOfferOpen] = useState(false);
  const [meetupOpen, setMeetupOpen] = useState(false);
  const send = useMarketMutation((input: PostMessageInput) => marketApi.postMessage(conversationId, input));

  const sendText = () => {
    const body = text.trim();
    if (!body) return;
    send.mutate({ kind: "text", body }, { onSuccess: () => setText("") });
  };

  return (
    <View style={{ borderTopWidth: 2, borderColor: c.primary, backgroundColor: c.background, padding: 8, gap: 6 }}>
      <ChipRow>
        {allowOffers ? (
          <Chip label="Price offer" icon={<MaterialIcons name="euro" size={16} color={c.primary} />} onPress={() => setOfferOpen(true)} />
        ) : null}
        <Chip label="Propose meetup" icon={<MaterialIcons name="event" size={16} color={c.primary} />} onPress={() => setMeetupOpen(true)} />
      </ChipRow>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Write a message…"
          placeholderTextColor={c.accent}
          multiline
          maxLength={2000}
          style={{
            flex: 1,
            maxHeight: 120,
            borderWidth: 2,
            borderColor: c.primary,
            backgroundColor: c.background,
            color: c.primary,
            fontFamily: "VendSans",
            fontSize: 16,
            paddingHorizontal: 8,
            paddingVertical: 6,
          }}
        />
        <TouchableOpacity
          onPress={sendText}
          disabled={!text.trim() || send.isPending}
          accessibilityLabel="Send"
          style={{
            backgroundColor: c.primary,
            padding: 10,
            borderWidth: 2,
            borderColor: c.secondary,
            opacity: !text.trim() || send.isPending ? 0.5 : 1,
          }}
        >
          <MaterialIcons name="send" size={22} color={c.secondary} />
        </TouchableOpacity>
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
        onSubmit={(at, place) =>
          send.mutate({ kind: "meetup_proposal", at, place }, { onSuccess: () => setMeetupOpen(false) })
        }
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
      overlayTitle="Make a price offer"
      footerContent={
        <View style={{ width: "90%" }}>
          <CustomButton
            title={cents ? `Offer ${formatPrice(cents)}` : "Offer"}
            disabled={!cents || loading}
            loading={loading}
            onPress={() => cents && onSubmit(cents, note.trim())}
          />
        </View>
      }
    >
      <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }} keyboardShouldPersistTaps="handled">
        <CustomText>The other side can accept or decline. An accepted offer becomes the deal price.</CustomText>
        <CustomTextInput label="Amount (€)" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder="0" />
        <CustomTextInput label="Note (optional)" value={note} onChangeText={setNote} maxLength={500} />
      </ScrollView>
    </CustomOverlay>
  );
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
  const days = useMemo(() => {
    const list: { label: string; date: Date }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + i);
      list.push({
        label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }),
        date: d,
      });
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
    ? "Use the HH:MM format, e.g. 17:30."
    : at && at.getTime() <= Date.now()
      ? "Pick a time in the future."
      : !place.trim()
        ? "Where do you meet?"
        : null;

  return (
    <CustomOverlay
      isVisible={isVisible}
      onClose={onClose}
      overlayTitle="Propose a meetup"
      footerContent={
        <View style={{ width: "90%" }}>
          <CustomButton
            title="Send proposal"
            disabled={!!error || loading}
            loading={loading}
            onPress={() => at && onSubmit(at.toISOString(), place.trim())}
          />
        </View>
      }
    >
      <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }} keyboardShouldPersistTaps="handled">
        <CustomText>Meet in a busy public place. Check the item before showing your PIN.</CustomText>
        <Label>Day</Label>
        <ChipRow>
          {days.map((d, i) => (
            <Chip key={i} label={d.label} selected={dayIndex === i} onPress={() => setDayIndex(i)} />
          ))}
        </ChipRow>
        <CustomTextInput label="Time (HH:MM)" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" maxLength={5} />
        <CustomTextInput label="Place" value={place} onChangeText={setPlace} placeholder="e.g. Deák tér, metro exit" maxLength={120} />
        <ErrorText>{error}</ErrorText>
      </ScrollView>
    </CustomOverlay>
  );
}

export default Composer;
