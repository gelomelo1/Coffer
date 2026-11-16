import CustomButton from "@/src/components/custom_ui/custom_button";
import { dealStatusColors, dealStatusLabels, deliveryLabels } from "@/src/const/market";
import { useMarketMutation } from "@/src/hooks/market_api";
import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import { Deal, DealStatus, DeliveryMethod, ListingDetail } from "@/src/types/entities/market";
import { daysLeft, formatDate, formatDateTime, formatPrice, LocalImage, marketApi } from "@/src/utils/market_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import ReviewModal from "../review/review_modal";
import { Chip, ChipRow, ListingImageView, Tag, WarningBanner } from "../ui/retro";
import TextPromptOverlay from "../ui/text_prompt_overlay";
import { PinDisplay, PinEntry } from "./pin_components";
import { ReceiptOverlay, ShipOverlay } from "./shipping_overlays";

const statusTextColor = (status: DealStatus) => (dealStatusColors[status] === colors.secondary ? colors.onSecondary : colors.onPrimary);

/**
 * The single "what do I do next" panel on top of a chat. Everything it offers comes from the backend's
 * deal.nextActions, so the UI can never offer a step the state machine would reject. The expanded body scrolls
 * inside a height cap so the messages stay visible on short screens.
 */
function DealPanel({
  deal,
  listing,
  conversationId,
  iAmSeller,
  compact = false,
}: {
  /** Header only (e.g. while the keyboard is open), without changing the user's own collapse choice. */
  compact?: boolean;
  deal: Deal | null | undefined;
  listing: ListingDetail | undefined;
  conversationId: string;
  iAmSeller: boolean;
}) {
  const { t } = useTranslation();
  const { height, fontScale } = useWindowDimensions();
  // Short screens (or large text) start with just the header so the messages stay visible; one tap expands it.
  const [collapsed, setCollapsed] = useState(() => height / fontScale < 600);
  const [method, setMethod] = useState<DeliveryMethod | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const propose = useMarketMutation((m: DeliveryMethod) => marketApi.proposeDeal(conversationId, m), t("market:deal.toast.proposed"));
  const accept = useMarketMutation((id: string) => marketApi.acceptDeal(id), t("market:deal.toast.accepted"));
  const decline = useMarketMutation((id: string) => marketApi.declineDeal(id), t("market:deal.toast.declined"));
  const cancel = useMarketMutation(
    ({ id, reason }: { id: string; reason: string }) => marketApi.cancelDeal(id, reason || undefined),
    t("market:deal.toast.cancelled"),
  );
  const handoff = useMarketMutation(({ id, pin }: { id: string; pin: string }) => marketApi.confirmHandoff(id, pin), t("market:deal.toast.handoff"));
  const ship = useMarketMutation(
    ({ id, carrier, tracking, photo }: { id: string; carrier: string; tracking: string; photo: LocalImage | null }) =>
      marketApi.ship(id, carrier, tracking, photo),
    t("market:deal.toast.shipped"),
  );
  const receipt = useMarketMutation(
    ({ id, photo }: { id: string; photo: LocalImage | null }) => marketApi.confirmReceipt(id, photo),
    t("market:deal.toast.completed"),
  );
  const dispute = useMarketMutation(({ id, reason }: { id: string; reason: string }) => marketApi.dispute(id, reason), t("market:deal.toast.disputed"));

  const openDeal = deal && !["completed", "cancelled", "disputed"].includes(deal.status) ? deal : null;
  const finishedDeal = deal && (deal.status === "completed" || deal.status === "disputed") ? deal : null;
  const canPropose = iAmSeller && !openDeal && listing?.status === "active";
  const methods: DeliveryMethod[] = [
    ...(listing?.allowsLocalPickup ? (["local_pickup"] as DeliveryMethod[]) : []),
    ...(listing?.allowsShipping ? (["shipping"] as DeliveryMethod[]) : []),
  ];

  const d = openDeal ?? finishedDeal ?? deal;
  const has = (a: Deal["nextActions"][number]) => !!d?.nextActions.includes(a);
  const summary = deal ? `${deliveryLabels[deal.method]} · ${dealStatusLabels[deal.status]}` : t("market:deal.noDeal"); // i18n-ignore

  const header = (
    <Pressable
      onPress={() => setCollapsed(!collapsed)}
      accessibilityRole="button"
      accessibilityState={{ expanded: !collapsed && !compact }}
      accessibilityLabel={`${listing?.title ?? t("market:deal.listing")}, ${summary}`}
      accessibilityHint={collapsed ? t("market:deal.expandHint") : t("market:deal.collapseHint")}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        minHeight: 56,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        backgroundColor: pressed ? colors.surfaceAlt : colors.bg,
      })}
    >
      <ListingImageView fileName={listing?.images[0]?.fileName} style={{ width: 40, height: 40 }} />
      <View style={{ flex: 1 }}>
        <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={1}>
          {listing?.title ?? t("market:deal.listing")}
        </Text>
        <Text style={[typography.meta, { color: colors.text }]} numberOfLines={1}>
          {summary}
        </Text>
      </View>
      <MaterialIcons name={collapsed || compact ? "expand-more" : "expand-less"} size={sizes.iconMd} color={colors.text} />
    </Pressable>
  );

  const body = (
    <View style={{ gap: spacing.sm }}>
      {d ? (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xxs }}>
            <Tag label={dealStatusLabels[d.status]} color={dealStatusColors[d.status]} textColor={statusTextColor(d.status)} />
            {d.agreedPriceCents ? <Tag label={formatPrice(d.agreedPriceCents)} color={colors.secondary} textColor={colors.onSecondary} /> : null}
          </View>
          {d.meetupAt ? (
            <Text style={[typography.meta, { color: colors.text }]}>
              {t("market:deal.meetup", { time: formatDateTime(d.meetupAt), place: d.meetupPlace })}
            </Text>
          ) : null}
          {d.status === "cancelled" && d.cancelReason ? <Text style={[typography.meta, { color: colors.text }]}>{d.cancelReason}</Text> : null}

          {has("accept") ? (
            <>
              <WarningBanner />
              <Text style={[typography.body, { color: colors.text }]}>
                {d.agreedPriceCents
                  ? t("market:deal.proposesFor", { name: d.seller.name, method: deliveryLabels[d.method], price: formatPrice(d.agreedPriceCents) })
                  : t("market:deal.proposes", { name: d.seller.name, method: deliveryLabels[d.method] })}
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <CustomButton
                  title={t("market:deal.decline")}
                  variant="outline"
                  disabled={decline.isPending}
                  loading={decline.isPending}
                  onPress={() => decline.mutate(d.id)}
                  containerStyle={{ flex: 1 }}
                />
                <CustomButton
                  title={t("market:deal.accept")}
                  loading={accept.isPending}
                  disabled={accept.isPending}
                  onPress={() => accept.mutate(d.id)}
                  containerStyle={{ flex: 1 }}
                />
              </View>
            </>
          ) : null}

          {has("show_pin") && d.handoffPin && d.handoffQr ? <PinDisplay pin={d.handoffPin} qr={d.handoffQr} /> : null}
          {has("enter_pin") ? (
            <PinEntry loading={handoff.isPending} lockedUntil={d.pinLockedUntil} onSubmit={(pin) => handoff.mutate({ id: d.id, pin })} />
          ) : null}

          {has("ship") ? (
            <CustomButton
              title={t("market:deal.registerShipment")}
              icon={<MaterialIcons name="local-shipping" size={sizes.iconSm} color={colors.onPrimary} />}
              onPress={() => setShipOpen(true)}
            />
          ) : null}
          {d.status === "awaiting_shipment" && !has("ship") ? (
            <Text style={[typography.body, { color: colors.text }]}>{t("market:deal.waitingShipment", { name: d.seller.name })}</Text>
          ) : null}

          {d.trackingNumber ? (
            <View style={{ gap: spacing.xxs }}>
              <Text style={[typography.body, { color: colors.text }]}>
                {d.carrierLabel ? t("market:deal.tracking", { carrier: d.carrierLabel }) : t("market:deal.trackingNoCarrier")} <Text style={typography.bodyStrong}>{d.trackingNumber}</Text>
              </Text>
              {d.trackingUrl ? (
                <Pressable
                  onPress={() => Linking.openURL(d.trackingUrl!)}
                  accessibilityRole="link"
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    gap: spacing.xxs,
                    alignItems: "center",
                    alignSelf: "flex-start",
                    minHeight: sizes.touch,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <MaterialIcons name="open-in-new" size={sizes.iconSm} color={colors.text} />
                  <Text style={[typography.label, { color: colors.text, textDecorationLine: "underline" }]}>{t("market:deal.checkCarrier")}</Text>
                </Pressable>
              ) : null}
              {d.shipmentPhoto ? <ListingImageView deal fullScreen fileName={d.shipmentPhoto} style={{ width: 88, height: 88 }} /> : null}
              {d.status === "shipped" && d.autoCompleteAt ? (
                <Text style={[typography.meta, { color: colors.textMuted }]}>{t("market:deal.autoComplete", { date: formatDate(d.autoCompleteAt) })}</Text>
              ) : null}
            </View>
          ) : null}

          {has("confirm_receipt") ? (
            <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
              <CustomButton
                title={t("market:deal.reportProblem")}
                variant="outline"
                onPress={() => setDisputeOpen(true)}
                containerStyle={{ flex: 1, minWidth: 140 }}
              />
              <CustomButton title={t("market:deal.received")} onPress={() => setReceiptOpen(true)} containerStyle={{ flex: 1, minWidth: 140 }} />
            </View>
          ) : null}

          {d.status === "disputed" ? (
            <View style={{ gap: spacing.xxs }}>
              <Text style={[typography.body, { color: colors.text }]}>
                {d.disputeReason ? t("market:deal.disputedWithReason", { reason: d.disputeReason }) : t("market:deal.disputed")}
              </Text>
              <Text style={[typography.meta, { color: colors.textMuted }]}>{t("market:deal.disputedNote")}</Text>
            </View>
          ) : null}

          {d.status === "completed" || d.status === "disputed" ? (
            has("review") ? (
              <>
                <Text style={[typography.body, { color: colors.text }]}>{t("market:deal.reviewPrompt", { count: daysLeft(d.reviewDeadline) ?? 0 })}</Text>
                <CustomButton
                  title={t("market:deal.leaveReview")}
                  variant="secondary"
                  icon={<MaterialIcons name="star" size={sizes.iconSm} color={colors.onSecondary} />}
                  onPress={() => setReviewOpen(true)}
                />
              </>
            ) : (
              <ChipRow>
                <Chip label={t("market:deal.seeReviews")} icon={<MaterialIcons name="star" size={18} color={colors.text} />} onPress={() => setReviewOpen(true)} />
              </ChipRow>
            )
          ) : null}

          {has("cancel") ? (
            <Pressable
              onPress={() => setCancelOpen(true)}
              accessibilityRole="button"
              style={({ pressed }) => ({ alignSelf: "flex-start", minHeight: sizes.touch, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={[typography.label, { color: colors.danger, textDecorationLine: "underline" }]}>{t("market:deal.cancel")}</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {canPropose ? (
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.bodyStrong, { color: colors.text }]}>{t("market:deal.proposeTitle")}</Text>
          <ChipRow>
            {methods.map((m) => (
              <Chip key={m} label={deliveryLabels[m]} selected={method === m} onPress={() => setMethod(m)} />
            ))}
          </ChipRow>
          {method === "shipping" ? <WarningBanner /> : null}
          <CustomButton
            title={t("market:deal.propose")}
            disabled={!method || propose.isPending}
            loading={propose.isPending}
            onPress={() => method && propose.mutate(method)}
          />
        </View>
      ) : !d && !iAmSeller ? (
        <Text style={[typography.meta, { color: colors.text }]}>{t("market:deal.buyerHint")}</Text>
      ) : null}
    </View>
  );

  return (
    <View style={{ borderBottomWidth: borders.width, borderColor: colors.border, backgroundColor: colors.bg }}>
      {header}
      {!collapsed && !compact ? (
        <ScrollView
          style={{ maxHeight: Math.max(160, height * 0.4), borderTopWidth: borders.hairline, borderColor: colors.borderMuted }}
          contentContainerStyle={{ padding: spacing.sm }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {body}
        </ScrollView>
      ) : null}

      {d ? (
        <>
          <TextPromptOverlay
            isVisible={cancelOpen}
            onClose={() => setCancelOpen(false)}
            title={t("market:deal.cancelTitle")}
            explanation={t("market:deal.cancelExplanation")}
            label={t("market:deal.cancelReason")}
            submitLabel={t("market:deal.cancel")}
            maxLength={300}
            loading={cancel.isPending}
            onSubmit={(reason) => cancel.mutate({ id: d.id, reason }, { onSuccess: () => setCancelOpen(false) })}
          />
          <TextPromptOverlay
            isVisible={disputeOpen}
            onClose={() => setDisputeOpen(false)}
            title={t("market:deal.reportProblem")}
            explanation={t("market:deal.disputeExplanation")}
            label={t("market:deal.disputeLabel")}
            placeholder={t("market:deal.disputePlaceholder")}
            submitLabel={t("market:deal.disputeSubmit")}
            minLength={20}
            maxLength={1000}
            loading={dispute.isPending}
            onSubmit={(reason) => dispute.mutate({ id: d.id, reason }, { onSuccess: () => setDisputeOpen(false) })}
          />
          <ShipOverlay
            isVisible={shipOpen}
            onClose={() => setShipOpen(false)}
            loading={ship.isPending}
            onSubmit={(carrier, tracking, photo) => ship.mutate({ id: d.id, carrier, tracking, photo }, { onSuccess: () => setShipOpen(false) })}
          />
          <ReceiptOverlay
            isVisible={receiptOpen}
            onClose={() => setReceiptOpen(false)}
            loading={receipt.isPending}
            onSubmit={(photo) => receipt.mutate({ id: d.id, photo }, { onSuccess: () => setReceiptOpen(false) })}
          />
          <ReviewModal isVisible={reviewOpen} onClose={() => setReviewOpen(false)} deal={d} />
        </>
      ) : null}
    </View>
  );
}

export default DealPanel;
